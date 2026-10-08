import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  AudioLines,
  CircleAlert,
  EyeOff,
  Flag,
  Info,
  Loader2,
  MessageCircle,
  RefreshCw,
  Repeat,
  Trash2,
  Volume2
} from 'lucide-react'
import type { LessonDetail, ProgressEvent, Question, Sentence } from '@shared/types'
import { api, call, errMsg, forgetLessonStep, getLessonStep, saveLessonStep } from '../api'
import { useApp } from '../appState'
import { usePlayer } from '../usePlayer'
import LookupPanel from '../components/LookupPanel'
import ScriptView from '../components/ScriptView'
import GrammarDeepView from '../components/GrammarDeepView'
import LessonHeader, { type Step } from '../components/LessonHeader'
import { BigPlayer, CompactPlayer, FooterPlayer, type PlayerCtl } from '../components/LessonPlayers'
import { IndeterminateBar, ProgressBar } from '../components/ui'

const TYPE_LABEL: Record<Question['type'], string> = {
  main_idea: 'Ý chính',
  detail: 'Chi tiết',
  inference: 'Suy luận',
  grammar_meaning: 'Ý nghĩa ngữ pháp',
  opinion: 'Ý kiến của bạn'
}
const RESULT = {
  full: { label: 'Đúng', c: 'var(--known)', bg: 'var(--known-soft)' },
  partial: { label: 'Đúng một phần', c: 'var(--leech)', bg: 'var(--leech-soft)' },
  none: { label: 'Chưa đúng', c: 'var(--err)', bg: 'var(--err-soft)' }
}

export default function LessonPage({ lessonId }: { lessonId: number }) {
  const { nav, toast, errorToast, refresh: refreshApp, stats } = useApp()
  const [lesson, setLesson] = useState<LessonDetail | null>(null)
  const [step, setStepState] = useState<Step>(1)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [grading, setGrading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lookup, setLookup] = useState<{ term: string; sentenceId: number } | null>(null)
  const [audioProgress, setAudioProgress] = useState<ProgressEvent | null>(null)
  const [resuming, setResuming] = useState(false)
  // Bổ sung giải thích ngữ pháp chi tiết + chú thích script (bài cũ chưa có thì tự tạo khi mở)
  const [enriching, setEnriching] = useState(false)
  const [enrichError, setEnrichError] = useState<string | null>(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteVocabToo, setDeleteVocabToo] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [markKnown, setMarkKnown] = useState(true)
  const [finishing, setFinishing] = useState(false)
  const [cursor, setCursor] = useState(0)
  const player = usePlayer('lesson')
  const scrollRef = useRef<HTMLElement>(null)

  const setStep = (s: Step): void => {
    setStepState(s)
    saveLessonStep(lessonId, s)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const load = async (): Promise<LessonDetail | null> => {
    try {
      const l = await call(api.getLesson(lessonId))
      setLesson(l)
      return l
    } catch (e) {
      setError(errMsg(e))
      return null
    }
  }

  const enrich = async (): Promise<void> => {
    setEnriching(true)
    setEnrichError(null)
    try {
      setLesson(await call(api.enrichLesson(lessonId)))
    } catch (e) {
      setEnrichError(errMsg(e))
    } finally {
      setEnriching(false)
    }
  }

  useEffect(() => {
    load().then((l) => {
      if (!l) return
      // Mở lại đúng bước đang học dở; bài đã chấm rồi thì mở thẳng phần kết quả
      const saved = getLessonStep(lessonId)
      const initial: Step = saved ? (saved.step as Step) : l.questions.some((q) => q.lastAnswer) ? 3 : 1
      setStepState(initial)
      saveLessonStep(lessonId, initial)
      if (!l.grammarDeep || !l.annotations) void enrich()
    })
    const off = api.onProgress(setAudioProgress)
    return () => {
      off()
      player.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  // Câu đang phát → con trỏ (bấm ▶ lần sau sẽ phát tiếp từ đó)
  const playingIdx = lesson && player.playingId !== null ? lesson.sentences.findIndex((s) => s.id === player.playingId) : -1
  useEffect(() => {
    if (playingIdx >= 0) setCursor(playingIdx)
  }, [playingIdx])

  if (!lesson) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        {error ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="m-0 text-err">{error}</p>
            <button type="button" className="btn btn-secondary" onClick={() => nav({ page: 'home' })}>
              Về trang chủ
            </button>
          </div>
        ) : (
          <Loader2 className="animate-spin text-fg3" size={24} />
        )}
      </div>
    )
  }

  const sentences = lesson.sentences
  const allItems = sentences.map((s) => ({ id: s.id, url: s.audioUrl }))
  const missingCount = sentences.filter((s) => !s.audioUrl).length
  const missingAudio = missingCount > 0
  const graded = lesson.questions.some((q) => q.lastAnswer)
  const n = sentences.length

  // ===== Bộ điều khiển trình phát =====
  const currentIdx = playingIdx >= 0 ? playingIdx : Math.min(cursor, n - 1)
  const ctl: PlayerCtl = {
    sentences,
    player,
    currentIdx,
    playingAll: player.queueLength > 1,
    toggle: () => {
      if (player.isPlaying) return player.stop()
      const start = cursor >= n - 1 ? 0 : cursor
      player.play(allItems, sentences[start].id)
    },
    prev: () => {
      if (player.isPlaying && player.queueLength > 1) player.skip(-1)
      else if (player.isPlaying) player.play(allItems, sentences[Math.max(0, playingIdx - 1)].id)
      else setCursor((c) => Math.max(0, c - 1))
    },
    next: () => {
      if (player.isPlaying && player.queueLength > 1) player.skip(1)
      else if (player.isPlaying) player.play(allItems, sentences[Math.min(n - 1, playingIdx + 1)].id)
      else setCursor((c) => Math.min(n - 1, c + 1))
    },
    playFromIndex: (i) => player.play(allItems, sentences[i].id)
  }

  const playEvidence = (q: Question): void =>
    player.play(sentences.filter((s) => q.evidenceIdxs.includes(s.idx)).map((s) => ({ id: s.id, url: s.audioUrl })))
  const playSentence = (s: Sentence): void => player.play([{ id: s.id, url: s.audioUrl }])

  // Các bước đã xong (hiện ✓ trên stepper)
  const maxReached = getLessonStep(lessonId)?.max ?? step
  const doneSteps = new Set<number>()
  for (let i = 1; i < Math.max(maxReached, step); i++) doneSteps.add(i)
  if (graded) [1, 2].forEach((i) => doneSteps.add(i))
  if (lesson.status === 'done') [1, 2, 3, 4, 5].forEach((i) => doneSteps.add(i))

  const resumeAudio = async (): Promise<void> => {
    setResuming(true)
    setAudioProgress(null)
    setError(null)
    try {
      await call(api.resumeAudio(lessonId))
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setResuming(false)
    }
  }

  const submit = async (): Promise<void> => {
    setGrading(true)
    setError(null)
    try {
      const inputs = lesson.questions.map((q) => ({ questionId: q.id, answer: answers[q.id] ?? '' }))
      const updated = await call(api.gradeAnswers(lessonId, inputs))
      setLesson(updated)
      setStep(3)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setGrading(false)
    }
  }

  const redo = (): void => {
    setAnswers({})
    setStep(2)
  }

  // Sau khi đổi trạng thái từ / lưu thẻ → tải lại bài để cập nhật màu trong script
  const refresh = async (): Promise<void> => {
    try {
      setLesson(await call(api.getLesson(lessonId)))
    } catch {
      /* bỏ qua: chỉ là làm mới màu */
    }
  }

  const saveCard = async (term: string, s: Sentence): Promise<void> => {
    try {
      const r = await call(api.saveLookupAsCard(term, { lessonId, sentenceId: s.id }))
      toast(r.alreadyExisted ? `“${term}” đã có trong thẻ rồi` : `Đã thêm “${term}” vào thẻ học`)
      await refresh()
    } catch (e) {
      errorToast('Chưa lưu được thẻ', errMsg(e))
    }
  }

  const saveFromContext = async (term: string, meaningVi: string, s: Sentence): Promise<void> => {
    try {
      const r = await call(api.saveFromContext({ term, meaningVi, sentenceId: s.id }))
      toast(r.alreadyExisted ? `“${term}” đã có trong thẻ rồi` : `Đã thêm “${term}” vào thẻ học`)
      await refresh()
    } catch (e) {
      errorToast('Chưa lưu được thẻ', errMsg(e))
    }
  }

  const setWordStatus = async (term: string, status: 'new' | 'known' | 'ignored'): Promise<void> => {
    try {
      await call(api.setWordStatus(term, status))
      toast(status === 'known' ? `“${term}”: đã biết` : status === 'ignored' ? `Đã bỏ qua “${term}”` : `“${term}”: chưa biết`)
      await refresh()
    } catch (e) {
      errorToast('Chưa đổi được trạng thái từ', errMsg(e))
    }
  }

  const doDelete = async (): Promise<void> => {
    setDeleting(true)
    try {
      player.stop()
      await call(api.deleteLesson(lessonId, deleteVocabToo))
      forgetLessonStep(lessonId)
      toast(`Đã xóa bài “${lesson.title}”`)
      nav({ page: 'home' })
    } catch (e) {
      setError(errMsg(e))
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const finish = async (): Promise<void> => {
    setFinishing(true)
    try {
      await call(api.finishLesson(lessonId, markKnown))
      await load()
      refreshApp()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setFinishing(false)
    }
  }

  // ===== Điểm phần câu hỏi =====
  const answered = lesson.questions.filter((q) => q.lastAnswer)
  const nFull = answered.filter((q) => q.lastAnswer!.result === 'full').length
  const nPart = answered.filter((q) => q.lastAnswer!.result === 'partial').length
  const nNone = answered.filter((q) => q.lastAnswer!.result === 'none').length
  const score = nFull + nPart * 0.5
  const ratio = lesson.questions.length ? score / lesson.questions.length : 0
  const resultTitle =
    nFull === lesson.questions.length
      ? 'Bạn hiểu rất tốt cả bài'
      : ratio >= 0.6
        ? 'Bạn hiểu ý chính, còn sót vài chi tiết'
        : ratio >= 0.3
          ? 'Bạn hiểu được một phần bài'
          : 'Bài này hơi khó — nghe lại cùng script nhé'
  const filledCount = lesson.questions.filter((q) => (answers[q.id] ?? '').trim()).length

  const wide = step === 4

  return (
    <div className="flex h-full flex-col">
      <LessonHeader
        lesson={lesson}
        step={step}
        doneSteps={doneSteps}
        onStep={setStep}
        onBack={() => nav({ page: 'home' })}
        onDelete={() => setConfirmDelete(true)}
      />

      <div className="flex min-h-0 flex-1">
        <main ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
          <div className={'mx-auto flex w-full flex-col px-6 pb-14 ' + (wide ? 'max-w-[868px] gap-5 pt-7' : 'max-w-[808px] gap-[22px] pt-9')}>
            {/* ===== Banner ===== */}
            {confirmDelete && (
              <section role="alertdialog" aria-labelledby="del-h" className="fade-up flex flex-col gap-3.5 rounded-[14px] border-[1.5px] border-err bg-surface px-[22px] py-5 shadow-card">
                <div className="flex items-start gap-3.5">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-err-soft text-err">
                    <Trash2 size={18} />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h2 id="del-h" className="m-0 text-base font-bold">
                      Xóa vĩnh viễn bài “{lesson.title}”?
                    </h2>
                    <span className="text-fg2">
                      Script, câu hỏi, câu trả lời và toàn bộ audio của bài sẽ bị xóa. Không khôi phục được. Điểm ngữ pháp của bài sẽ được dạy lại ở bài sau.
                    </span>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 pl-[50px]">
                  <input
                    type="checkbox"
                    checked={deleteVocabToo}
                    onChange={(e) => setDeleteVocabToo(e.target.checked)}
                    className="m-0 h-[18px] w-[18px] accent-err"
                  />
                  Xóa luôn các thẻ từ vựng chỉ có trong bài này (cụm có ở bài khác thì giữ lại)
                </label>
                <div className="flex gap-2 pl-[50px]">
                  <button type="button" className="btn btn-danger h-10 px-4" onClick={doDelete} disabled={deleting}>
                    {deleting ? 'Đang xóa…' : 'Xóa vĩnh viễn'}
                  </button>
                  <button type="button" className="btn btn-secondary h-10 px-4" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                    Hủy
                  </button>
                </div>
              </section>
            )}

            {enriching && (
              <section role="status" className="flex flex-col gap-2.5 rounded-[14px] bg-accent-soft px-5 py-4">
                <div className="flex items-start gap-3">
                  <Loader2 size={20} className="mt-0.5 flex-none animate-spin text-accent" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-accent-text">AI đang viết giải thích ngữ pháp và chú thích từng từ trong script</span>
                    <span className="text-[13px] text-fg2">Thường mất 1–2 phút. Bạn cứ nghe bài trước, phần này sẽ tự hiện khi xong.</span>
                  </div>
                </div>
                <div className="ml-8">
                  <IndeterminateBar />
                </div>
              </section>
            )}

            {enrichError && !enriching && (
              <section role="alert" className="flex flex-wrap items-center gap-3 rounded-[14px] bg-err-soft px-5 py-3.5">
                <CircleAlert size={18} className="flex-none text-err" />
                <span className="min-w-[240px] flex-1">
                  <strong className="text-err">Chưa bổ sung được nội dung.</strong> {enrichError} Bài nghe vẫn dùng được bình thường.
                </span>
                <button type="button" className="btn btn-danger-outline btn-sm" onClick={enrich}>
                  Thử lại
                </button>
              </section>
            )}

            {missingAudio &&
              (resuming ? (
                <section role="status" className="flex flex-col gap-2.5 rounded-[14px] bg-leech-soft px-5 py-4">
                  <div className="flex justify-between gap-3">
                    <span className="font-semibold text-leech">{audioProgress?.message ?? 'Đang chuẩn bị…'}</span>
                    {audioProgress?.total ? (
                      <span className="font-mono text-[13px] text-fg2">{Math.round(((audioProgress.current ?? 0) / audioProgress.total) * 100)}%</span>
                    ) : null}
                  </div>
                  {audioProgress?.total ? (
                    <ProgressBar value={((audioProgress.current ?? 0) / audioProgress.total) * 100} color="var(--leech)" track="var(--surface)" height={6} />
                  ) : (
                    <IndeterminateBar color="var(--leech)" />
                  )}
                </section>
              ) : (
                <section className="flex flex-wrap items-center gap-3 rounded-[14px] bg-leech-soft px-5 py-4">
                  <AudioLines size={20} className="flex-none text-leech" />
                  <div className="flex min-w-[240px] flex-1 flex-col">
                    <span className="font-semibold text-leech">Bài này chưa có đủ audio</span>
                    <span className="text-[13px] text-fg2">
                      Lần tạo trước bị gián đoạn. Còn thiếu {missingCount}/{n} câu — audio đã có được giữ nguyên.
                    </span>
                  </div>
                  <button type="button" className="btn h-10 bg-leech px-4 text-white" onClick={resumeAudio}>
                    Tạo nốt audio
                  </button>
                </section>
              ))}

            {error && (
              <section role="alert" className="flex items-center gap-3 rounded-[14px] bg-err-soft px-5 py-3.5">
                <CircleAlert size={18} className="flex-none text-err" />
                <span className="flex-1">{error}</span>
              </section>
            )}

            {/* ===== Bước 1 · Nghe ===== */}
            {step === 1 && (
              <>
                <div className="flex flex-col gap-2.5">
                  <span className="eyebrow">Bước 1 · Nghe hiểu ý</span>
                  <h2 className="m-0 text-2xl font-bold tracking-[-0.02em]">Nghe để nắm ý chính, chưa cần hiểu từng chữ</h2>
                  <div className="flex flex-wrap gap-2">
                    {[
                      [<EyeOff key="i" size={14} />, 'Script đang ẩn'],
                      [<Repeat key="i" size={14} />, 'Nghe 1–2 lần'],
                      [<Info key="i" size={14} />, 'Đoán ý từ ngữ cảnh, đừng dừng lại']
                    ].map(([icon, t], i) => (
                      <span key={i} className="chip border border-line bg-surface px-3 py-1.5 text-[13px] font-normal text-fg2">
                        {icon}
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <BigPlayer ctl={ctl} />
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-[13px] text-fg3">Nghe xong rồi? Bạn vẫn có thể nghe lại ở bước sau.</span>
                  <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
                    Sang bước trả lời
                    <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}

            {/* ===== Bước 2 · Trả lời ===== */}
            {step === 2 && (
              <>
                <div className="flex flex-col gap-2">
                  <span className="eyebrow">Bước 2 · Trả lời</span>
                  <h2 className="m-0 text-2xl font-bold tracking-[-0.02em]">Bạn hiểu được bao nhiêu?</h2>
                  <span className="text-sm text-fg2">Trả lời bằng tiếng Việt hoặc tiếng Anh đều được. Chỉ cần đúng ý. Cần thì nghe lại.</span>
                </div>
                <CompactPlayer ctl={ctl} />
                {lesson.questions.map((q, i) => (
                  <div key={q.id} className="card flex flex-col gap-3 p-5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13px] font-bold text-fg3">Câu {i + 1}</span>
                      <span className="chip bg-surface2 px-2 text-[11px] text-fg2">{TYPE_LABEL[q.type]}</span>
                    </div>
                    <label className="flex flex-col gap-2.5">
                      <span className="text-base font-semibold">{q.question}</span>
                      <textarea
                        rows={3}
                        className="textarea"
                        value={answers[q.id] ?? ''}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        placeholder="Viết câu trả lời…"
                      />
                    </label>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[13px] text-fg3">
                    Đã trả lời {filledCount}/{lesson.questions.length} câu · câu bỏ trống vẫn được chấm
                  </span>
                  <button type="button" className="btn btn-primary h-[46px] px-[22px] text-[15px]" onClick={submit} disabled={grading}>
                    {grading && <Loader2 size={16} className="animate-spin" />}
                    {grading ? 'AI đang chấm…' : 'Nộp bài để chấm'}
                  </button>
                </div>
              </>
            )}

            {/* ===== Bước 3 · Kết quả ===== */}
            {step === 3 && (
              <>
                {graded ? (
                  <div className="card flex flex-wrap items-center justify-between gap-[18px] rounded-2xl px-6 py-[22px]">
                    <div className="flex flex-col gap-1">
                      <span className="eyebrow">Bước 3 · Kết quả</span>
                      <span className="text-[22px] font-bold tracking-[-0.02em]">{resultTitle}</span>
                      <span className="flex flex-wrap gap-3.5 text-[13px] text-fg2">
                        {[
                          [nFull, 'đúng', 'var(--known)'],
                          [nPart, 'một phần', 'var(--leech)'],
                          [nNone, 'chưa đúng', 'var(--err)']
                        ].map(([v, t, c]) => (
                          <span key={t as string} className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: c as string }} />
                            {v} {t}
                          </span>
                        ))}
                      </span>
                    </div>
                    <div aria-hidden="true" className="flex gap-1">
                      {lesson.questions.map((q) => (
                        <span
                          key={q.id}
                          className="h-7 w-7 rounded-md"
                          style={{ background: q.lastAnswer ? RESULT[q.lastAnswer.result].c : 'var(--line2)' }}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
                    <span className="eyebrow">Bước 3 · Kết quả</span>
                    <span className="text-lg font-bold">Bạn chưa trả lời câu hỏi</span>
                    <span className="text-fg2">Quay lại bước 2 để trả lời, AI sẽ chấm và nhận xét bằng tiếng Việt.</span>
                    <button type="button" className="btn btn-primary mt-1" onClick={() => setStep(2)}>
                      Sang bước trả lời
                    </button>
                  </div>
                )}

                {graded &&
                  lesson.questions.map((q, i) => {
                    const a = q.lastAnswer
                    const r = a ? RESULT[a.result] : null
                    return (
                      <div key={q.id} className="flex flex-col gap-3 rounded-[14px] bg-surface p-5" style={{ border: `1.5px solid ${r?.c ?? 'var(--line)'}` }}>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-[13px] font-bold text-fg3">Câu {i + 1}</span>
                          <span className="chip bg-surface2 px-2 text-[11px] text-fg2">{TYPE_LABEL[q.type]}</span>
                          {r && (
                            <span className="chip ml-auto px-2.5 py-[3px] font-bold" style={{ background: r.bg, color: r.c }}>
                              {r.label}
                            </span>
                          )}
                        </div>
                        <span className="text-base font-semibold">{q.question}</span>
                        {a && (
                          <>
                            <div className="flex flex-col gap-0.5 rounded-[10px] bg-surface2 px-3 py-2.5">
                              <span className="text-xs text-fg3">Bạn trả lời</span>
                              <span className={'text-[15px] ' + (a.userAnswer ? '' : 'italic text-fg3')}>{a.userAnswer || '(bỏ trống)'}</span>
                            </div>
                            <span className="text-sm">{a.feedbackVi}</span>
                            {a.naturalVersion && (
                              <span className="flex gap-2 text-sm text-fg2">
                                <MessageCircle size={16} className="mt-[3px] flex-none text-accent" />
                                <span>
                                  <strong className="text-fg">Cách nói tự nhiên:</strong> <span className="font-serif">{a.naturalVersion}</span>
                                </span>
                              </span>
                            )}
                          </>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          {q.evidenceIdxs.length > 0 ? (
                            <button type="button" className="btn btn-secondary btn-sm font-medium" onClick={() => playEvidence(q)}>
                              <Volume2 size={15} />
                              Nghe đoạn chứa đáp án
                            </button>
                          ) : (
                            <span />
                          )}
                          {q.attempts > 1 && <span className="text-xs text-fg3">Đã làm {q.attempts} lần (hiện lượt mới nhất)</span>}
                        </div>
                      </div>
                    )
                  })}

                {graded && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button type="button" className="btn btn-secondary" onClick={redo}>
                        <RefreshCw size={16} />
                        Làm lại câu hỏi
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => setStep(4)}>
                        Xem script
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <span className="text-right text-xs text-fg3">Làm lại sẽ lưu thành lượt mới, không ghi đè lượt cũ.</span>
                  </>
                )}
              </>
            )}

            {/* ===== Bước 4 · Script ===== */}
            {step === 4 && (
              <>
                <div className="card flex flex-col gap-3 px-[18px] py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[13px] text-fg2">Rê chuột vào từ để xem nghĩa · Bấm để tra kỹ · Bôi đen để tra cả đoạn · Bấm vào câu để nghe lại</span>
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                      <input type="checkbox" className="m-0 h-[18px] w-[18px]" checked={showTranslation} onChange={(e) => setShowTranslation(e.target.checked)} />
                      Hiện bản dịch tiếng Việt từng câu
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-fg2">
                    <span className="flex items-center gap-1.5">
                      <span className="rounded bg-blue-hl px-1.5 font-serif text-fg">word</span>Từ mới
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="rounded bg-learn-hi1 px-1.5 font-serif text-fg">word</span>Đang học · còn yếu
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="rounded bg-learn-hi2 px-1.5 font-serif text-fg">word</span>Đang học · đã khá
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="chunk-word rounded px-1.5 font-serif">a phrase</span>Cụm của bài (đã lưu thẻ)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="phrase-word font-serif text-fg">a phrase</span>Cụm đáng để ý
                    </span>
                  </div>
                </div>
                {!lesson.annotations && (
                  <span className="flex items-center gap-2 text-[13px] text-fg3">
                    <Loader2 size={14} className="animate-spin" />
                    Chú thích từng từ đang được tạo…
                  </span>
                )}
                <ScriptView
                  sentences={sentences}
                  chunks={lesson.chunks}
                  notes={lesson.annotations}
                  wordStates={lesson.wordStates}
                  showTranslation={showTranslation}
                  playingId={player.playingId}
                  onPlaySentence={playSentence}
                  onLookup={(term, s) => setLookup({ term, sentenceId: s.id })}
                  onSave={saveCard}
                  onSaveContext={saveFromContext}
                  onSetStatus={setWordStatus}
                  selectedTerm={lookup?.term ?? null}
                />
                {lesson.chunks.length > 0 && (
                  <section className="card mt-4 flex flex-col gap-3 p-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="m-0 text-base font-bold">Các cụm trong bài</h3>
                      <span className="text-xs text-fg3">đã tự động lưu thành thẻ ôn</span>
                    </div>
                    <div className="flex flex-col">
                      {lesson.chunks.map((c, i) => (
                        <button
                          key={c.vocabId}
                          type="button"
                          onClick={() => {
                            const s = sentences.find((x) => x.idx === c.sentenceIdx) ?? sentences[0]
                            setLookup({ term: c.text, sentenceId: s.id })
                          }}
                          className={'flex items-baseline gap-3 py-2 text-left hover:text-accent-text ' + (i ? 'border-t border-line' : '')}
                        >
                          <span className="font-serif text-base font-semibold">{c.text}</span>
                          <span className="flex-1 text-fg2">{c.meaningVi}</span>
                          {c.isReview && <span className="chip bg-surface2 text-[11px] text-fg3">ôn</span>}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* ===== Bước 5 · Ngữ pháp ===== */}
            {step === 5 && (
              <article className="flex flex-col gap-10 pt-1">
                <div className="flex flex-col gap-3.5">
                  <span className="eyebrow">Bước 5 · Ngữ pháp của bài</span>
                  <h2 className="m-0 text-[32px] font-bold leading-tight tracking-[-0.025em]">{lesson.grammarDeep?.title_vi || lesson.grammarName}</h2>
                  {lesson.grammarDeep?.hook && <p className="m-0 text-[17px] text-fg2">{lesson.grammarDeep.hook}</p>}
                </div>

                {lesson.grammarDeep ? (
                  <GrammarDeepView deep={lesson.grammarDeep} sentences={sentences} onPlay={playSentence} />
                ) : (
                  <section className="flex flex-col gap-4">
                    {enriching && <span className="text-[13px] text-fg3">Đang viết giải thích chi tiết, tạm xem bản tóm tắt bên dưới…</span>}
                    <div className="card flex flex-col">
                      {[
                        ['Cấu trúc', lesson.grammar.form],
                        ['Khi nào dùng', lesson.grammar.when],
                        ['Người nói muốn nói gì', lesson.grammar.meaning],
                        ['So với tiếng Việt', lesson.grammar.vs_vietnamese]
                      ].map(([k, v], i) => (
                        <div key={k} className={'grid grid-cols-[160px_minmax(0,1fr)] gap-4 px-5 py-3.5 ' + (i ? 'border-t border-line' : '')}>
                          <span className="font-medium text-fg3">{k}</span>
                          <span>{v}</span>
                        </div>
                      ))}
                    </div>
                    {lesson.grammar.examples.length > 0 && (
                      <div className="card flex flex-col">
                        {lesson.grammar.examples.map((ex, i) => (
                          <div key={i} className={'flex flex-col px-[18px] py-3.5 ' + (i ? 'border-t border-line' : '')}>
                            <span className="font-serif text-lg">{ex.en}</span>
                            <span className="text-sm text-fg3">{ex.vi}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Hoàn thành bài */}
                {lesson.status === 'done' ? (
                  <section className="flex flex-col items-center gap-3.5 rounded-[20px] bg-known-soft p-8 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-known text-white">
                      <Flag size={24} />
                    </span>
                    <span className="text-xl font-bold">Bạn đã hoàn thành bài này</span>
                    <div className="flex flex-wrap justify-center gap-2.5">
                      {(stats?.dueToday ?? 0) > 0 && (
                        <button type="button" className="btn btn-ink" onClick={() => nav({ page: 'review' })}>
                          Ôn {stats!.dueToday} thẻ
                        </button>
                      )}
                      <button type="button" className="btn btn-secondary" onClick={() => nav({ page: 'home' })}>
                        Về trang chủ
                      </button>
                    </div>
                  </section>
                ) : (
                  <section aria-labelledby="done-h" className="flex flex-col gap-[22px] rounded-[20px] border border-line bg-surface p-8 shadow-card">
                    <div className="flex items-center gap-4">
                      <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[14px] bg-accent-soft text-accent">
                        <Flag size={24} />
                      </span>
                      <div className="flex flex-col">
                        <h2 id="done-h" className="m-0 text-[22px] font-bold tracking-[-0.02em]">
                          Sắp xong rồi!
                        </h2>
                        <span className="text-fg2">Bạn đã đi hết 5 bước của bài này.</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-2.5">
                      <MiniStat value={`${lesson.chunks.length} cụm`} label="đã tự lưu thành thẻ" />
                      <MiniStat
                        value={graded ? `${String(score).replace('.', ',')}/${lesson.questions.length}` : '—'}
                        label="câu hỏi hiểu ý"
                      />
                      {stats && <MiniStat value={`${stats.coreTaught}/${stats.coreTotal}`} label="điểm ngữ pháp core" />}
                    </div>
                    {lesson.newWordCount > 0 && (
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line2 p-4">
                        <input
                          type="checkbox"
                          checked={markKnown}
                          onChange={(e) => setMarkKnown(e.target.checked)}
                          className="m-0 mt-0.5 h-5 w-5 flex-none"
                        />
                        <span className="flex flex-col gap-1">
                          <span className="font-semibold">
                            Đánh dấu {lesson.newWordCount} từ mới <span className="rounded bg-blue-hl px-1 font-medium">tô xanh</span> mà bạn không tra là
                            “đã biết”
                          </span>
                          <span className="text-[13px] text-fg3">Không tra nghĩa là bạn đã hiểu từ đó. Những từ đã tra giữ nguyên trạng thái.</span>
                        </span>
                      </label>
                    )}
                    <button type="button" className="btn btn-primary h-[52px] rounded-xl text-base" onClick={finish} disabled={missingAudio || finishing}>
                      <Flag size={18} />
                      {finishing ? 'Đang lưu…' : 'Hoàn thành bài'}
                    </button>
                    {missingAudio && <span className="-mt-3 text-center text-xs text-fg3">Cần tạo đủ audio trước khi hoàn thành bài.</span>}
                  </section>
                )}
              </article>
            )}
          </div>
        </main>

        {lookup && (
          <aside aria-label="Panel tra từ" className="fade-up w-[380px] max-w-[45%] flex-none overflow-y-auto border-l border-line bg-surface">
            <LookupPanel term={lookup.term} ctx={{ lessonId, sentenceId: lookup.sentenceId }} onClose={() => setLookup(null)} onSaved={refresh} />
          </aside>
        )}
      </div>

      {step === 4 && (
        <FooterPlayer ctl={ctl}>
          <button type="button" className="btn btn-secondary h-10 px-4" onClick={() => setStep(5)}>
            Xem ngữ pháp
            <ArrowRight size={16} />
          </button>
        </FooterPlayer>
      )}
    </div>
  )
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col rounded-xl bg-surface2 px-4 py-3.5">
      <span className="text-[22px] font-bold">{value}</span>
      <span className="text-[13px] text-fg3">{label}</span>
    </div>
  )
}
