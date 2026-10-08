import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Lightbulb, Search, Volume2, X } from 'lucide-react'
import type { VocabFilter, VocabItem } from '@shared/types'
import { api, call, errMsg } from '../api'
import { useApp } from '../appState'
import { usePlayer } from '../usePlayer'
import LookupPanel from '../components/LookupPanel'
import { StatusChip, type Tone } from '../components/ui'

type StatusKey = NonNullable<VocabFilter['status']>

const STATUS: Record<VocabItem['status'], { label: string; tone: Tone }> = {
  new: { label: 'Mới', tone: 'blue' },
  learning: { label: 'Đang học', tone: 'learn' },
  known: { label: 'Đã thuộc', tone: 'known' }
}

const FILTERS: { key: StatusKey; label: string; dot?: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'new', label: 'Mới', dot: 'var(--blue)' },
  { key: 'learning', label: 'Đang học', dot: 'var(--learn)' },
  { key: 'known', label: 'Đã thuộc', dot: 'var(--known)' },
  { key: 'leech', label: 'Từ hay quên', dot: 'var(--leech)' },
  { key: 'suspended', label: 'Tạm ẩn' }
]

// Lọc theo trạng thái (giống điều kiện ở vocabService.listVocab)
function matches(v: VocabItem, s: StatusKey): boolean {
  if (s === 'all') return true
  if (s === 'suspended') return v.suspended
  if (s === 'leech') return v.leech && !v.suspended
  return v.status === s && !v.suspended
}

// Tách câu ngữ cảnh thành [trước, cụm, sau] để in đậm cụm
function splitContext(sentence: string, term: string): [string, string, string] {
  const i = sentence.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0) return [sentence, '', '']
  return [sentence.slice(0, i), sentence.slice(i, i + term.length), sentence.slice(i + term.length)]
}

export default function VocabPage() {
  const { nav, refresh: refreshApp } = useApp()
  // Tải tất cả thẻ theo ô tìm + nguồn; lọc trạng thái ở giao diện để đếm được số thẻ mỗi nhóm
  const [all, setAll] = useState<VocabItem[]>([])
  const [search, setSearch] = useState('')
  const [source, setSource] = useState<NonNullable<VocabFilter['source']>>('all')
  const [status, setStatus] = useState<StatusKey>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const player = usePlayer()

  const load = (): void => {
    call(api.listVocab({ search, source, status: 'all' }))
      .then(setAll)
      .catch((e) => setError(errMsg(e)))
  }

  useEffect(() => {
    const t = window.setTimeout(load, 200) // đợi gõ xong mới tìm
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, source])

  const counts = useMemo(() => {
    const out = {} as Record<StatusKey, number>
    for (const f of FILTERS) out[f.key] = all.filter((v) => matches(v, f.key)).length
    return out
  }, [all])
  const items = all.filter((v) => matches(v, status))
  const selected = all.find((v) => v.id === selectedId) ?? null

  useEffect(() => setConfirmDel(false), [selectedId])

  const playCard = (v: VocabItem): void => {
    player.play([{ id: v.id, url: v.contextAudioUrl ?? v.exampleAudioUrl }])
  }

  const toggleSuspend = async (v: VocabItem): Promise<void> => {
    await call(api.setVocabSuspended(v.id, !v.suspended)).catch((e) => setError(errMsg(e)))
    load()
    refreshApp()
  }

  const remove = async (v: VocabItem): Promise<void> => {
    await call(api.deleteVocab(v.id)).catch((e) => setError(errMsg(e)))
    setSelectedId(null)
    load()
    refreshApp()
  }

  return (
    <div className="flex h-full">
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-[22px] px-10 pb-12 pt-9">
          <header className="flex items-baseline gap-2.5">
            <h1 className="page-title">Thẻ từ vựng</h1>
            <span className="text-[15px] text-fg3">{counts.all ?? 0} thẻ</span>
          </header>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2.5">
              <label className="flex h-10 flex-[1_1_280px] items-center gap-2 rounded-[10px] border border-line2 bg-surface px-3 text-fg3 focus-within:border-accent">
                <Search size={16} strokeWidth={1.8} />
                <span className="sr-only">Tìm thẻ</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo từ hoặc nghĩa…"
                  className="min-w-0 flex-1 bg-transparent text-fg outline-none"
                />
              </label>
              <label className="flex items-center">
                <span className="sr-only">Nguồn</span>
                <select className="select h-10" value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
                  <option value="all">Mọi nguồn</option>
                  <option value="lesson">Từ bài học</option>
                  <option value="lookup">Từ tra từ</option>
                </select>
              </label>
            </div>
            <div role="group" aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => {
                const on = status === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStatus(f.key)}
                    className={
                      'flex h-[34px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] ' +
                      (on ? 'border-ink bg-ink font-semibold text-onink' : 'border-line2 bg-surface text-fg2 hover:text-fg')
                    }
                  >
                    {f.dot && !on && <span className="h-[7px] w-[7px] rounded-full" style={{ background: f.dot }} />}
                    {f.label} · {counts[f.key] ?? 0}
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p className="m-0 rounded-[10px] bg-err-soft px-4 py-3 text-err">{error}</p>}

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-line2 px-5 py-12 text-center text-fg3">
              <BookOpen size={28} strokeWidth={1.6} />
              <span className="font-semibold text-fg2">{all.length === 0 && !search ? 'Chưa có thẻ nào' : 'Không có thẻ nào khớp'}</span>
              <span className="text-[13px]">
                {all.length === 0 && !search ? 'Tạo bài nghe hoặc tra từ rồi bấm “Lưu thành thẻ”.' : 'Thử bỏ bớt bộ lọc hoặc từ khóa tìm kiếm.'}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(270px,100%),1fr))] gap-3">
              {items.map((v) => {
                const isSel = selectedId === v.id
                const ctx = v.contextEn ?? v.exampleEn
                const [a, b, z] = ctx ? splitContext(ctx, v.text) : ['', '', '']
                const hasAudio = !!(v.contextAudioUrl || v.exampleAudioUrl)
                return (
                  <div
                    key={v.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(v.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedId(v.id)}
                    className={
                      'flex cursor-pointer flex-col gap-2.5 rounded-[14px] bg-surface px-4 pb-3.5 pt-4 text-left transition-shadow hover:shadow-card ' +
                      (isSel ? 'border-[1.5px] border-accent ring-[3px] ring-accent-soft' : 'border border-line') +
                      (v.suspended ? ' opacity-55' : '')
                    }
                  >
                    <span className="flex w-full items-start justify-between gap-2">
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-serif text-lg font-semibold leading-snug">{v.text}</span>
                        <span className="text-sm text-fg2">{v.meaningVi}</span>
                      </span>
                      <button
                        type="button"
                        aria-label="Nghe câu"
                        disabled={!hasAudio}
                        onClick={(e) => {
                          e.stopPropagation()
                          playCard(v)
                        }}
                        className={'round-btn h-[30px] w-[30px] ' + (player.playingId === v.id ? 'border-accent text-accent' : '')}
                      >
                        <Volume2 size={14} />
                      </button>
                    </span>
                    {ctx && (
                      <span className="flex flex-col gap-0.5 rounded-[10px] bg-surface2 px-3 py-2.5">
                        <span className="font-serif text-sm leading-normal">
                          {a}
                          <strong className="font-semibold">{b}</strong>
                          {z}
                        </span>
                        <span className="text-xs text-fg3">{v.contextEn ? v.contextVi : v.exampleVi}</span>
                      </span>
                    )}
                    <span className="flex flex-wrap gap-1.5">
                      {v.suspended ? (
                        <StatusChip tone="neutral" className="px-2 text-[11px]">
                          Tạm ẩn
                        </StatusChip>
                      ) : (
                        <StatusChip tone={STATUS[v.status].tone} className="px-2 text-[11px]">
                          {STATUS[v.status].label}
                        </StatusChip>
                      )}
                      {v.leech && (
                        <StatusChip tone="leech" className="px-2 text-[11px]">
                          Hay quên
                        </StatusChip>
                      )}
                      <span className="chip chip-outline px-2 text-[11px]">{v.frequencyLabel}</span>
                      {v.cefr && <span className="chip chip-outline px-2 font-mono text-[11px]">{v.cefr}</span>}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {selected && (
        <aside aria-label="Chi tiết thẻ" className="fade-up flex w-[400px] max-w-[45%] flex-none flex-col gap-5 overflow-y-auto border-l border-line bg-surface px-[22px] pb-8 pt-[22px]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg3">Chi tiết thẻ</span>
            <button
              type="button"
              aria-label="Đóng chi tiết"
              onClick={() => setSelectedId(null)}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface2 text-fg2 hover:text-fg"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="font-serif text-[26px] font-semibold leading-tight tracking-[-0.015em]">{selected.text}</span>
            <div className="flex flex-wrap gap-1.5">
              {selected.suspended ? (
                <StatusChip tone="neutral" className="px-2 text-[11px]">
                  Tạm ẩn
                </StatusChip>
              ) : (
                <StatusChip tone={STATUS[selected.status].tone} className="px-2 text-[11px]">
                  {STATUS[selected.status].label}
                </StatusChip>
              )}
              {selected.leech && (
                <StatusChip tone="leech" className="px-2 text-[11px]">
                  Hay quên
                </StatusChip>
              )}
            </div>
            <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-1.5 text-[13px]">
              {selected.firstLessonId && (
                <>
                  <dt className="text-fg3">Bài gốc</dt>
                  <dd className="m-0">
                    <button
                      type="button"
                      onClick={() => nav({ page: 'lesson', id: selected.firstLessonId! })}
                      className="text-left font-semibold text-accent-text underline-offset-2 hover:underline"
                    >
                      {selected.firstLessonTitle}
                    </button>
                  </dd>
                </>
              )}
              <dt className="text-fg3">Nguồn</dt>
              <dd className="m-0">{selected.source === 'lesson' ? 'Từ bài học' : 'Từ tra từ'}</dd>
              <dt className="text-fg3">Đã gặp</dt>
              <dd className="m-0">trong {selected.timesSeen} bài</dd>
              {selected.sameUnit.length > 0 && (
                <>
                  <dt className="text-fg3">Cùng nghĩa với</dt>
                  <dd className="m-0 flex flex-col gap-1">
                    <span className="flex flex-wrap gap-1">
                      {selected.sameUnit.map((s) => (
                        <span key={s} className="rounded-md bg-surface2 px-2 py-px font-serif">
                          {s}
                        </span>
                      ))}
                    </span>
                    <span className="text-xs text-fg3">chỉ tính 1 đơn vị nghĩa</span>
                  </dd>
                </>
              )}
            </dl>
          </div>

          {selected.rescue && (
            <section className="flex flex-col gap-3 rounded-xl bg-leech-soft p-4">
              <span className="flex items-start gap-2.5">
                <Lightbulb size={18} className="mt-0.5 flex-none text-leech" />
                <span>
                  <strong className="text-leech">Mẹo nhớ:</strong> {selected.rescue.memory_hook}
                </span>
              </span>
              {(selected.rescue.why_hard || selected.rescue.explain) && (
                <div className="flex flex-col gap-1 text-[13px] text-fg2">
                  <strong className="text-fg">Vì sao hay quên?</strong>
                  {selected.rescue.why_hard && <span>{selected.rescue.why_hard}</span>}
                  {selected.rescue.explain && <span>{selected.rescue.explain}</span>}
                </div>
              )}
              {selected.rescue.confusables.length > 0 && (
                <div className="flex flex-col gap-1 text-[13px] text-fg2">
                  <strong className="text-fg">Dễ nhầm với</strong>
                  {selected.rescue.confusables.map((c, i) => (
                    <span key={i}>
                      <span className="font-serif text-fg">{c.text}</span> — {c.difference}
                    </span>
                  ))}
                </div>
              )}
              {selected.rescue.examples.length > 0 && (
                <div className="flex flex-col gap-2">
                  <strong className="text-[13px]">{selected.rescue.examples.length} câu ví dụ mới</strong>
                  {selected.rescue.examples.map((ex, i) => (
                    <span key={i} className="flex flex-col">
                      <span className="font-serif">{ex.en}</span>
                      <span className="text-xs text-fg3">{ex.vi}</span>
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {confirmDel ? (
            <div className="flex flex-col gap-2.5 rounded-xl border-[1.5px] border-err p-3.5">
              <span className="text-[13px]">
                Xóa thẻ <strong>“{selected.text}”</strong>? Lịch sử ôn của thẻ sẽ mất, không hoàn tác được.
              </span>
              <div className="flex gap-2">
                <button type="button" className="btn btn-danger h-10 flex-1" onClick={() => remove(selected)}>
                  Xóa vĩnh viễn
                </button>
                <button type="button" className="btn btn-secondary h-10 flex-1" onClick={() => setConfirmDel(false)}>
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary h-10 flex-1" onClick={() => toggleSuspend(selected)}>
                {selected.suspended ? 'Bỏ tạm ẩn' : 'Tạm ẩn'}
              </button>
              <button type="button" className="btn btn-danger-outline h-10 flex-1" onClick={() => setConfirmDel(true)}>
                Xóa
              </button>
            </div>
          )}

          <div className="h-px flex-none bg-line" />
          {/* Giải thích đầy đủ: dùng lookup_cache, chưa có thì tra */}
          <LookupPanel term={selected.text} ctx={{ passive: true }} embedded />
        </aside>
      )}
    </div>
  )
}
