import { BookOpen, Flame, Headphones, Layers, SlidersHorizontal, Sun } from 'lucide-react'
import type { LessonListItem } from '@shared/types'
import { useApp, type Route } from '../appState'
import { formatMinutes } from '../format'

const DOT: Record<LessonListItem['status'], string> = {
  ready: 'var(--blue)',
  done: 'var(--known)',
  audio_pending: 'var(--leech)'
}

// Sidebar trái 236px (thu gọn còn icon khi cửa sổ hẹp)
export default function Sidebar() {
  const { route, nav, stats, lessons } = useApp()

  const item = (page: Route['page'], label: string, icon: React.ReactNode, badge?: React.ReactNode) => {
    const active = route.page === page
    return (
      <button
        type="button"
        onClick={() => nav({ page } as Route)}
        title={label}
        className={
          'flex h-9 w-full items-center gap-2.5 rounded-lg border-0 px-2.5 text-left font-[inherit] transition-colors ' +
          (active ? 'bg-surface2 font-semibold text-fg' : 'bg-transparent font-medium text-fg2 hover:bg-surface2 hover:text-fg')
        }
      >
        <span className="flex-none">{icon}</span>
        <span className="flex-1 max-[1000px]:hidden">{label}</span>
        <span className="max-[1000px]:hidden">{badge}</span>
      </button>
    )
  }

  const streak = stats?.listening.streakDays ?? 0
  const today = stats?.listening.todaySeconds ?? 0

  return (
    <nav
      aria-label="Điều hướng chính"
      className="flex w-[236px] flex-none flex-col gap-[22px] overflow-y-auto border-r border-line bg-surface px-3.5 py-[18px] max-[1000px]:w-[68px]"
    >
      <div className="flex items-center gap-2.5 px-2 py-0.5">
        <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg bg-ink text-onink">
          <Headphones size={17} strokeWidth={2} />
        </div>
        <div className="text-[15px] font-bold tracking-[-0.01em] max-[1000px]:hidden">Luyện Nghe</div>
      </div>

      <div className="flex flex-col gap-0.5">
        {item('home', 'Hôm nay', <Sun size={17} strokeWidth={1.8} />)}
        {item(
          'review',
          'Ôn tập',
          <Layers size={17} strokeWidth={1.8} />,
          stats && stats.dueToday > 0 ? <span className="chip bg-blue-soft px-2 py-px text-blue">{stats.dueToday}</span> : null
        )}
        {item('vocab', 'Từ vựng', <BookOpen size={17} strokeWidth={1.8} />, stats ? <span className="text-xs text-fg3">{stats.vocabCount}</span> : null)}
        {item('settings', 'Cài đặt', <SlidersHorizontal size={17} strokeWidth={1.8} />)}
      </div>

      {lessons.length > 0 && (
        <div className="flex flex-col gap-0.5 max-[1000px]:hidden">
          <div className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg3">Bài gần đây</div>
          {lessons.slice(0, 5).map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => nav({ page: 'lesson', id: l.id })}
              title={l.title}
              className="flex h-[34px] w-full items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 text-left font-[inherit] text-fg2 hover:bg-surface2 hover:text-fg"
            >
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: DOT[l.status] }} />
              <span className="flex-1 truncate">{l.title}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center gap-2.5 rounded-[10px] bg-surface2 p-3 max-[1000px]:justify-center max-[1000px]:p-2">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-leech-soft text-leech">
          <Flame size={17} strokeWidth={1.8} />
        </div>
        <div className="flex min-w-0 flex-col max-[1000px]:hidden">
          <span className="font-semibold">{streak > 0 ? `Chuỗi ${streak} ngày` : 'Chưa có chuỗi ngày'}</span>
          <span className="text-xs text-fg3">
            {today >= 1 ? `Hôm nay đã nghe ${formatMinutes(today)}` : 'Nghe ≥ 1 phút mỗi ngày để giữ chuỗi'}
          </span>
        </div>
      </div>
    </nav>
  )
}
