import { getDb } from '../db'
import { DAY_START_HOUR } from '../config'
import type { ProgressDay, ProgressData } from '@shared/types'
import { dayKey } from './listeningService'

// =====================================================================
// THÀNH QUẢ: số liệu từng ngày (nghe, từ mới, ôn thẻ, bài xong) cho trang "Thành quả".
// Ngày tính theo mốc DAY_START_HOUR giờ sáng giống phần ôn tập.
// =====================================================================

const DAYS = 53 * 7 // đủ cho lịch kiểu GitHub 53 tuần

export function getProgress(now = Date.now()): ProgressData {
  const db = getDb()
  const shift = `'-${DAY_START_HOUR} hours'`
  // Cột giờ dạng chuỗi UTC của SQLite → ngày theo giờ máy, đã lùi mốc đầu ngày
  const dayOf = (col: string): string => `date(${col}, 'localtime', ${shift})`

  const days = new Map<string, ProgressDay>()
  const get = (day: string): ProgressDay => {
    let d = days.get(day)
    if (!d) days.set(day, (d = { day, listenSeconds: 0, newWords: 0, knownWords: 0, reviews: 0, lessonsDone: 0 }))
    return d
  }

  const add = (sql: string, field: Exclude<keyof ProgressDay, 'day'>): void => {
    for (const r of db.prepare(sql).all() as { day: string; n: number }[]) get(r.day)[field] += r.n
  }
  add('SELECT day, SUM(seconds) AS n FROM listening_log GROUP BY day', 'listenSeconds')
  add(`SELECT ${dayOf('created_at')} AS day, COUNT(*) AS n FROM vocab GROUP BY day`, 'newWords')
  add(`SELECT ${dayOf('updated_at')} AS day, COUNT(*) AS n FROM words WHERE status = 'known' GROUP BY day`, 'knownWords')
  add(
    `SELECT ${dayOf("reviewed_at / 1000, 'unixepoch'")} AS day, COUNT(*) AS n FROM review_logs GROUP BY day`,
    'reviews'
  )
  add(`SELECT ${dayOf('done_at')} AS day, COUNT(*) AS n FROM lessons WHERE done_at IS NOT NULL GROUP BY day`, 'lessonsDone')

  // Trả đủ DAYS ngày liên tục (cũ → mới), ngày không học có số 0
  const out: ProgressDay[] = []
  for (let i = DAYS - 1; i >= 0; i--) {
    const k = dayKey(now - i * 86400000)
    out.push(days.get(k) ?? { day: k, listenSeconds: 0, newWords: 0, knownWords: 0, reviews: 0, lessonsDone: 0 })
  }
  return { today: dayKey(now), days: out }
}
