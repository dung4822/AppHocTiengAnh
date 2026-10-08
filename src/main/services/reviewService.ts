import { fsrs, generatorParameters, State, type Card, type ReviewLog } from 'ts-fsrs'
import { getDb } from '../db'
import { UserError } from '../errors'
import {
  DAY_START_HOUR,
  KNOWN_STABILITY_DAYS,
  LEARN_AHEAD_MINUTES,
  LEARNING_STEPS,
  RELEARNING_STEPS
} from '../config'
import type { CardDirection, ReviewCardView, ReviewCounts, ReviewRating } from '@shared/types'
import { getSettings } from './settingsService'
import { audioUrl } from './audioUrl'
import { generateRescue, updateLeechFlag } from './leechService'
import type { LeechRescue } from '@shared/types'

// =====================================================================
// ÔN TẬP NGẮT QUÃNG (Giai đoạn 2) — PHẦN LÕI
// Lịch ôn do thư viện ts-fsrs tính (thuật toán FSRS-6 mà Anki đang dùng). KHÔNG tự viết công thức.
// Phần app tự làm chỉ là: chọn thẻ nào hiện tiếp theo, giới hạn mỗi ngày, thẻ anh em.
// =====================================================================

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

interface CardRow {
  id: number
  vocab_id: number
  direction: CardDirection
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review: number | null
}

interface LogRow {
  id: number
  card_id: number
  rating: number
  state: number
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  last_elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reviewed_at: number
}

// Tạo bộ lập lịch FSRS theo cài đặt hiện tại (mức nhớ mong muốn có thể đổi trong Cài đặt)
function scheduler() {
  return fsrs(
    generatorParameters({
      request_retention: getSettings().desiredRetention,
      maximum_interval: 36500,
      enable_fuzz: true, // trộn ngẫu nhiên nhẹ khoảng cách để thẻ không dồn cục vào cùng một ngày (như Anki)
      enable_short_term: true, // dùng các bước học 1 phút / 10 phút
      learning_steps: [...LEARNING_STEPS],
      relearning_steps: [...RELEARNING_STEPS]
    })
  )
}

// Đổi dòng DB ↔ kiểu Card của ts-fsrs (DB lưu thời gian dạng mili-giây)
function rowToCard(r: CardRow): Card {
  return {
    due: new Date(r.due),
    stability: r.stability,
    difficulty: r.difficulty,
    elapsed_days: r.elapsed_days,
    scheduled_days: r.scheduled_days,
    learning_steps: r.learning_steps,
    reps: r.reps,
    lapses: r.lapses,
    state: r.state as State,
    last_review: r.last_review !== null ? new Date(r.last_review) : undefined
  }
}

// Mốc bắt đầu "hôm nay" theo kiểu Anki: ngày mới bắt đầu lúc 4 giờ sáng
export function dayStart(now: number): number {
  const d = new Date(now)
  d.setHours(DAY_START_HOUR, 0, 0, 0)
  if (d.getTime() > now) d.setDate(d.getDate() - 1)
  return d.getTime()
}

// ----- Đếm số thẻ đã học hôm nay để áp giới hạn mỗi ngày -----
function doneToday(start: number): { newDone: number; reviewDone: number } {
  const db = getDb()
  // review_logs.state = trạng thái TRƯỚC khi ôn: 0 = lần đầu học thẻ mới, 2 = ôn thẻ tới hạn
  const newDone = (db.prepare('SELECT COUNT(*) AS n FROM review_logs WHERE state = 0 AND reviewed_at >= ?').get(start) as { n: number }).n
  const reviewDone = (db.prepare('SELECT COUNT(*) AS n FROM review_logs WHERE state = 2 AND reviewed_at >= ?').get(start) as { n: number }).n
  return { newDone, reviewDone }
}

// Điều kiện chung: từ không bị tạm ẩn
const NOT_SUSPENDED = 'JOIN vocab v ON v.id = c.vocab_id AND v.suspended = 0'

// Thẻ nói chỉ được mở khi thẻ nghe của cùng từ đã được ôn ít nhất 1 lần, và lần đầu đó phải từ NGÀY TRƯỚC
// (giống "bury siblings" của Anki: không học 2 chiều của cùng một từ trong cùng ngày giới thiệu → nhận biết trước, dùng sau)
const SPEAK_UNLOCKED = `(c.direction = 'listen' OR EXISTS (
  SELECT 1 FROM review_cards l
  WHERE l.vocab_id = c.vocab_id AND l.direction = 'listen' AND l.reps > 0
    AND (SELECT MIN(reviewed_at) FROM review_logs WHERE card_id = l.id) < @dayStart))`

interface Queues {
  learningNow: CardRow[] // đang trong bước học, đã tới hạn
  reviews: CardRow[] // thẻ ôn tới hạn hôm nay (đã áp giới hạn)
  news: CardRow[] // thẻ mới (đã áp giới hạn)
  learnAhead: CardRow[] // đang học, sắp tới hạn trong 20 phút
  learningToday: number // tổng thẻ đang học tới hạn trong hôm nay (để hiện số đếm)
}

function buildQueues(now: number): Queues {
  const db = getDb()
  const settings = getSettings()
  const start = dayStart(now)
  const nextDay = start + DAY
  const { newDone, reviewDone } = doneToday(start)
  const newLimit = Math.max(0, settings.newPerDay - newDone)
  const reviewLimit = Math.max(0, settings.reviewsPerDay - reviewDone)

  const learningNow = db
    .prepare(`SELECT c.* FROM review_cards c ${NOT_SUSPENDED} WHERE c.state IN (1, 3) AND c.due <= ? ORDER BY c.due`)
    .all(now) as CardRow[]
  const learnAhead = db
    .prepare(`SELECT c.* FROM review_cards c ${NOT_SUSPENDED} WHERE c.state IN (1, 3) AND c.due > ? AND c.due <= ? ORDER BY c.due`)
    .all(now, now + LEARN_AHEAD_MINUTES * MINUTE) as CardRow[]
  const learningToday = (
    db.prepare(`SELECT COUNT(*) AS n FROM review_cards c ${NOT_SUSPENDED} WHERE c.state IN (1, 3) AND c.due < ?`).get(nextDay) as {
      n: number
    }
  ).n
  // Thẻ ôn: tới hạn trước ngày mai, quá hạn lâu nhất ra trước
  const reviews = db
    .prepare(`SELECT c.* FROM review_cards c ${NOT_SUSPENDED} WHERE c.state = 2 AND c.due < ? ORDER BY c.due LIMIT ?`)
    .all(nextDay, reviewLimit) as CardRow[]
  // Thẻ mới: theo thứ tự từ được thêm vào (từ cũ trước), trong cùng một từ thì thẻ nghe trước thẻ nói
  const news = db
    .prepare(
      `SELECT c.* FROM review_cards c ${NOT_SUSPENDED}
       WHERE c.state = 0 AND ${SPEAK_UNLOCKED}
       ORDER BY c.vocab_id, CASE c.direction WHEN 'listen' THEN 0 ELSE 1 END LIMIT @limit`
    )
    .all({ dayStart: start, limit: newLimit }) as CardRow[]

  return { learningNow, reviews, news, learnAhead, learningToday }
}

export function getReviewCounts(now = Date.now()): ReviewCounts {
  const q = buildQueues(now)
  return { newCount: q.news.length, learningCount: q.learningToday, reviewCount: q.reviews.length }
}

// Chọn thẻ tiếp theo. Thứ tự ưu tiên (giống Anki):
//   1) thẻ đang học đã tới hạn (bước 1 phút / 10 phút)
//   2) thẻ ôn tới hạn
//   3) thẻ mới
//   4) hết thì cho học trước thẻ đang học sắp tới hạn trong 20 phút
// Không cho 2 thẻ của cùng một từ đứng liền nhau (nếu còn lựa chọn khác).
export function getNextCard(lastVocabId: number | null, now = Date.now()): ReviewCardView | null {
  const q = buildQueues(now)
  const ordered = [...q.learningNow, ...q.reviews, ...q.news, ...q.learnAhead]
  if (ordered.length === 0) return null
  const pick = ordered.find((c) => c.vocab_id !== lastVocabId) ?? ordered[0]
  return toView(pick, now, { newCount: q.news.length, learningCount: q.learningToday, reviewCount: q.reviews.length })
}

// Định dạng khoảng thời gian tới lần ôn sau, ví dụ "10 phút", "3 ngày", "1,5 tháng"
export function formatInterval(ms: number): string {
  const minutes = ms / MINUTE
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} phút`
  const hours = minutes / 60
  if (hours < 24) return `${Math.round(hours)} giờ`
  const days = hours / 24
  if (days < 30) return `${Math.round(days)} ngày`
  if (days < 365) return `${(days / 30).toFixed(1).replace('.', ',').replace(',0', '')} tháng`
  return `${(days / 365).toFixed(1).replace('.', ',').replace(',0', '')} năm`
}

function toView(row: CardRow, now: number, counts: ReviewCounts): ReviewCardView {
  const db = getDb()
  const v = db
    .prepare(
      `SELECT v.text, v.meaning_vi, v.context_vi, v.example_en, v.example_vi, v.example_audio_path,
              v.leech, v.rescue_json, v.rescue_audio_json,
              s.text AS sentence_text, s.audio_path AS sentence_audio
       FROM vocab v LEFT JOIN sentences s ON s.id = v.context_sentence_id WHERE v.id = ?`
    )
    .get(row.vocab_id) as {
    text: string
    meaning_vi: string
    context_vi: string | null
    example_en: string | null
    example_vi: string | null
    example_audio_path: string | null
    sentence_text: string | null
    sentence_audio: string | null
    leech: number
    rescue_json: string | null
    rescue_audio_json: string | null
  }

  // Xem trước kết quả của cả 4 nút để hiện khoảng thời gian trên nút (lấy thẳng từ ts-fsrs)
  const preview = scheduler().repeat(rowToCard(row), new Date(now))
  const intervals = {} as Record<ReviewRating, string>
  for (const g of [1, 2, 3, 4] as ReviewRating[]) {
    intervals[g] = formatInterval(preview[g].card.due.getTime() - now)
  }

  // Ưu tiên câu trong bài học (có audio sẵn), không có thì dùng câu ví dụ lúc tra từ
  const useLessonSentence = v.sentence_text !== null
  let sentenceEn = useLessonSentence ? v.sentence_text : v.example_en
  let sentenceVi = useLessonSentence ? v.context_vi : v.example_vi
  let audio = useLessonSentence ? v.sentence_audio : v.example_audio_path

  // Từ hay quên: xoay vòng giữa câu gốc và các câu MỚI do AI viết (gặp từ trong nhiều ngữ cảnh → hiểu từ, không thuộc vẹt câu)
  const rescue: LeechRescue | null = v.rescue_json ? JSON.parse(v.rescue_json) : null
  const rescueAudio: string[] = v.rescue_audio_json ? JSON.parse(v.rescue_audio_json) : []
  if (v.leech && rescue && rescueAudio.length === rescue.examples.length) {
    const k = row.reps % (rescue.examples.length + 1) // 0 = câu gốc
    if (k > 0) {
      sentenceEn = rescue.examples[k - 1].en
      sentenceVi = rescue.examples[k - 1].vi
      audio = rescueAudio[k - 1]
    }
  }
  if (v.leech && !rescue) void generateRescue(row.vocab_id) // chưa có (lần trước lỗi) → tạo bù ở nền

  return {
    cardId: row.id,
    vocabId: row.vocab_id,
    direction: row.direction,
    state: row.state as 0 | 1 | 2 | 3,
    text: v.text,
    meaningVi: v.meaning_vi,
    sentenceEn,
    sentenceVi,
    audioUrl: audioUrl(audio),
    isLeech: v.leech === 1,
    rescue,
    intervals,
    counts
  }
}

// Chấm một thẻ: ts-fsrs tính trạng thái mới + bản ghi lịch sử, mình chỉ việc lưu lại
export function answerCard(cardId: number, rating: ReviewRating, now = Date.now()): number {
  if (![1, 2, 3, 4].includes(rating)) throw new UserError('Mức chấm không hợp lệ.')
  const db = getDb()
  const row = db.prepare('SELECT * FROM review_cards WHERE id = ?').get(cardId) as CardRow | undefined
  if (!row) throw new UserError('Không tìm thấy thẻ này (có thể đã bị xóa).')

  const result = scheduler().next(rowToCard(row), new Date(now), rating as unknown as Parameters<ReturnType<typeof fsrs>['next']>[2])
  const c = result.card
  const log = result.log

  const result_logId = db.transaction((): number => {
    db.prepare(
      `UPDATE review_cards SET due = ?, stability = ?, difficulty = ?, elapsed_days = ?, scheduled_days = ?,
         learning_steps = ?, reps = ?, lapses = ?, state = ?, last_review = ? WHERE id = ?`
    ).run(
      c.due.getTime(),
      c.stability,
      c.difficulty,
      c.elapsed_days,
      c.scheduled_days,
      c.learning_steps,
      c.reps,
      c.lapses,
      c.state,
      c.last_review ? c.last_review.getTime() : now,
      cardId
    )
    const logId = Number(
      db
        .prepare(
          `INSERT INTO review_logs (card_id, rating, state, due, stability, difficulty, elapsed_days, last_elapsed_days,
             scheduled_days, learning_steps, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          cardId,
          log.rating,
          log.state,
          log.due.getTime(),
          log.stability,
          log.difficulty,
          log.elapsed_days,
          log.last_elapsed_days,
          log.scheduled_days,
          log.learning_steps,
          log.review.getTime()
        ).lastInsertRowid
    )
    updateVocabStatus(row.vocab_id)
    return logId
  })()
  // Vừa thành "từ hay quên" → AI viết nội dung cứu trợ ở nền (không bắt bạn đợi)
  if (updateLeechFlag(row.vocab_id)) void generateRescue(row.vocab_id)
  return result_logId
}

// Hoàn tác lần chấm gần nhất (Ctrl+Z như Anki): dùng rollback của ts-fsrs để trả thẻ về trạng thái cũ
export function undoReview(logId: number): void {
  const db = getDb()
  const log = db.prepare('SELECT * FROM review_logs WHERE id = ?').get(logId) as LogRow | undefined
  if (!log) throw new UserError('Không còn gì để hoàn tác.')
  const latest = db.prepare('SELECT MAX(id) AS id FROM review_logs WHERE card_id = ?').get(log.card_id) as { id: number }
  if (latest.id !== logId) throw new UserError('Chỉ hoàn tác được lần chấm gần nhất của thẻ.')
  const row = db.prepare('SELECT * FROM review_cards WHERE id = ?').get(log.card_id) as CardRow

  const fsrsLog: ReviewLog = {
    rating: log.rating,
    state: log.state as State,
    due: new Date(log.due),
    stability: log.stability,
    difficulty: log.difficulty,
    elapsed_days: log.elapsed_days,
    last_elapsed_days: log.last_elapsed_days,
    scheduled_days: log.scheduled_days,
    learning_steps: log.learning_steps,
    review: new Date(log.reviewed_at)
  }
  const prev = scheduler().rollback(rowToCard(row), fsrsLog)

  db.transaction(() => {
    db.prepare(
      `UPDATE review_cards SET due = ?, stability = ?, difficulty = ?, elapsed_days = ?, scheduled_days = ?,
         learning_steps = ?, reps = ?, lapses = ?, state = ?, last_review = ? WHERE id = ?`
    ).run(
      prev.due.getTime(),
      prev.stability,
      prev.difficulty,
      prev.elapsed_days,
      prev.scheduled_days,
      prev.learning_steps,
      prev.reps,
      prev.lapses,
      prev.state,
      prev.last_review ? prev.last_review.getTime() : null,
      row.id
    )
    db.prepare('DELETE FROM review_logs WHERE id = ?').run(logId)
    updateVocabStatus(row.vocab_id)
  })()
  updateLeechFlag(row.vocab_id)
}

// Xác suất còn nhớ (R, 0..1) thấp nhất trong các thẻ đã ôn của một từ; null = chưa ôn thẻ nào.
// Tính bằng đường cong quên của FSRS (ts-fsrs), dùng cho thuật toán chọn cụm lồng vào bài nghe.
export function vocabRetrievability(vocabId: number, now = Date.now()): number | null {
  const rows = getDb().prepare('SELECT * FROM review_cards WHERE vocab_id = ? AND reps > 0').all(vocabId) as CardRow[]
  if (rows.length === 0) return null
  const f = scheduler()
  return Math.min(...rows.map((r) => f.get_retrievability(rowToCard(r), new Date(now), false)))
}

// vocab.status: chưa ôn lần nào = new; thẻ nghe VÀ thẻ nói đều có stability ≥ 21 ngày = known; còn lại = learning
export function updateVocabStatus(vocabId: number): void {
  const db = getDb()
  const cards = db.prepare('SELECT reps, stability FROM review_cards WHERE vocab_id = ?').all(vocabId) as {
    reps: number
    stability: number
  }[]
  let status = 'new'
  if (cards.some((c) => c.reps > 0)) {
    status = cards.length === 2 && cards.every((c) => c.stability >= KNOWN_STABILITY_DAYS) ? 'known' : 'learning'
  }
  db.prepare('UPDATE vocab SET status = ? WHERE id = ?').run(status, vocabId)
}
