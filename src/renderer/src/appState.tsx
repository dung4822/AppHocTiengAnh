import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { HomeStats, LessonListItem, ProgressEvent, ReviewCounts } from '@shared/types'
import { api, call, errMsg } from './api'

// "Điều hướng" đơn giản bằng state, không cần thư viện router
export type Route = { page: 'home' } | { page: 'lesson'; id: number } | { page: 'vocab' } | { page: 'review' } | { page: 'settings' }

// ===== Tiến trình tạo bài: 9 giai đoạn hiển thị (map từ ProgressEvent.stage của main) =====
export const GEN_STAGES = [
  'Chọn nội dung bài',
  'AI viết bài nghe',
  'Kiểm tra độ khó',
  'AI viết lại cho dễ hơn',
  'Lưu bài học',
  'Chuẩn bị giọng đọc',
  'Tạo audio',
  'Hoàn thiện giải thích ngữ pháp và chú thích script',
  'Mở bài'
]

export interface GenState {
  topic: string | null
  startedAt: number
  stageIdx: number // giai đoạn đang chạy (0–8)
  event: ProgressEvent | null // sự kiện mới nhất (để hiện % / MB)
  subs: Record<number, string> // dòng phụ cho từng giai đoạn ("Xong sau 41 giây")
  status: 'running' | 'error'
  error: string | null
}

export interface Toast {
  id: number
  kind: 'ok' | 'error'
  title: string
  body?: string
  action?: { label: string; onClick: () => void }
}

interface AppCtx {
  route: Route
  nav: (r: Route) => void
  stats: HomeStats | null
  lessons: LessonListItem[]
  counts: ReviewCounts | null
  refresh: () => void
  toast: (title: string, action?: Toast['action']) => void
  errorToast: (title: string, body?: string, action?: Toast['action']) => void
  toasts: Toast[]
  dismissToast: (id: number) => void
  gen: GenState | null
  createLesson: (topic: string | null) => void
  clearGenError: () => void
}

const Ctx = createContext<AppCtx | null>(null)

export function useApp(): AppCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp phải nằm trong <AppProvider>')
  return c
}

function stageIndex(e: ProgressEvent, current: number): number {
  switch (e.stage) {
    case 'select':
      return 0
    case 'generate':
      // "generate" xuất hiện 2 lần: lúc AI viết bài, và sau khi tạo audio (hoàn thiện giải thích)
      return current >= 4 ? 7 : 1
    case 'check':
      return 2
    case 'rewrite':
      return 3
    case 'save':
      return 4
    case 'model':
      return 5
    case 'audio':
      return 6
    case 'done':
      return 8
    default:
      return current
  }
}

export function AppProvider({ initial, children }: { initial: Route; children: React.ReactNode }) {
  const [route, setRoute] = useState<Route>(initial)
  const [stats, setStats] = useState<HomeStats | null>(null)
  const [lessons, setLessons] = useState<LessonListItem[]>([])
  const [counts, setCounts] = useState<ReviewCounts | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [gen, setGen] = useState<GenState | null>(null)
  const genRef = useRef<GenState | null>(null)
  genRef.current = gen
  const routeRef = useRef(route)
  routeRef.current = route
  const stageStartRef = useRef<number>(0)

  const refresh = useCallback(() => {
    call(api.getHomeStats()).then(setStats).catch(() => {})
    call(api.listLessons()).then(setLessons).catch(() => {})
    call(api.getReviewCounts()).then(setCounts).catch(() => {})
  }, [])

  const nav = useCallback((r: Route) => setRoute(r), [])

  // Mỗi lần đổi trang thì làm mới số liệu (sidebar, badge ôn tập...)
  useEffect(() => {
    refresh()
  }, [route, refresh])

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const toast = useCallback(
    (title: string, action?: Toast['action']) => {
      const id = Date.now() + Math.random()
      setToasts((t) => [...t.filter((x) => x.kind !== 'ok'), { id, kind: 'ok', title, action }])
      window.setTimeout(() => dismissToast(id), action ? 8000 : 3000)
    },
    [dismissToast]
  )

  const errorToast = useCallback((title: string, body?: string, action?: Toast['action']) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.filter((x) => x.kind !== 'error'), { id, kind: 'error', title, body, action }])
  }, [])

  // Nhận tiến trình tạo bài ở cấp App → rời trang chủ (đi ôn tập) vẫn theo dõi được
  useEffect(() => {
    return api.onProgress((e) => {
      const g = genRef.current
      if (!g || g.status !== 'running' || e.stage === 'error') return
      const idx = stageIndex(e, g.stageIdx)
      const subs = { ...g.subs }
      if (idx > g.stageIdx) {
        const secs = Math.round((Date.now() - stageStartRef.current) / 1000)
        if (g.stageIdx === 1) subs[1] = `Xong sau ${secs} giây`
        // Bỏ qua bước "viết lại" khi bài đã vừa sức
        if (g.stageIdx < 3 && idx > 3) subs[3] = 'Không cần — bài đã vừa sức'
        if (g.stageIdx === 3) subs[3] = 'Đã viết lại cho dễ hơn'
        if (g.stageIdx === 5 && idx > 5) subs[5] = 'Đã sẵn sàng'
        stageStartRef.current = Date.now()
      }
      if (idx === 3) subs[2] = e.message.replace(/, AI.*$/, '').replace('...', '')
      if (idx === 5) subs[5] = e.message
      if (idx === 6 && e.total) subs[6] = `${e.total} câu`
      const next: GenState = { ...g, stageIdx: Math.max(g.stageIdx, idx), event: e, subs }
      genRef.current = next
      setGen(next)
    })
  }, [])

  const createLesson = useCallback(
    (topic: string | null) => {
      if (genRef.current?.status === 'running') return
      stageStartRef.current = Date.now()
      const start: GenState = { topic, startedAt: Date.now(), stageIdx: 0, event: null, subs: {}, status: 'running', error: null }
      genRef.current = start
      setGen(start)
      call(api.createLesson(topic))
        .then((id) => {
          setGen(null)
          refresh()
          // Đang ở trang chủ thì mở bài luôn; đang làm việc khác (ôn tập...) thì chỉ báo
          if (routeRef.current.page === 'home') setRoute({ page: 'lesson', id })
          else toast('Bài mới đã tạo xong', { label: 'Mở bài', onClick: () => setRoute({ page: 'lesson', id }) })
        })
        .catch((e) => {
          const msg = errMsg(e)
          setGen((old) => (old ? { ...old, status: 'error', error: msg } : old))
          refresh() // bài có thể đã được lưu nhưng thiếu audio → hiện trong danh sách
          if (routeRef.current.page !== 'home') errorToast('Chưa tạo được bài mới', msg)
        })
    },
    [refresh, toast, errorToast]
  )

  const clearGenError = useCallback(() => setGen((g) => (g?.status === 'error' ? null : g)), [])

  const value = useMemo<AppCtx>(
    () => ({
      route,
      nav,
      stats,
      lessons,
      counts,
      refresh,
      toast,
      errorToast,
      toasts,
      dismissToast,
      gen,
      createLesson,
      clearGenError
    }),
    [route, nav, stats, lessons, counts, refresh, toast, errorToast, toasts, dismissToast, gen, createLesson, clearGenError]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
