import { useEffect, useMemo, useState } from 'react'
import type { ProgressData, ProgressDay } from '@shared/types'
import { api, call, errMsg } from '../api'
import { formatHours, formatMinutes, weekdayShort } from '../format'

// =====================================================================
// NHẬT KÝ HỌC: nhìn lại những gì đã làm theo ngày / 7 ngày / 30 ngày
// + lịch ô vuông kiểu GitHub cho cả năm. Giọng văn nhẹ nhàng, không so bì.
// =====================================================================

type Period = 'today' | 'week' | 'month'
type Metric = 'listen' | 'words' | 'reviews'

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: 'today', label: 'Hôm nay', days: 1 },
  { key: 'week', label: '7 ngày', days: 7 },
  { key: 'month', label: '30 ngày', days: 30 }
]

// Ngưỡng 4 mức màu của lịch cho từng loại số liệu
const METRICS: Record<Metric, { label: string; value: (d: ProgressDay) => number; steps: number[] }> = {
  listen: { label: 'Nghe', value: (d) => d.listenSeconds / 60, steps: [1, 5, 15, 30] },
  words: { label: 'Từ mới', value: (d) => d.newWords + d.knownWords, steps: [1, 4, 9, 16] },
  reviews: { label: 'Ôn thẻ', value: (d) => d.reviews, steps: [1, 11, 31, 61] }
}

// 2 bộ màu cho lịch: xanh lá kiểu GitHub, cam đất kiểu Claude (mức 0 → 4, sáng / tối)
type Palette = 'github' | 'claude'
const PALETTES: Record<Palette, { label: string; light: string[]; dark: string[] }> = {
  github: {
    label: 'Xanh lá',
    light: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    dark: ['#22252b', '#0e4429', '#006d32', '#26a641', '#39d353']
  },
  claude: {
    label: 'Cam đất',
    light: ['#efede6', '#f3cdb9', '#e9a07f', '#d97757', '#b3532f'],
    dark: ['#26262a', '#5a3326', '#8c4a32', '#c4653f', '#e48d66']
  }
}
const isDark = (): boolean => window.matchMedia('(prefers-color-scheme: dark)').matches

function loadPalette(): Palette {
  try {
    return localStorage.getItem('journal-palette') === 'claude' ? 'claude' : 'github'
  } catch {
    return 'github'
  }
}

// Ngày "có học": nghe ít nhất 1 phút, hoặc ôn / thêm từ / học xong bài
const isActive = (d: ProgressDay): boolean =>
  d.listenSeconds >= 60 || d.reviews > 0 || d.newWords > 0 || d.knownWords > 0 || d.lessonsDone > 0

function sum(days: ProgressDay[]): Omit<ProgressDay, 'day'> {
  const s = { listenSeconds: 0, newWords: 0, knownWords: 0, reviews: 0, lessonsDone: 0 }
  for (const d of days) {
    s.listenSeconds += d.listenSeconds
    s.newWords += d.newWords
    s.knownWords += d.knownWords
    s.reviews += d.reviews
    s.lessonsDone += d.lessonsDone
  }
  return s
}

// "Thứ Năm, 8/10"
function longDay(day: string): string {
  const d = new Date(day + 'T00:00:00')
  const w = d.toLocaleDateString('vi-VN', { weekday: 'long' })
  return `${w.charAt(0).toUpperCase() + w.slice(1)}, ${d.getDate()}/${d.getMonth() + 1}`
}

function streaks(days: ProgressDay[]): { current: number; longest: number; active: number } {
  let longest = 0, run = 0, active = 0
  for (const d of days) {
    if (isActive(d)) {
      active++
      run++
      longest = Math.max(longest, run)
    } else run = 0
  }
  // Hôm nay chưa học thì chuỗi vẫn tính tới hôm qua
  let current = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (isActive(days[i])) current++
    else if (i === days.length - 1) continue
    else break
  }
  return { current, longest, active }
}

// Một câu nhỏ ở đầu trang, tuỳ tình hình hôm nay
function greeting(today: ProgressDay | undefined, current: number): string {
  if (today && isActive(today)) {
    const mins = Math.round(today.listenSeconds / 60)
    return mins >= 1
      ? `Hôm nay bạn đã nghe ${mins} phút rồi. Cứ đều đều vậy là được.`
      : 'Hôm nay bạn đã học một chút rồi. Cứ đều đều vậy là được.'
  }
  if (current === 1) return 'Hôm qua bạn có học. Nghe vài phút hôm nay để giữ nhịp nhé.'
  if (current > 1) return `Bạn đã học liền ${current} ngày. Nghe vài phút hôm nay để giữ nhịp nhé.`
  return 'Chưa cần nhiều đâu, một bài nghe ngắn hôm nay là đủ.'
}

export default function JournalPage() {
  const [data, setData] = useState<ProgressData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('week')
  const [palette, setPalette] = useState<Palette>(loadPalette)
  const colors = PALETTES[palette][isDark() ? 'dark' : 'light']

  const choosePalette = (p: Palette): void => {
    setPalette(p)
    try {
      localStorage.setItem('journal-palette', p)
    } catch {
      /* không lưu được thì thôi */
    }
  }

  useEffect(() => {
    call(api.getProgress())
      .then(setData)
      .catch((e) => setError(errMsg(e)))
  }, [])

  const days = data?.days ?? []
  const st = useMemo(() => streaks(days), [days])
  const n = PERIODS.find((p) => p.key === period)!.days
  const cur = sum(days.slice(-n))
  const prev = sum(days.slice(-2 * n, -n))
  const prevLabel = period === 'today' ? 'Hôm qua' : 'Kỳ trước'

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-[22px] px-10 pb-12 pt-9">
        <header className="flex flex-col gap-1.5">
          <h1 className="page-title">Mỗi ngày một chút</h1>
          <p className="text-[15px] text-fg2">{data ? greeting(days.at(-1), st.current) : ' '}</p>
        </header>

        {error && <div className="rounded-xl bg-err-soft px-4 py-3 text-sm text-err">{error}</div>}

        {data && (
          <>
            <Heatmap days={days} today={data.today} st={st} palette={palette} onPalette={choosePalette} />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div role="group" aria-label="Khoảng thời gian" className="seg">
                {PERIODS.map((p) => (
                  <button key={p.key} type="button" className="seg-btn" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <span className="text-[13px] text-fg3">Một ngày tính từ 4 giờ sáng</span>
            </div>

            <div className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2">
              <Tile label="Thời gian nghe" value={formatMinutes(cur.listenSeconds)} prev={`${prevLabel}: ${formatMinutes(prev.listenSeconds)}`} />
              <Tile
                label="Từ vựng mới"
                value={cur.newWords + cur.knownWords}
                note={cur.knownWords > 0 ? `${cur.newWords} đang học · ${cur.knownWords} đã biết` : undefined}
                prev={`${prevLabel}: ${prev.newWords + prev.knownWords}`}
              />
              <Tile label="Lượt ôn thẻ" value={cur.reviews} prev={`${prevLabel}: ${prev.reviews}`} />
              <Tile label="Bài học xong" value={cur.lessonsDone} prev={`${prevLabel}: ${prev.lessonsDone}`} />
            </div>

            <ListenBars days={days.slice(-(period === 'month' ? 30 : 7))} colors={colors} />
          </>
        )}
      </div>
    </main>
  )
}

function Tile({ label, value, note, prev }: { label: string; value: React.ReactNode; note?: string; prev: string }) {
  return (
    <div className="card flex min-w-0 flex-col gap-1 p-[18px]">
      <span className="text-[13px] font-medium text-fg2">{label}</span>
      <span className="text-[26px] font-bold tracking-[-0.02em]">{value}</span>
      {note && <span className="text-xs text-fg2">{note}</span>}
      <span className="mt-auto pt-1 text-xs text-fg3">{prev}</span>
    </div>
  )
}

// Cột phút nghe từng ngày (7 hoặc 30 ngày)
function ListenBars({ days, colors }: { days: ProgressDay[]; colors: string[] }) {
  const max = Math.max(5 * 60, ...days.map((d) => d.listenSeconds))
  const many = days.length > 7
  const empty = days.every((d) => d.listenSeconds < 30)
  return (
    <div className="card flex flex-col gap-4 p-[22px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Phút nghe mỗi ngày</span>
        <span className="text-xs text-fg3">{empty ? 'Khoảng này chưa nghe phút nào, không sao cả' : 'Chỉ tính lúc audio đang phát'}</span>
      </div>
      <div className={`grid h-[140px] items-end ${many ? 'gap-1' : 'gap-3'}`} style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d, i) => {
          const isToday = i === days.length - 1
          const mins = Math.round(d.listenSeconds / 60)
          const date = new Date(d.day + 'T00:00:00')
          const label = isToday ? 'Nay' : many ? (i % 5 === 4 || i === 0 ? `${date.getDate()}/${date.getMonth() + 1}` : '') : weekdayShort(d.day)
          return (
            <div key={d.day} className="flex h-full flex-col items-center justify-end gap-1.5" title={`${longDay(d.day)}: ${formatMinutes(d.listenSeconds)}`}>
              {!many && <span className="text-[11px] text-fg3">{d.listenSeconds >= 30 ? `${mins}'` : '–'}</span>}
              <div
                className="w-full max-w-[30px] rounded-t-md rounded-b-[3px]"
                style={{ height: Math.max(3, Math.round((d.listenSeconds / max) * 92)), background: d.listenSeconds >= 30 ? colors[isToday ? 4 : 3] : colors[0] }}
              />
              <span className="h-4 whitespace-nowrap text-[11px] text-fg3">{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Lịch ô vuông kiểu GitHub: mỗi cột là 1 tuần (Thứ Hai → Chủ Nhật), mới nhất bên phải.
// Ô co giãn theo chiều ngang thẻ; bên dưới là hàng số liệu kiểu trang thống kê của Claude.
function Heatmap({
  days,
  today,
  st,
  palette,
  onPalette
}: {
  days: ProgressDay[]
  today: string
  st: { current: number; longest: number; active: number }
  palette: Palette
  onPalette: (p: Palette) => void
}) {
  const [metric, setMetric] = useState<Metric>('listen')
  const [hover, setHover] = useState<ProgressDay | null>(null)
  const m = METRICS[metric]
  const colors = PALETTES[palette][isDark() ? 'dark' : 'light']

  // Bỏ tuần lẻ đầu tiên để cột đầu bắt đầu đúng Thứ Hai
  const mondayIdx = (day: string): number => (new Date(day + 'T00:00:00').getDay() + 6) % 7
  const cells = days.length ? days.slice((7 - mondayIdx(days[0].day)) % 7) : []
  const weeks: ProgressDay[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const level = (d: ProgressDay): number => m.steps.filter((s) => m.value(d) >= s).length

  // Nhãn tháng ở tuần chứa ngày 1 của tháng (bỏ 2 cột đầu cho khỏi chồng chữ)
  const monthLabel = (w: ProgressDay[], i: number): string | null => {
    if (i < 2) return null
    const first = w.find((d) => d.day.endsWith('-01'))
    return first ? `Th${Number(first.day.slice(5, 7))}` : null
  }

  const total = sum(cells)
  const shown = hover ?? days.at(-1)

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-[15px] font-semibold">
          {st.active} ngày có học trong năm qua
        </h2>
        <div className="flex items-center gap-3">
          <div role="group" aria-label="Tô màu theo" className="seg seg-sm">
            {(Object.keys(METRICS) as Metric[]).map((k) => (
              <button key={k} type="button" className="seg-btn" aria-pressed={metric === k} onClick={() => setMetric(k)}>
                {METRICS[k].label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Bộ màu" className="flex items-center gap-1.5">
            {(Object.keys(PALETTES) as Palette[]).map((p) => (
              <button
                key={p}
                type="button"
                title={PALETTES[p].label}
                aria-label={PALETTES[p].label}
                aria-pressed={palette === p}
                onClick={() => onPalette(p)}
                className="h-[18px] w-[18px] rounded-full border-2 p-0"
                style={{
                  background: PALETTES[p].light[3],
                  borderColor: palette === p ? 'var(--text)' : 'transparent'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="card flex flex-col gap-3 px-5 pb-4 pt-4">
        <div className="flex gap-2">
          {/* Nhãn thứ, giống GitHub chỉ hiện T2 / T4 / T6 */}
          <div className="flex flex-none flex-col gap-[3px] pt-[18px] text-[10px] text-fg3">
            {['T2', '', 'T4', '', 'T6', '', ''].map((t, i) => (
              <span key={i} className="flex flex-1 items-center">
                {t}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
              {weeks.map((w, wi) => (
                <span key={'m' + w[0].day} className="relative h-[15px]">
                  {monthLabel(w, wi) && <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] text-fg3">{monthLabel(w, wi)}</span>}
                </span>
              ))}
            </div>
            <div
              className="grid grid-flow-col grid-rows-7 gap-[3px] pt-[3px]"
              style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
              onMouseLeave={() => setHover(null)}
            >
              {cells.map((d) => (
                <span
                  key={d.day}
                  onMouseEnter={() => setHover(d)}
                  className="aspect-square rounded-[2px]"
                  style={{
                    background: colors[level(d)],
                    outline: d.day === today ? '1.5px solid var(--text2)' : undefined,
                    outlineOffset: 1
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-fg2">
            {shown && (
              <>
                <strong className="text-fg">{shown.day === today ? 'Hôm nay' : longDay(shown.day)}</strong>
                {isActive(shown)
                  ? ` · ${formatMinutes(shown.listenSeconds)} nghe · ${shown.newWords + shown.knownWords} từ mới · ${shown.reviews} lượt ôn` +
                    (shown.lessonsDone ? ` · ${shown.lessonsDone} bài` : '')
                  : ' · nghỉ'}
              </>
            )}
          </span>
          <span className="flex items-center gap-[3px] text-fg3">
            <span className="mr-1">Ít</span>
            {colors.map((c) => (
              <span key={c} className="h-[11px] w-[11px] rounded-[2px]" style={{ background: c }} />
            ))}
            <span className="ml-1">Nhiều</span>
          </span>
        </div>
      </div>

      {/* Hàng số liệu tổng, kiểu trang thống kê của Claude */}
      <div className="grid grid-cols-5 gap-3 max-[1100px]:grid-cols-3">
        <Fact label="Ngày có học" value={`${st.active}`} />
        <Fact label="Chuỗi hiện tại" value={`${st.current} ngày`} />
        <Fact label="Chuỗi dài nhất" value={`${st.longest} ngày`} />
        <Fact label="Tổng thời gian nghe" value={formatHours(total.listenSeconds)} />
        <Fact label="Tổng từ đã gặp" value={`${total.newWords + total.knownWords}`} />
      </div>
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-line px-4 py-3">
      <span className="text-xs text-fg3">{label}</span>
      <span className="text-lg font-semibold tracking-[-0.01em]">{value}</span>
    </div>
  )
}
