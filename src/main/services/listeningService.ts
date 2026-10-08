import { getDb } from '../db'
import type { ListeningStats } from '@shared/types'
import { dayStart } from './reviewService'

// =====================================================================
// THỜI GIAN NGHE: giao diện đo thời gian audio THẬT SỰ đang phát rồi gửi về đây cộng dồn theo ngày.
// Ngày tính theo mốc 4 giờ sáng (giống phần ôn tập), để nghe khuya vẫn tính vào hôm đó.
// =====================================================================

export type ListenSource = 'lesson' | 'review' | 'other'

function dayKey(ms: number): string {
  const d = new Date(dayStart(ms))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addListeningTime(seconds: number, source: ListenSource): void {
  // Chặn số bất thường (ví dụ máy ngủ giữa chừng): mỗi lần gửi tối đa 10 phút
  if (!(seconds > 0)) return
  const s = Math.min(seconds, 600)
  const src: ListenSource = ['lesson', 'review'].includes(source) ? source : 'other'
  getDb()
    .prepare(
      `INSERT INTO listening_log (day, source, seconds) VALUES (?, ?, ?)
       ON CONFLICT(day, source) DO UPDATE SET seconds = seconds + excluded.seconds`
    )
    .run(dayKey(Date.now()), src, s)
}

export function getListeningStats(now = Date.now()): ListeningStats {
  const db = getDb()
  const rows = db.prepare('SELECT day, SUM(seconds) AS s FROM listening_log GROUP BY day').all() as { day: string; s: number }[]
  const byDay = new Map(rows.map((r) => [r.day, r.s]))
  const today = dayKey(now)

  // 7 ngày gần nhất (cũ → mới) cho biểu đồ cột nhỏ
  const last7: { day: string; seconds: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const k = dayKey(now - i * 86400000)
    last7.push({ day: k, seconds: byDay.get(k) ?? 0 })
  }

  // Chuỗi ngày liên tiếp có nghe ít nhất 1 phút (hôm nay chưa nghe thì tính tới hôm qua)
  let streak = 0
  for (let i = 0; i < 3650; i++) {
    const k = dayKey(now - i * 86400000)
    if ((byDay.get(k) ?? 0) >= 60) streak++
    else if (i === 0) continue
    else break
  }

  const bySource = db.prepare('SELECT source, SUM(seconds) AS s FROM listening_log GROUP BY source').all() as { source: string; s: number }[]
  return {
    todaySeconds: byDay.get(today) ?? 0,
    totalSeconds: rows.reduce((a, r) => a + r.s, 0),
    last7,
    streakDays: streak,
    lessonSeconds: bySource.find((r) => r.source === 'lesson')?.s ?? 0,
    reviewSeconds: bySource.find((r) => r.source === 'review')?.s ?? 0
  }
}
