import { useEffect, useState } from 'react'
import { Check, Info } from 'lucide-react'
import { GEN_STAGES, useApp, type GenState } from '../appState'
import { IndeterminateBar, ProgressBar } from './ui'

function elapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Mô tả cho khu chi tiết bên phải, theo giai đoạn đang chạy
const DETAIL: Record<number, string> = {
  0: 'Chọn điểm ngữ pháp và các cụm cần ôn cho bài.',
  1: 'Thường mất 30–60 giây.',
  2: 'Đếm tỉ lệ từ quen theo trình độ của bạn.',
  3: 'Bài hơi khó nên AI đang thay bớt từ lạ.',
  4: 'Lưu script, câu hỏi và tạo thẻ cho các cụm mới.',
  5: 'Chỉ tải một lần. Những bài sau sẽ tạo nhanh hơn.',
  6: 'Giọng đọc chạy offline trên máy.',
  7: 'Viết giải thích ngữ pháp chi tiết và chú thích từng từ.',
  8: 'Sắp xong!'
}

export function genPercent(g: GenState): number | null {
  const e = g.event
  if (!e?.total) return null
  return Math.round(((e.current ?? 0) / e.total) * 100)
}

// Khối tiến trình tạo bài: danh sách 9 giai đoạn + chi tiết bước hiện tại
export default function GenerationProgress({ gen }: { gen: GenState }) {
  const { nav } = useApp()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const cur = gen.stageIdx
  const pct = genPercent(gen)

  return (
    <section aria-labelledby="gen-h" aria-live="polite" className="fade-up overflow-hidden rounded-[18px] border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5">
        <div className="flex flex-col">
          <h2 id="gen-h" className="m-0 text-[17px] font-bold">
            Đang tạo bài mới
          </h2>
          <span className="text-[13px] text-fg3">
            {gen.topic ? `Chủ đề: ${gen.topic}` : 'Chủ đề ngẫu nhiên'} · {elapsed(now - gen.startedAt)} đã trôi qua · thường mất 2–3 phút
          </span>
        </div>
        <button type="button" className="btn btn-secondary h-10 px-3.5" onClick={() => nav({ page: 'review' })}>
          Ôn tập trong lúc chờ
        </button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))]">
        <ol className="m-0 flex list-none flex-col gap-0.5 border-r border-line px-6 py-5">
          {GEN_STAGES.map((t, i) => {
            const done = i < cur
            const isCur = i === cur
            const sub = gen.subs[i]
            return (
              <li
                key={i}
                className="grid grid-cols-[22px_minmax(0,1fr)] gap-3 py-1.5"
                style={{ color: done ? 'var(--text2)' : isCur ? 'var(--text)' : 'var(--text3)' }}
              >
                <span
                  className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    background: done ? 'var(--known-soft)' : isCur ? 'var(--accent)' : 'transparent',
                    color: done ? 'var(--known)' : isCur ? '#fff' : 'var(--text3)',
                    border: done || isCur ? '1px solid transparent' : '1px solid var(--line2)'
                  }}
                >
                  {done ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span className="flex flex-col">
                  <span style={{ fontWeight: isCur ? 600 : 400 }}>{t}</span>
                  {sub && (done || isCur) && <span className="text-xs text-fg3">{sub}</span>}
                </span>
              </li>
            )
          })}
        </ol>
        <div className="flex flex-col justify-center gap-[18px] p-7">
          <span className="eyebrow">
            Bước {cur + 1} / {GEN_STAGES.length}
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-xl font-bold tracking-[-0.01em]">{gen.event?.message.replace(/\.\.\.$/, '') ?? 'Bắt đầu…'}</span>
            <span className="text-sm text-fg2">{DETAIL[cur]}</span>
          </div>
          {pct !== null ? (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between font-mono text-[13px] text-fg2">
                <span>{gen.event?.stage === 'audio' ? `${gen.event.current ?? 0} / ${gen.event.total} câu` : ''}</span>
                <span>{pct}%</span>
              </div>
              <ProgressBar value={pct} height={10} />
            </div>
          ) : (
            <IndeterminateBar track="var(--surface2)" />
          )}
          <div className="flex gap-2.5 rounded-[10px] bg-surface2 px-3.5 py-3 text-[13px] text-fg2">
            <Info size={16} className="mt-0.5 flex-none" />
            <span>Bạn có thể rời trang này. Khi xong, app sẽ báo để bạn mở bài.</span>
          </div>
        </div>
      </div>
    </section>
  )
}
