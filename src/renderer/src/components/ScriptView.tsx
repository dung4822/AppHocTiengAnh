import { useEffect, useMemo, useRef, useState } from 'react'
import { Lightbulb, Pause, Play, Plus } from 'lucide-react'
import type { LessonChunk, PhraseNote, Sentence, SentenceNote, WordNote, WordState } from '@shared/types'
import { FreqMeter, SpeakerBadge, StatusChip, type Tone } from './ui'

interface Props {
  sentences: Sentence[]
  chunks: LessonChunk[]
  notes: SentenceNote[] | null // chú thích kiểu Language Reactor (null = chưa có)
  wordStates: Record<string, WordState> // trạng thái từng từ (kiểu LingQ)
  showTranslation: boolean
  playingId: number | null
  onPlaySentence: (s: Sentence) => void
  onLookup: (term: string, sentence: Sentence) => void
  onSave: (term: string, sentence: Sentence) => void // lưu thẻ qua tra từ (khi chưa có nghĩa theo ngữ cảnh)
  onSaveContext: (term: string, meaningVi: string, sentence: Sentence) => void // lưu thẻ với nghĩa đúng trong câu
  onSetStatus: (term: string, status: 'new' | 'known' | 'ignored') => void
  selectedTerm?: string | null // từ đang mở ở panel tra từ (viền tím)
}

const STATUS: Record<WordState['status'], { label: string; tone: Tone }> = {
  new: { label: 'Từ mới', tone: 'blue' },
  learning: { label: 'Đang học', tone: 'learn' },
  known: { label: 'Đã biết', tone: 'known' },
  ignored: { label: 'Đã bỏ qua', tone: 'neutral' }
}

// Khóa để tra trạng thái: dạng gốc từ chú thích, không có thì chính từ đó (viết thường)
const stateKey = (t: { text: string; note: WordNote | null }): string => (t.note?.base || t.text).toLowerCase()

// Một cụm trong câu: vị trí ký tự [start, end) + thông tin hiển thị
interface PhraseSpan {
  start: number
  end: number
  base: string
  vi: string
  kind: string // 'lesson' = cụm của bài (đã thành thẻ), còn lại theo chú thích AI
  note: string | null
}

interface Token {
  text: string
  start: number
  end: number
  note: WordNote | null
}

const KIND_LABEL: Record<string, string> = {
  lesson: 'Cụm của bài',
  phrasal_verb: 'Cụm động từ',
  collocation: 'Cụm hay đi với nhau',
  idiom: 'Thành ngữ',
  fixed_expression: 'Câu nói cố định',
  pattern: 'Cấu trúc'
}

const norm = (s: string): string => s.toLowerCase().replace(/[‘’]/g, "'")

// Tách câu thành các từ (có vị trí) và gắn nghĩa theo ngữ cảnh từ chú thích (khớp lần lượt theo thứ tự)
function tokenize(text: string, words: WordNote[] | undefined): Token[] {
  const out: Token[] = []
  const re = /[A-Za-z0-9][A-Za-z0-9'’-]*/g
  let m: RegExpExecArray | null
  let j = 0
  while ((m = re.exec(text))) {
    let note: WordNote | null = null
    if (words) {
      for (let k = j; k < Math.min(words.length, j + 4); k++) {
        if (norm(words[k].t).replace(/[^a-z0-9'-]/g, '') === norm(m[0])) {
          note = words[k]
          j = k + 1
          break
        }
      }
    }
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length, note })
  }
  return out
}

function findSpans(text: string, chunks: LessonChunk[], phrases: PhraseNote[] | undefined): PhraseSpan[] {
  const lower = norm(text)
  const spans: PhraseSpan[] = []
  for (const c of chunks) {
    const i = lower.indexOf(norm(c.text))
    if (i >= 0) spans.push({ start: i, end: i + c.text.length, base: c.text, vi: c.meaningVi, kind: 'lesson', note: null })
  }
  for (const p of phrases ?? []) {
    const i = lower.indexOf(norm(p.text))
    if (i < 0) continue
    // Trùng hẳn với cụm của bài thì bỏ (đã có)
    if (spans.some((s) => s.kind === 'lesson' && s.start === i && s.end === i + p.text.length)) continue
    spans.push({ start: i, end: i + p.text.length, base: p.base, vi: p.vi, kind: p.kind, note: p.note })
  }
  return spans
}

// Chọn các dải để "bọc" (tô liền một khối kể cả khoảng trắng): cụm của bài trước, rồi cụm khác.
// Các dải không được chồng lên nhau; biên được nới ra cho trọn từ.
function wrapRanges(spans: PhraseSpan[], tokens: Token[]): { start: number; end: number; lesson: boolean }[] {
  const chosen: { start: number; end: number; lesson: boolean }[] = []
  const sorted = [...spans].sort((a, b) => (a.kind === 'lesson' ? 0 : 1) - (b.kind === 'lesson' ? 0 : 1) || a.start - b.start)
  for (const s of sorted) {
    const first = tokens.find((t) => t.end > s.start)
    const last = [...tokens].reverse().find((t) => t.start < s.end)
    if (!first || !last) continue
    const r = { start: Math.min(s.start, first.start), end: Math.max(s.end, last.end), lesson: s.kind === 'lesson' }
    if (chosen.some((c) => r.start < c.end && c.start < r.end)) continue
    chosen.push(r)
  }
  return chosen.sort((a, b) => a.start - b.start)
}

interface Hover {
  sentence: Sentence
  token: Token
  phrases: PhraseSpan[]
  translation: string | null
  x: number
  top: number // khi hiện bên dưới từ
  bottom: number // khi hiện bên trên từ
  above: boolean
}

export default function ScriptView(props: Props) {
  const { sentences, chunks, notes, wordStates, showTranslation, playingId, onPlaySentence, onLookup, onSave, onSaveContext, onSetStatus, selectedTerm } =
    props
  const [hover, setHover] = useState<Hover | null>(null)
  const hideTimer = useRef<number | null>(null)
  const showTimer = useRef<number | null>(null)

  const noteByIdx = useMemo(() => new Map((notes ?? []).map((n) => [n.idx, n])), [notes])

  // Cuộn trang thì ẩn popup (popup dùng vị trí cố định theo cửa sổ)
  useEffect(() => {
    const hide = (e: Event): void => {
      if (e.target instanceof Element && e.target.closest('[data-word-popup]')) return
      setHover(null)
    }
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [])

  const cancelHide = (): void => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
  }
  const scheduleHide = (): void => {
    if (showTimer.current) window.clearTimeout(showTimer.current)
    cancelHide()
    hideTimer.current = window.setTimeout(() => setHover(null), 250)
  }

  const onEnterWord = (e: React.MouseEvent, s: Sentence, token: Token, spans: PhraseSpan[], translation: string | null): void => {
    cancelHide()
    if (showTimer.current) window.clearTimeout(showTimer.current)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // Đợi một chút mới hiện, để lướt chuột qua không bị nháy
    showTimer.current = window.setTimeout(() => {
      const phrases = spans.filter((p) => token.start >= p.start && token.end <= p.end)
      // Từ nằm ở nửa dưới cửa sổ → lật popup lên trên
      const above = rect.bottom > window.innerHeight * 0.55
      setHover({
        sentence: s,
        token,
        phrases,
        translation,
        x: Math.max(12, Math.min(rect.left - 40, window.innerWidth - 396)),
        top: rect.bottom + 10,
        bottom: window.innerHeight - rect.top + 10,
        above
      })
    }, 180)
  }

  // Bôi đen một đoạn trong câu → tra cả đoạn đó
  const onMouseUp = (s: Sentence): void => {
    const sel = window.getSelection()?.toString().trim()
    if (sel && sel.length > 1 && sel.length < 80) onLookup(sel, s)
  }

  const hoverWs = hover ? (wordStates[stateKey(hover.token)] ?? wordStates[hover.token.text.toLowerCase()]) : undefined

  return (
    <div className="flex flex-col gap-0.5">
      {sentences.map((s, si) => {
        const note = noteByIdx.get(s.idx)
        const sentenceChunks = chunks.filter((c) => c.sentenceIdx === s.idx || c.sentenceIdx === null)
        const spans = findSpans(s.text, sentenceChunks, note?.phrases)
        const tokens = tokenize(s.text, note?.words)
        const wraps = wrapRanges(spans, tokens)
        const playing = playingId === s.id

        const renderToken = (t: Token, i: number, wrapped: boolean): React.ReactNode => {
          const inChunk = spans.find((p) => p.kind === 'lesson' && t.start >= p.start && t.end <= p.end)
          // Từ nằm trong cụm khác nhưng cụm đó không bọc được (chồng lên cụm khác) → gạch chấm riêng từng từ
          const inPhrase = !wrapped && spans.some((p) => p.kind !== 'lesson' && t.start >= p.start && t.end <= p.end)
          const ws = wordStates[stateKey(t)] ?? wordStates[t.text.toLowerCase()]
          const isHover = hover?.sentence.id === s.id && hover.token.start === t.start
          const isSelected = !!selectedTerm && norm(selectedTerm) === norm(t.note?.base ?? t.text)
          return (
            <span
              key={'w' + i}
              className={
                'word' +
                (!inChunk && ws && ws.highlight !== 'none' ? ' ws-' + ws.highlight : '') +
                (inPhrase ? ' phrase-word' : '') +
                (isHover || isSelected ? ' selected' : '')
              }
              onMouseEnter={(e) => onEnterWord(e, s, t, spans, note?.vi ?? null)}
              onMouseLeave={scheduleHide}
              onClick={(e) => {
                e.stopPropagation()
                if (window.getSelection()?.toString().trim()) return
                // Bấm vào từ nằm trong cụm của bài → tra cả cụm; còn lại tra từ đơn
                onLookup(inChunk ? s.text.slice(inChunk.start, inChunk.end) : t.text, s)
              }}
            >
              {t.text}
            </span>
          )
        }

        // Ghép lại câu trong khoảng [from, to): từ (rê/bấm được) + phần còn lại (dấu câu, khoảng trắng)
        const renderRange = (from: number, to: number, wrapped: boolean, keyPrefix: string): React.ReactNode[] => {
          const out: React.ReactNode[] = []
          let pos = from
          tokens.forEach((t, i) => {
            if (t.start < from || t.end > to) return
            if (t.start > pos) out.push(<span key={keyPrefix + 'g' + i}>{s.text.slice(pos, t.start)}</span>)
            out.push(renderToken(t, i, wrapped))
            pos = t.end
          })
          if (pos < to) out.push(<span key={keyPrefix + 'end'}>{s.text.slice(pos, to)}</span>)
          return out
        }

        const parts: React.ReactNode[] = []
        let pos = 0
        wraps.forEach((w, wi) => {
          if (w.start > pos) parts.push(...renderRange(pos, w.start, false, `p${wi}-`))
          parts.push(
            <span
              key={'wrap' + wi}
              className={w.lesson ? 'rounded px-[3px] [box-decoration-break:clone] chunk-word' : 'phrase-word'}
            >
              {renderRange(w.start, w.end, true, `w${wi}-`)}
            </span>
          )
          pos = w.end
        })
        if (pos < s.text.length) parts.push(...renderRange(pos, s.text.length, false, 'tail-'))

        return (
          <div
            key={s.id}
            className={`script-line sp-${s.speaker}` + (playing ? ' playing' : '')}
            onClick={() => onPlaySentence(s)}
            onMouseUp={() => onMouseUp(s)}
          >
            <span className="pt-1">
              <SpeakerBadge speaker={s.speaker} />
            </span>
            <span className="pt-[3px]">
              <button
                type="button"
                aria-label={playing ? `Đang phát câu ${si + 1}` : `Nghe câu ${si + 1}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onPlaySentence(s)
                }}
                disabled={!s.audioUrl}
                className={
                  'round-btn h-[30px] w-[30px] ' + (playing ? 'border-transparent bg-accent text-white hover:text-white' : '')
                }
              >
                {playing ? <Pause size={12} fill="currentColor" strokeWidth={0} /> : <Play size={12} fill="currentColor" strokeWidth={0} />}
              </button>
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="script-text">{parts}</p>
              {showTranslation && note?.vi && <p className="m-0 text-sm text-fg3">{note.vi}</p>}
            </div>
          </div>
        )
      })}

      {hover && (
        <div
          role="dialog"
          aria-label={`Chú thích từ ${hover.token.text}`}
          data-word-popup
          className="fade-up fixed z-40 flex w-[384px] flex-col overflow-hidden rounded-[14px] border border-line2 bg-surface text-left font-sans text-sm text-fg shadow-pop"
          style={hover.above ? { left: hover.x, bottom: hover.bottom } : { left: hover.x, top: hover.top }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          onClick={(e) => e.stopPropagation()}
        >
          {hover.phrases.map((p, i) => {
            const text = hover.sentence.text.slice(p.start, p.end)
            return (
              <div key={i} className="flex flex-col gap-2.5 border-b border-line bg-surface2 px-4 pb-3.5 pt-4">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-accent-text">{KIND_LABEL[p.kind] ?? 'Cụm từ'}</span>
                  {norm(p.base) !== norm(text) && (
                    <span className="truncate text-xs text-fg3">
                      trong câu: <em className="font-serif">{text}</em>
                    </span>
                  )}
                </span>
                <span className="font-serif text-[22px] font-semibold leading-tight tracking-[-0.01em]">{p.base}</span>
                <span>{p.vi}</span>
                {p.note && (
                  <span className="flex gap-2 rounded-[10px] bg-surface px-3 py-2.5 text-[13px] text-fg2">
                    <Lightbulb size={16} className="mt-0.5 flex-none text-learn" />
                    <span>{p.note}</span>
                  </span>
                )}
                <span className="flex gap-2">
                  {p.kind !== 'lesson' && (
                    <button type="button" className="btn btn-primary btn-sm h-[34px]" onClick={() => onSaveContext(p.base, p.vi, hover.sentence)}>
                      <Plus size={14} strokeWidth={2.4} />
                      Học cụm này
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm h-[34px] font-medium"
                    onClick={() => onLookup(p.kind === 'lesson' ? text : p.base, hover.sentence)}
                  >
                    Tra kỹ
                  </button>
                </span>
              </div>
            )
          })}

          <div className="flex flex-col gap-2 px-4 py-3.5">
            <span className="flex items-center justify-between gap-2">
              {hoverWs ? (
                <StatusChip tone={STATUS[hoverWs.status].tone} className="text-[11px] uppercase tracking-[0.06em]">
                  {STATUS[hoverWs.status].label}
                </StatusChip>
              ) : (
                <span />
              )}
              {hover.token.note?.freq && (
                <span className="text-xs text-fg3">
                  <FreqMeter label={hover.token.note.freq} />
                </span>
              )}
            </span>
            <span className="flex items-baseline gap-2 font-serif text-[17px]">
              <strong className="font-semibold">{hover.token.text}</strong>
              {hover.token.note && norm(hover.token.note.base) !== norm(hover.token.text) && (
                <>
                  <span className="font-sans text-[13px] text-fg3">→</span>
                  <span>{hover.token.note.base}</span>
                </>
              )}
            </span>
            {hover.token.note ? (
              <span className="text-fg2">{hover.token.note.vi}</span>
            ) : (
              <span className="text-[13px] text-fg3">Bấm “Tra kỹ” để xem nghĩa</span>
            )}
            <span className="flex flex-wrap gap-1.5">
              {(() => {
                const base = hover.token.note?.base ?? hover.token.text
                const singleWord = !/[\s']/.test(base)
                return (
                  <>
                    {hoverWs?.status !== 'learning' && (
                      <button
                        type="button"
                        className="btn btn-primary btn-xs font-semibold"
                        onClick={() =>
                          hover.token.note ? onSaveContext(base, hover.token.note.vi, hover.sentence) : onSave(base, hover.sentence)
                        }
                      >
                        <Plus size={14} strokeWidth={2.4} />
                        Học từ này
                      </button>
                    )}
                    {singleWord && hoverWs?.status !== 'known' && hoverWs?.status !== 'learning' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => onSetStatus(base, 'known')}
                        title="Từ này mình biết rồi, không cần tô nữa"
                      >
                        Đã biết
                      </button>
                    )}
                    {singleWord && (hoverWs?.status === 'known' || hoverWs?.status === 'ignored') && (
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => onSetStatus(base, 'new')}>
                        Đánh dấu chưa biết
                      </button>
                    )}
                    {singleWord && hoverWs?.status === 'new' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => onSetStatus(base, 'ignored')}
                        title="Tên riêng, từ không cần học"
                      >
                        Bỏ qua
                      </button>
                    )}
                    <button type="button" className="btn btn-secondary btn-xs" onClick={() => onLookup(base, hover.sentence)}>
                      Tra kỹ
                    </button>
                  </>
                )
              })()}
            </span>
          </div>
          {hover.translation && <span className="border-t border-line px-4 py-3 text-[13px] italic text-fg2">{hover.translation}</span>}
        </div>
      )}
    </div>
  )
}
