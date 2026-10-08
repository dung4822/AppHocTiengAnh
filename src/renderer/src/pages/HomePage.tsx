import { useEffect, useState } from 'react'
import { ArrowRight, Headphones, Plus, Search, WifiOff } from 'lucide-react'
import type { LessonListItem } from '@shared/types'
import { api, call, getLessonStep } from '../api'
import { useApp } from '../appState'
import { formatHours, formatMinutes, formatRelative, formatToday, weekdayShort } from '../format'
import LookupPanel from '../components/LookupPanel'
import GenerationProgress, { genPercent } from '../components/GenerationProgress'
import { ProgressBar, StatusChip, type Tone } from '../components/ui'

const STATUS: Record<LessonListItem['status'], { label: string; tone: Tone }> = {
  audio_pending: { label: 'Thiếu audio', tone: 'leech' },
  ready: { label: 'Chưa học xong', tone: 'blue' },
  done: { label: 'Đã học', tone: 'known' }
}
const STEP_LABEL = ['Nghe', 'Trả lời', 'Kết quả', 'Script', 'Ngữ pháp']

export default function HomePage() {
  const { nav, stats, lessons, counts, gen, createLesson, clearGenError } = useApp()
  const [topics, setTopics] = useState<string[]>([])
  const [topic, setTopic] = useState('') // '' = ngẫu nhiên
  const [customTopic, setCustomTopic] = useState('')
  const [lookupInput, setLookupInput] = useState('')
  const [lookupTerm, setLookupTerm] = useState<string | null>(null)

  useEffect(() => {
    call(api.listTopics()).then(setTopics).catch(() => {})
  }, [])

  const running = gen?.status === 'running'
  const genError = gen?.status === 'error' ? gen.error : null
  const isEmpty = lessons.length === 0 && !running

  const create = (): void => {
    clearGenError()
    createLesson(customTopic.trim() || topic || null)
  }

  const doLookup = (e: React.FormEvent): void => {
    e.preventDefault()
    if (lookupInput.trim()) setLookupTerm(lookupInput.trim())
  }

  // Bài dở gần nhất (chưa hoàn thành)
  const unfinished = lessons.find((l) => l.status !== 'done')
  const unfinishedStep = unfinished ? (getLessonStep(unfinished.id)?.step ?? 1) : 1
  const due = stats?.dueToday ?? 0

  const topicFields = (big: boolean) => (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="field-label">Chủ đề</span>
        <select className={'select ' + (big ? '' : 'h-10')} value={topic} onChange={(e) => setTopic(e.target.value)} disabled={running}>
          <option value="">Chủ đề ngẫu nhiên</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={big ? 'field-label' : 'sr-only'}>Hoặc tự nhập chủ đề</span>
        <input
          type="text"
          className={'input ' + (big ? '' : 'h-10')}
          placeholder={big ? 'Ví dụ: hỏi đường ở sân bay' : 'hoặc tự nhập chủ đề…'}
          value={customTopic}
          onChange={(e) => setCustomTopic(e.target.value)}
          disabled={running}
        />
      </label>
    </>
  )

  const errorBox = genError && (
    <div role="alert" className="flex flex-col gap-2.5 rounded-[10px] bg-err-soft px-3.5 py-3">
      <span className="flex items-start gap-2 font-semibold text-err">
        <WifiOff size={16} className="mt-[3px] flex-none" />
        Chưa tạo được bài
      </span>
      <span className="text-[13px]">{genError}</span>
      <button type="button" className="btn btn-danger btn-sm self-start" onClick={create}>
        Thử lại
      </button>
    </div>
  )

  return (
    <div className="relative flex h-full">
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-7 px-10 pb-12 pt-9">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-fg3">{formatToday()}</span>
              <h1 className="page-title">Hôm nay</h1>
            </div>
            <form className="flex flex-[0_1_380px] gap-2" onSubmit={doLookup}>
              <label
                className={
                  'flex h-10 flex-1 items-center gap-2 rounded-[10px] bg-surface px-3 text-fg3 ' +
                  (lookupTerm ? 'border-[1.5px] border-accent' : 'border border-line2')
                }
              >
                <Search size={16} strokeWidth={1.8} />
                <span className="sr-only">Tra nhanh</span>
                <input
                  type="text"
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  placeholder="Tra nhanh từ hoặc cụm tiếng Anh…"
                  className="min-w-0 flex-1 border-0 bg-transparent font-[inherit] text-fg outline-none"
                />
              </label>
              <button type="submit" className="btn btn-secondary h-10 px-4">
                Tra
              </button>
            </form>
          </header>

          {/* LẦN ĐẦU: chưa có bài nào */}
          {isEmpty && (
            <section
              aria-labelledby="first-h"
              className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-9 rounded-[18px] border border-line bg-surface p-9"
            >
              <div className="flex flex-col gap-3.5">
                <span className="eyebrow">Bắt đầu</span>
                <h2 id="first-h" className="m-0 text-[26px] font-bold leading-tight tracking-[-0.02em]">
                  Tạo bài nghe đầu tiên, vừa đúng trình độ của bạn
                </h2>
                <ol className="m-0 flex list-none flex-col gap-3 p-0 text-fg2">
                  {[
                    ['Nghe', ' khi script đang ẩn, tập trung vào ý chính'],
                    ['Trả lời', ' câu hỏi hiểu ý, AI chấm bằng tiếng Việt'],
                    ['Đọc script và học ngữ pháp', ' — cụm hay tự thành thẻ ôn']
                  ].map(([b, t], i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-text">
                        {i + 1}
                      </span>
                      <span>
                        <strong className="text-fg">{b}</strong>
                        {t}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-col gap-3 rounded-[14px] bg-surface2 p-[22px]">
                {topicFields(true)}
                <button type="button" className="btn btn-primary h-12 text-[15px]" onClick={create}>
                  <Plus size={16} strokeWidth={2.2} />
                  Tạo bài đầu tiên
                </button>
                {errorBox}
                <span className="text-xs text-fg3">Lần đầu mất khoảng 3 phút vì cần tải giọng đọc offline (~90 MB).</span>
              </div>
            </section>
          )}

          {/* ĐANG TẠO BÀI */}
          {running && gen && <GenerationProgress gen={gen} />}

          {/* 3 VIỆC CHÍNH */}
          {!isEmpty && (
            <section aria-labelledby="plan-h" className="flex flex-col gap-3">
              <h2 id="plan-h" className="section-label m-0">
                Việc chính hôm nay
              </h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-3.5">
                {/* 1 · Ôn tập */}
                <div className="flex flex-col gap-4 rounded-[14px] bg-ink p-[22px] text-onink shadow-card">
                  <div className="flex items-center justify-between text-xs font-semibold opacity-75">
                    <span>1 · Ôn tập</span>
                    {due > 0 && <span className="font-normal">Làm trước</span>}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[44px] font-bold leading-none tracking-[-0.03em]">{due}</span>
                    <span className="text-[15px] opacity-85">thẻ cần ôn</span>
                  </div>
                  {counts && (
                    <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px]">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#6EA0FF]" />
                        {counts.newCount} mới
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#FF8A8A]" />
                        {counts.learningCount} đang học
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#6FD99A]" />
                        {counts.reviewCount} tới hạn
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={due === 0}
                    onClick={() => nav({ page: 'review' })}
                    className="btn mt-auto w-full bg-onink text-ink hover:opacity-90"
                  >
                    {due === 0 ? 'Không có thẻ cần ôn' : 'Bắt đầu ôn tập'}
                    {due > 0 && <ArrowRight size={16} strokeWidth={2} />}
                  </button>
                </div>

                {/* 2 · Học tiếp bài dở */}
                <div className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-surface p-[22px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-fg3">2 · Học tiếp bài dở</span>
                    {unfinished && <StatusChip tone={STATUS[unfinished.status].tone}>{STATUS[unfinished.status].label}</StatusChip>}
                  </div>
                  {unfinished ? (
                    <>
                      <div className="flex flex-col gap-1">
                        <span className="font-serif text-[21px] font-semibold leading-snug tracking-[-0.01em]">{unfinished.title}</span>
                        <span className="text-[13px] text-fg3">
                          {unfinished.topic} · {unfinished.grammarName}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-5 gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span
                              key={n}
                              className="h-1.5 rounded-full"
                              style={{
                                background: n < unfinishedStep ? 'var(--accent)' : n === unfinishedStep ? 'var(--accent-soft)' : 'var(--line)'
                              }}
                            />
                          ))}
                        </div>
                        <span className="text-[13px] text-fg2">
                          Đang ở bước {unfinishedStep}/5 · {STEP_LABEL[unfinishedStep - 1]}
                        </span>
                      </div>
                      <button type="button" className="btn btn-secondary mt-auto w-full" onClick={() => nav({ page: 'lesson', id: unfinished.id })}>
                        Tiếp tục bài
                        <ArrowRight size={16} strokeWidth={2} />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-1 flex-col items-start justify-center gap-1.5 text-fg3">
                      <span className="font-semibold text-fg2">Không có bài dở</span>
                      <span className="text-[13px]">Bạn đã học xong mọi bài. Tạo bài mới để học tiếp nhé.</span>
                    </div>
                  )}
                </div>

                {/* 3 · Tạo bài mới */}
                <div
                  className={
                    'flex flex-col gap-3 rounded-[14px] bg-surface p-[22px] ' + (genError ? 'border-[1.5px] border-err' : 'border border-line')
                  }
                >
                  <span className="text-xs font-semibold text-fg3">3 · Tạo bài mới</span>
                  {topicFields(false)}
                  {running && gen ? (
                    <button type="button" disabled className="btn btn-busy mt-auto w-full">
                      Đang tạo bài…{genPercent(gen) !== null && gen.event?.stage === 'audio' ? ` ${genPercent(gen)}%` : ''}
                    </button>
                  ) : genError ? (
                    errorBox
                  ) : (
                    <>
                      <button type="button" className="btn btn-primary mt-auto w-full" onClick={create}>
                        <Plus size={16} strokeWidth={2.2} />
                        Tạo bài mới
                      </button>
                      <span className="text-xs text-fg3">Mất khoảng 2–3 phút, bạn vẫn có thể ôn tập trong lúc chờ.</span>
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* TIẾN BỘ */}
          {!isEmpty && stats && (
            <section aria-labelledby="stats-h" className="flex flex-col gap-3">
              <h2 id="stats-h" className="section-label m-0">
                Tiến bộ của bạn
              </h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-3.5">
                <ListeningCard />
                <div className="flex flex-col gap-3.5">
                  <div className="card flex flex-col gap-4 p-[22px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">Vốn từ đã học</span>
                      <span className="text-xs text-fg3">
                        {stats.vocab.cards} thẻ → {stats.vocab.units} đơn vị nghĩa
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Stat value={stats.vocab.units} label="Đơn vị nghĩa" />
                      <Stat value={stats.vocab.remembered} label="Đang nhớ ≥ 80%" color="var(--known)" />
                      <Stat value={stats.vocab.solid} label="Nhớ chắc ≥ 3 tuần" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="chip bg-surface2 px-2.5 py-1 font-normal text-fg2">
                        {stats.knownWords.toLocaleString('vi-VN')} từ đã biết sẵn
                      </span>
                      {stats.leechCount > 0 && (
                        <button
                          type="button"
                          onClick={() => nav({ page: 'vocab' })}
                          className="chip border-0 bg-leech-soft px-2.5 py-1 font-[inherit] text-xs text-leech"
                        >
                          {stats.leechCount} từ hay quên
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="card flex flex-col gap-3 p-[22px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">Ngữ pháp core</span>
                      <span className="text-[13px] text-fg2">
                        <strong className="text-fg">{stats.coreTaught}</strong>/{stats.coreTotal} điểm · {stats.lessonCount} bài nghe
                      </span>
                    </div>
                    <ProgressBar value={(stats.coreTaught / Math.max(1, stats.coreTotal)) * 100} />
                    <span className="text-xs text-fg3">Cứ vài bài sẽ có một bài ôn lại ngữ pháp cũ</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* CÁC BÀI ĐÃ TẠO */}
          <section aria-labelledby="ls-h" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 id="ls-h" className="section-label m-0">
                Các bài đã tạo
              </h2>
              {lessons.length > 0 && <span className="text-xs text-fg3">{lessons.length} bài</span>}
            </div>
            {lessons.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-line2 px-5 py-9 text-center text-fg3">
                <Headphones size={28} strokeWidth={1.6} />
                <span className="font-semibold text-fg2">Chưa có bài nào</span>
                <span className="text-[13px]">Bài bạn tạo sẽ xuất hiện ở đây, kèm trạng thái học.</span>
              </div>
            ) : (
              <div className="card flex flex-col overflow-hidden">
                {lessons.map((l, i) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => nav({ page: 'lesson', id: l.id })}
                    className={
                      'flex w-full items-center gap-4 bg-transparent px-5 py-3.5 text-left font-[inherit] text-fg hover:bg-surface2 ' +
                      (i ? 'border-t border-line' : '')
                    }
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-serif text-base font-semibold">{l.title}</span>
                      <span className="truncate text-xs text-fg3">
                        {formatRelative(l.createdAt)} · {l.topic} · {l.grammarName}
                        {l.isGrammarReview ? ' (ôn)' : ''}
                      </span>
                    </div>
                    <StatusChip tone={STATUS[l.status].tone} className="px-2.5 py-[3px]">
                      {STATUS[l.status].label}
                    </StatusChip>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Panel tra nhanh: nổi đè bên phải */}
      {lookupTerm && (
        <aside
          aria-label="Panel tra từ"
          className="fade-up absolute inset-y-0 right-0 z-20 w-[min(400px,100%)] overflow-y-auto border-l border-line bg-surface shadow-pop"
        >
          <LookupPanel term={lookupTerm} onClose={() => setLookupTerm(null)} />
        </aside>
      )}
    </div>
  )
}

function Stat({ value, label, color }: { value: React.ReactNode; label: string; color?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-2xl font-bold tracking-[-0.02em]" style={color ? { color } : undefined}>
        {value}
      </span>
      <span className="text-xs text-fg3">{label}</span>
    </div>
  )
}

// Thời gian nghe: hôm nay / chuỗi / tổng + biểu đồ cột 7 ngày
function ListeningCard() {
  const { stats } = useApp()
  if (!stats) return null
  const l = stats.listening
  const max = Math.max(60, ...l.last7.map((x) => x.seconds))
  return (
    <div className="card flex flex-col gap-[18px] p-[22px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Thời gian nghe</span>
        <span className="text-xs text-fg3">Chỉ tính lúc audio đang phát</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat value={formatMinutes(l.todaySeconds)} label="Hôm nay" />
        <Stat value={`${l.streakDays} ngày`} label="Chuỗi liên tiếp" />
        <Stat value={formatHours(l.totalSeconds)} label="Tổng cộng" />
      </div>
      <div className="grid h-[120px] grid-cols-7 items-end gap-2.5">
        {l.last7.map((d, i) => {
          const isToday = i === l.last7.length - 1
          const mins = Math.round(d.seconds / 60)
          return (
            <div key={d.day} className="flex h-full flex-col items-center justify-end gap-1.5" title={`${d.day}: ${formatMinutes(d.seconds)}`}>
              <span className="text-[11px] text-fg3">{d.seconds >= 30 ? `${mins}'` : '–'}</span>
              <div
                className="w-full max-w-[30px] rounded-t-md rounded-b-[3px]"
                style={{ height: Math.max(3, Math.round((d.seconds / max) * 72)), background: isToday ? 'var(--accent)' : 'var(--line2)' }}
              />
              <span className="text-[11px] text-fg3">{isToday ? 'Nay' : weekdayShort(d.day)}</span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 border-t border-line pt-3 text-[13px] text-fg2">
        <span>
          Bài nghe <strong className="text-fg">{formatMinutes(l.lessonSeconds)}</strong>
        </span>
        <span>
          Ôn tập <strong className="text-fg">{formatMinutes(l.reviewSeconds)}</strong>
        </span>
      </div>
    </div>
  )
}
