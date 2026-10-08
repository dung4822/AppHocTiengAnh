import { useEffect, useState } from 'react'
import { api, call } from './api'
import { AppProvider, useApp, type Route } from './appState'
import Sidebar from './components/Sidebar'
import Toaster from './components/Toaster'
import HomePage from './pages/HomePage'
import LessonPage from './pages/LessonPage'
import VocabPage from './pages/VocabPage'
import SettingsPage from './pages/SettingsPage'
import ReviewPage from './pages/ReviewPage'

export type { Route }

export default function App() {
  const [initial, setInitial] = useState<Route | null>(null)

  useEffect(() => {
    // Lần đầu mở app chưa có API key → đưa thẳng tới trang Cài đặt
    call(api.getSettings())
      .then((s) => setInitial(s.hasApiKey ? { page: 'home' } : { page: 'settings' }))
      .catch(() => setInitial({ page: 'home' }))
  }, [])

  if (!initial) return null
  return (
    <AppProvider initial={initial}>
      <Shell />
    </AppProvider>
  )
}

function Shell() {
  const { route } = useApp()

  // Bài học & Ôn tập là "chế độ tập trung": ẩn sidebar, chỉ có thanh trên cùng
  const focus = route.page === 'lesson' || route.page === 'review'

  return (
    <div className="flex h-full overflow-hidden bg-bg text-fg">
      {!focus && <Sidebar />}
      <div className="min-w-0 flex-1 overflow-hidden">
        {route.page === 'home' && <HomePage />}
        {route.page === 'lesson' && <LessonPage key={route.id} lessonId={route.id} />}
        {route.page === 'review' && <ReviewPage />}
        {route.page === 'vocab' && <VocabPage />}
        {route.page === 'settings' && <SettingsPage />}
      </div>
      <Toaster />
    </div>
  )
}
