import { useEffect, useState } from 'react'
import { CalendarClock, ChevronDown } from 'lucide-react'
import type { ReviewForecast as Forecast } from '@shared/types'
import { api, call } from '../api'

const DAYS = 14
const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const WEEKDAY_LONG = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function shortLabel(day: string, i: number): string {
  if (i === 0) return 'Nay'
  if (i === 1) return 'Mai'
  return WEEKDAY[parseDay(day).getDay()]
}
function longLabel(day: string, i: number): string {
  const d = parseDay(day)
  const date = `${d.getDate()}/${d.getMonth() + 1}`
  if (i === 0) return `Hôm nay (${date})`
  if (i === 1) return `Ngày mai (${date})`
  return `${WEEKDAY_LONG[d.getDay()]} ${date}`
}

// Lịch ôn 14 ngày tới: cột xanh lá = thẻ đã học tới hạn, cột xanh dương = thẻ mới dự kiến (ước tính).
// Bấm / rê vào một ngày để xem những từ sẽ gặp lại hôm đó.
export default function ReviewForecast({ defaultOpen = false, refreshKey = 0 }: { defaultOpen?: boolean; refreshKey?: number }) {
  const [open, setOpen] = useState(defaultOpen)
  const [data, setData] = useState<Forecast | null>(null)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    call(api.getReviewForecast(DAYS))
      .then((f) => {
        setData(f)
        setError(false)
      })
      .catch(() => setError(true))
  }, [open, refreshKey])

  const active = hover ?? selected
  const max = data ? Math.max(1, ...data.days.map((d) => d.due + d.newCards)) : 1
  const week = data ? data.days.slice(0, 7).reduce((s, d) => s + d.due + d.newCards, 0) : 0
  const day = data?.days[active]

  return (
    <section aria-label="Lịch ôn sắp tới" className="flex flex-col rounded-[16px] border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-[16px] border-0 bg-transparent px-[18px] py-3.5 text-left font-[inherit] text-fg hover:bg-surface2"
      >
        <CalendarClock size={17} className="flex-none text-fg2" />
        <span className="flex-1 font-semibold">Lịch ôn sắp tới</span>
        {data && open && <span className="text-[13px] text-fg3">7 ngày tới ≈ {week} lượt thẻ</span>}
        <ChevronDown size={16} className={'flex-none text-fg3 transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>

      {open && (
        <div className="flex flex-col gap-4 px-[18px] pb-[18px]">
          {error && <p className="m-0 text-[13px] text-err">Chưa tải được lịch ôn.</p>}
          {data && (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: 'var(--chart-review)' }} />
                  Thẻ đã học tới hạn
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: 'var(--chart-new)' }} />
                  Thẻ mới (ước tính)
                </span>
              </div>

              <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1" onMouseLeave={() => setHover(null)}>
                {data.days.map((d, i) => {
                  const total = d.due + d.newCards
                  const h = 112
                  const dueH = Math.round((d.due / max) * h)
                  const newH = Math.round((d.newCards / max) * h)
                  const isActive = i === active
                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => setSelected(i)}
                      onMouseEnter={() => setHover(i)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      aria-label={`${longLabel(d.day, i)}: ${d.due} thẻ tới hạn, ${d.newCards} thẻ mới`}
                      aria-pressed={i === selected}
                      className={
                        'flex flex-col items-center gap-1 rounded-lg border-0 px-0 pb-1 pt-1.5 font-[inherit] ' +
                        (isActive ? 'bg-surface2' : 'bg-transparent hover:bg-surface2')
                      }
                    >
                      <span className={'text-[11px] tabular-nums ' + (total ? 'text-fg2' : 'text-fg3')}>{total || '\u00a0' /* giữ chiều cao dòng số để nhãn ngày thẳng hàng */}</span>
                      {/* Cột chồng: thẻ mới ở trên, thẻ tới hạn ở dưới, khe 2px giữa hai phần */}
                      <span className="flex w-[min(18px,70%)] flex-col justify-end gap-[2px]" style={{ height: h }}>
                        {newH > 0 && (
                          <span
                            className="w-full rounded-t-[4px]"
                            style={{ height: Math.max(2, newH), background: 'var(--chart-new)', opacity: isActive ? 1 : 0.85 }}
                          />
                        )}
                        {dueH > 0 && (
                          <span
                            className={'w-full ' + (newH > 0 ? '' : 'rounded-t-[4px]')}
                            style={{ height: Math.max(2, dueH), background: 'var(--chart-review)', opacity: isActive ? 1 : 0.85 }}
                          />
                        )}
                        {total === 0 && <span className="h-[2px] w-full rounded-full bg-line" />}
                      </span>
                      <span className={'text-[11px] ' + (i < 2 || isActive ? 'font-semibold text-fg' : 'text-fg3')}>{shortLabel(d.day, i)}</span>
                    </button>
                  )
                })}
              </div>

              {day && (
                <div className="flex flex-col gap-2 rounded-[12px] bg-surface2 px-3.5 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="font-semibold">{longLabel(day.day, active)}</span>
                    <span className="text-[13px] text-fg2">
                      {day.due} thẻ tới hạn
                      {day.newCards > 0 && ` · ${day.newCards} thẻ mới`}
                      {day.due > data.reviewsPerDay && ` · vượt giới hạn ${data.reviewsPerDay}/ngày, phần dư dời sang hôm sau`}
                    </span>
                  </div>
                  {day.words.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {day.words.map((w) => (
                        <span key={w} className="chip bg-surface font-serif font-normal text-fg">
                          {w}
                        </span>
                      ))}
                      {day.words.length >= 12 && <span className="chip font-normal text-fg3">và thêm nữa…</span>}
                    </div>
                  ) : (
                    <span className="text-[13px] text-fg3">
                      {day.newCards > 0 ? 'Chỉ có thẻ mới — chưa biết trước là từ nào.' : 'Không có thẻ nào tới hạn. Ngày nghỉ!'}
                    </span>
                  )}
                </div>
              )}
              <span className="text-xs text-fg3">
                Ước tính theo lịch FSRS hiện tại. Thẻ bạn trả lời "Quên" hoặc thẻ mới vừa học sẽ quay lại sớm hơn, nên số thật có thể nhiều hơn một chút.
              </span>
            </>
          )}
        </div>
      )}
    </section>
  )
}
