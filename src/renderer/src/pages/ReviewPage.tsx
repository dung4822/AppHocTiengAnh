import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, Clock, Headphones, Loader2, Mic, Undo2, Volume2 } from 'lucide-react'
import type { ReviewCardView, ReviewRating } from '@shared/types'
import { api, call, errMsg } from '../api'
import { useApp } from '../appState'
import { usePlayer } from '../usePlayer'
import { Kbd, LeechBox } from '../components/ui'

const BUTTONS: { rating: ReviewRating; label: string; c: string; bg: string }[] = [
  { rating: 1, label: 'Quên', c: 'var(--err)', bg: 'var(--err-soft)' },
  { rating: 2, label: 'Khó', c: 'var(--leech)', bg: 'var(--leech-soft)' },
  { rating: 3, label: 'Được', c: 'var(--known)', bg: 'var(--known-soft)' },
  { rating: 4, label: 'Dễ', c: 'var(--blue)', bg: 'var(--blue-soft)' }
]
const STATE_LABEL = ['Thẻ mới', 'Đang học', 'Ôn tập', 'Học lại']

// Tô cụm trong câu (kiểu "cụm của bài": nền tím nhạt + gạch dưới tím)
function highlight(sentence: string, term: string) {
  const i = sentence.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0) return sentence
  return (
    <>
      {sentence.slice(0, i)}
      <span className="chunk-word rounded px-[3px]">{sentence.slice(i, i + term.length)}</span>
      {sentence.slice(i + term.length)}
    </>
  )
}

export default function ReviewPage() {
  const { nav } = useApp()
  const [card, setCard] = useState<ReviewCardView | null>(null)
  const [loading, setLoading] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Lịch sử trong phiên để hoàn tác (Ctrl+Z) và tóm tắt cuối phiên
  const [history, setHistory] = useState<{ logId: number; card: ReviewCardView; rating: ReviewRating }[]>([])
  const player = usePlayer('review')
  const playerRef = useRef(player)
  playerRef.current = player

  const showCard = useCallback((c: ReviewCardView | null) => {
    setCard(c)
    setRevealed(false)
    setLoading(false)
    // Thẻ nghe: tự phát audio câu ngữ cảnh, không hiện chữ
    if (c && c.direction === 'listen' && c.audioUrl) playerRef.current.play([{ id: c.cardId, url: c.audioUrl }])
  }, [])

  const loadNext = useCallback(
    async (lastVocabId: number | null) => {
      try {
        showCard(await call(api.getNextReviewCard(lastVocabId)))
      } catch (e) {
        setError(errMsg(e))
        setLoading(false)
      }
    },
    [showCard]
  )

  useEffect(() => {
    void loadNext(null)
    return () => playerRef.current.stop()
  }, [loadNext])

  const replay = useCallback(() => {
    if (card?.audioUrl) player.play([{ id: card.cardId, url: card.audioUrl }])
  }, [card, player])

  const reveal = useCallback(() => {
    if (!card || revealed) return
    setRevealed(true)
    // Thẻ nói: hiện đáp án thì tự phát audio để so với câu mình vừa nói
    if (card.direction === 'speak' && card.audioUrl) player.play([{ id: card.cardId, url: card.audioUrl }])
  }, [card, revealed, player])

  const answer = useCallback(
    async (rating: ReviewRating) => {
      if (!card || !revealed || busy) return
      setBusy(true)
      setError(null)
      try {
        const r = await call(api.answerReview(card.cardId, rating))
        setHistory((h) => [...h, { logId: r.logId, card, rating }])
        player.stop()
        await loadNext(card.vocabId)
      } catch (e) {
        setError(errMsg(e))
      } finally {
        setBusy(false)
      }
    },
    [card, revealed, busy, player, loadNext]
  )

  const undo = useCallback(async () => {
    const last = history[history.length - 1]
    if (!last || busy) return
    setBusy(true)
    try {
      await call(api.undoReview(last.logId))
      setHistory((h) => h.slice(0, -1))
      showCard(last.card)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }, [history, busy, showCard])

  // Phím tắt: cách = hiện đáp án / "Được", 1–4 = chấm, Ctrl+Z = hoàn tác, R = nghe lại
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        void undo()
      } else if (e.code === 'Space') {
        e.preventDefault()
        if (!revealed) reveal()
        else void answer(3) // giống Anki: đã hiện đáp án thì phím cách = "Được"
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        void answer(Number(e.key) as ReviewRating)
      } else if (e.key.toLowerCase() === 'r' && card?.audioUrl && (card.direction === 'listen' || revealed)) {
        replay()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reveal, answer, undo, revealed, card, replay])

  const c = card?.counts
  const remaining = c ? c.newCount + c.learningCount + c.reviewCount : 0
  const progress = card ? (history.length / Math.max(1, history.length + remaining)) * 100 : history.length ? 100 : 0
  // Nhóm của thẻ hiện tại được gạch chân trên bộ đếm
  const group = card ? (card.state === 0 ? 'new' : card.state === 2 ? 'review' : 'learn') : null

  const counter = (key: 'new' | 'learn' | 'review', value: number, label: string, color: string) => (
    <span
      className="flex items-baseline gap-1.5 border-b-2 pb-0.5"
      style={{ borderColor: group === key ? color : 'transparent' }}
    >
      <strong className="text-lg" style={{ color }}>
        {value}
      </strong>
      {label}
    </span>
  )

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-none flex-wrap items-center justify-between gap-3 px-7 py-3.5">
        <button type="button" onClick={() => nav({ page: 'home' })} className="btn btn-ghost h-9 gap-1 pl-1.5 pr-2.5">
          <ChevronLeft size={18} strokeWidth={2} />
          Trang chủ
        </button>
        <div aria-label="Số thẻ còn lại" className="flex items-center gap-[18px] text-[13px] text-fg3">
          {counter('new', c?.newCount ?? 0, 'Mới', 'var(--blue)')}
          {counter('learn', c?.learningCount ?? 0, 'Đang học', 'var(--err)')}
          {counter('review', c?.reviewCount ?? 0, 'Tới hạn', 'var(--known)')}
        </div>
        <button type="button" onClick={undo} disabled={history.length === 0 || busy} className="btn btn-secondary btn-sm border-line font-normal text-fg2">
          <Undo2 size={16} />
          Hoàn tác
          <Kbd>Ctrl Z</Kbd>
        </button>
      </header>
      <div className="h-[3px] flex-none bg-line">
        <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[728px] flex-col gap-5 px-6 py-10">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-fg3" size={24} />
            </div>
          ) : !card ? (
            // ----- Hết thẻ: tóm tắt phiên -----
            <SessionDone history={history} onUndo={undo} onHome={() => nav({ page: 'home' })} />
          ) : (
            <>
              <section aria-label="Thẻ ôn tập" className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-surface shadow-card">
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-[22px] py-4">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-fg2">
                    {card.direction === 'listen' ? <Headphones size={16} /> : <Mic size={16} />}
                    {card.direction === 'listen' ? 'Thẻ nghe' : 'Thẻ nói'}
                  </span>
                  <span className="h-[3px] w-[3px] rounded-full bg-fg3" />
                  <span className="text-[13px] text-fg3">{STATE_LABEL[card.state]}</span>
                  {card.isLeech && <span className="chip ml-auto bg-leech-soft px-2.5 text-leech">Từ hay quên</span>}
                </div>

                {!revealed ? (
                  card.direction === 'listen' ? (
                    <div className="flex flex-col items-center gap-[22px] px-8 pb-12 pt-14 text-center">
                      {card.audioUrl ? (
                        <button
                          type="button"
                          aria-label="Nghe lại câu"
                          onClick={replay}
                          className={
                            'flex h-[120px] w-[120px] items-center justify-center gap-[5px] rounded-full bg-accent-soft text-accent transition-transform hover:scale-[1.03] ' +
                            (player.isPlaying ? 'animate-pulse' : '')
                          }
                        >
                          {[22, 44, 30, 52, 26, 38, 18].map((h, i) => (
                            <span key={i} className="w-1.5 rounded-full bg-current" style={{ height: h }} />
                          ))}
                        </button>
                      ) : (
                        // Thẻ không có audio (hiếm): đành hiện chữ
                        <p className="m-0 font-serif text-xl">{card.sentenceEn ?? card.text}</p>
                      )}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-lg font-semibold">Nghe câu và nhớ nghĩa của cụm trong câu</span>
                        <span className="text-sm text-fg3">{card.audioUrl ? 'Chữ được ẩn — chỉ dựa vào tai' : 'Câu này chưa có audio'}</span>
                      </div>
                      {card.audioUrl && (
                        <button type="button" className="btn btn-secondary" onClick={replay}>
                          <Volume2 size={16} />
                          Nghe lại
                          <Kbd>R</Kbd>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-5 px-9 pb-12 pt-[52px] text-center">
                      <span className="text-[15px] text-fg2">Nói to câu tiếng Anh có dùng cụm mang nghĩa:</span>
                      <span className="text-[38px] font-bold leading-tight tracking-[-0.02em]">{card.meaningVi}</span>
                      {card.sentenceVi && <span className="max-w-[460px] text-base italic text-fg2">“{card.sentenceVi}”</span>}
                      <span className="flex items-center gap-2 rounded-full bg-surface2 px-3 py-2 text-[13px] text-fg3">
                        <Mic size={14} />
                        Nói xong rồi lật thẻ — audio sẽ tự phát để bạn so
                      </span>
                    </div>
                  )
                ) : (
                  <div className="fade-up flex flex-col gap-[18px] px-8 pb-7 pt-8">
                    <div className="flex flex-col items-center gap-1.5 text-center">
                      <span className="font-serif text-[34px] font-semibold leading-tight tracking-[-0.015em]">{card.text}</span>
                      <span className="text-[17px] text-fg2">{card.meaningVi}</span>
                    </div>
                    {card.sentenceEn && (
                      <div className="flex flex-col gap-1.5 rounded-xl bg-surface2 px-[18px] py-4">
                        <span className="font-serif text-[19px] leading-relaxed">{highlight(card.sentenceEn, card.text)}</span>
                        {card.sentenceVi && <span className="text-sm text-fg3">{card.sentenceVi}</span>}
                        {card.audioUrl && (
                          <button type="button" className="btn btn-secondary btn-sm mt-1 h-[34px] self-start font-medium" onClick={replay}>
                            <Volume2 size={15} />
                            Nghe lại
                            <Kbd>R</Kbd>
                          </button>
                        )}
                      </div>
                    )}
                    {card.isLeech && card.rescue && <LeechBox rescue={card.rescue} open />}
                  </div>
                )}
              </section>

              {!revealed ? (
                <button type="button" onClick={reveal} className="btn btn-ink h-14 rounded-[14px] text-base">
                  Hiện đáp án
                  <kbd className="rounded-md border border-current px-2 py-0.5 font-mono text-[11px] opacity-70">Space</kbd>
                </button>
              ) : (
                <div role="group" aria-label="Chấm mức nhớ" className="grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-2.5">
                  {BUTTONS.map((b) => (
                    <button
                      key={b.rating}
                      type="button"
                      onClick={() => answer(b.rating)}
                      disabled={busy}
                      className="flex h-[72px] flex-col items-center justify-center gap-0.5 rounded-[14px] transition-[filter] hover:brightness-95 disabled:opacity-60"
                      style={{ background: b.bg, color: b.c, border: b.rating === 3 ? `1.5px solid ${b.c}` : '1px solid transparent' }}
                    >
                      <span className="text-base font-bold">{b.label}</span>
                      <span className="text-xs text-fg2">
                        {card.intervals[b.rating]} · <kbd className="font-mono">{b.rating}</kbd>
                        {b.rating === 3 && ' / Space'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-x-[18px] gap-y-1.5 text-xs text-fg3">
                <span>Space · hiện đáp án / Được</span>
                <span>1–4 · chấm</span>
                <span>R · nghe lại</span>
                <span>Ctrl+Z · hoàn tác</span>
              </div>
            </>
          )}
          {error && <p className="m-0 rounded-[10px] bg-err-soft px-4 py-3 text-err">{error}</p>}
        </div>
      </main>
    </div>
  )
}

function SessionDone({
  history,
  onUndo,
  onHome
}: {
  history: { rating: ReviewRating }[]
  onUndo: () => void
  onHome: () => void
}) {
  const total = history.length
  const remembered = history.filter((h) => h.rating > 1).length
  const pct = total ? Math.round((remembered / total) * 100) : 0
  return (
    <section className="fade-up mt-6 flex flex-col items-center gap-[18px] rounded-[20px] border border-line bg-surface px-9 py-12 text-center shadow-card">
      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-known-soft text-known">
        <Check size={34} strokeWidth={2.4} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="page-title">{total > 0 ? 'Xong phiên ôn hôm nay!' : 'Không có thẻ nào cần ôn'}</h1>
        {total > 0 ? (
          <span className="text-base text-fg2">
            Bạn đã ôn <strong className="text-fg">{total} thẻ</strong>, nhớ được <strong className="text-known">{pct}%</strong> ({remembered}/{total})
          </span>
        ) : (
          <span className="text-base text-fg2">Hãy quay lại sau, hoặc tạo bài mới để có thêm thẻ.</span>
        )}
      </div>
      {total > 0 && (
        <div className="h-2 w-full max-w-[360px] overflow-hidden rounded-full bg-err-soft">
          <div className="h-full bg-known" style={{ width: `${pct}%` }} />
        </div>
      )}
      <span className="flex items-center gap-2 rounded-[10px] bg-surface2 px-3.5 py-2.5 text-[13px] text-fg2">
        <Clock size={16} className="flex-none" />
        Thẻ đang học (bước 1 phút / 10 phút) sẽ quay lại khi tới hạn — mở lại Ôn tập sau ít phút.
      </span>
      <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
        {total > 0 && (
          <button type="button" className="btn btn-secondary" onClick={onUndo}>
            <Undo2 size={16} />
            Hoàn tác thẻ vừa chấm
          </button>
        )}
        <button type="button" className="btn btn-ink px-5" onClick={onHome}>
          Về trang chủ
        </button>
      </div>
    </section>
  )
}
