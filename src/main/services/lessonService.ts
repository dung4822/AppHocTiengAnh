import { join } from 'node:path'
import { getDb } from '../db'
import { UserError } from '../errors'
import { lessonAudioDir } from '../paths'
import {
  MAX_REVIEW_CHUNKS,
  RECALL_ZONE_MAX,
  RECALL_ZONE_MIN,
  MIN_KNOWN_RATIO,
  NEW_CHUNKS_MAX,
  NEW_CHUNKS_MIN,
  TOPICS,
  TOPICS_EN,
  ZIPF_THRESHOLD
} from '../config'
import type {
  GrammarExplanation,
  HomeStats,
  LessonChunk,
  LessonDetail,
  LessonListItem,
  LessonStatus,
  ProgressEvent,
  Question,
  QuestionType
} from '@shared/types'
import { callJson } from './deepseek'
import { getSettings } from './settingsService'
import { analyzeDifficulty, normalizeTerm, tokenize } from './wordInfo'
import { tts } from './tts/kokoroProvider'
import { audioUrl, toRelativeAudioPath } from './audioUrl'
import { getReviewCounts, vocabRetrievability } from './reviewService'
import { enrichLesson, isGrammarV2 } from './enrichService'
import { clusterPendingVocab, getVocabCount } from './unitService'
import { getListeningStats } from './listeningService'
import { countMarkableWords, getLessonWordStates, onLessonFinished, personalWordSets, wordCounts } from './wordService'
import { existsSync, rmSync } from 'node:fs'
import { audioRoot } from '../paths'
import { toAbsoluteAudioPath } from './audioUrl'
import { LESSON_SYSTEM, buildLessonUserMessage, lessonSchema, type LessonJson } from '../prompts/lessonPrompt'
import { REWRITE_SYSTEM, buildRewriteUserMessage, rewriteSchema } from '../prompts/rewritePrompt'

type Progress = (e: ProgressEvent) => void

interface GrammarRow {
  id: number
  code: string
  name_vi: string
  name_en: string
  description_en: string
  is_core: number
  order_no: number
}

interface ReviewChunk {
  id: number
  text: string
}

// =====================================================================
// 5.1 CHỌN NỘI DUNG BÀI (logic local, không gọi AI) — PHẦN LÕI
// =====================================================================

// "Đã dạy" = đã có bài học dùng điểm ngữ pháp đó (kể cả bài chưa học xong),
// để tạo 2 bài liên tiếp không bị trùng cùng một điểm mới.
export function selectGrammar(): { point: GrammarRow; isReview: boolean } {
  const db = getDb()
  const lessonCount = (db.prepare('SELECT COUNT(*) AS n FROM lessons').get() as { n: number }).n
  const lessonNo = lessonCount + 1 // số thứ tự của bài sắp tạo

  const untaught = (isCore: number): GrammarRow | undefined =>
    db
      .prepare(
        `SELECT * FROM grammar_points g
         WHERE g.is_core = ? AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.grammar_point_id = g.id)
         ORDER BY g.order_no LIMIT 1`
      )
      .get(isCore) as GrammarRow | undefined

  // Điểm đã dạy mà lâu chưa gặp nhất (dựa vào bài gần nhất dùng điểm đó)
  const oldestTaught = (): GrammarRow | undefined =>
    db
      .prepare(
        `SELECT g.* FROM grammar_points g JOIN lessons l ON l.grammar_point_id = g.id
         GROUP BY g.id ORDER BY MAX(l.created_at) ASC, MAX(l.id) ASC LIMIT 1`
      )
      .get() as GrammarRow | undefined

  // Cứ mỗi bài thứ 4 là bài ôn
  if (lessonNo % 4 === 0) {
    const review = oldestTaught()
    if (review) return { point: review, isReview: true }
  }

  const nextCore = untaught(1)
  const nextExt = untaught(0)

  if (nextCore) {
    // Chưa dạy hết core: điểm mở rộng chỉ được chen vào tối đa 1 trong 5 bài (bài thứ 5, 10, 15...)
    if (lessonNo % 5 === 0 && nextExt) return { point: nextExt, isReview: false }
    return { point: nextCore, isReview: false }
  }
  // Đã dạy hết core: dạy tiếp điểm mở rộng, hết nốt thì ôn
  if (nextExt) return { point: nextExt, isReview: false }
  const review = oldestTaught()
  if (!review) throw new UserError('Không tìm thấy điểm ngữ pháp nào trong DB.')
  return { point: review, isReview: true }
}

// THUẬT TOÁN "GẶP LẠI" trong bài nghe (docs/THIET_KE_TU_VUNG.md): chọn tối đa 5 cụm đã học để lồng vào bài mới.
// Mỗi cụm được chấm điểm:
//   +3  xác suất còn nhớ R (theo FSRS) trong vùng 70–92% = SẮP QUÊN → gặp lại lúc này hiệu quả nhất
//   +2  R < 70% (đã quên khá nhiều)          +1  chưa ôn thẻ lần nào (bài nghe là lần gặp lại đầu tiên)
//   +3  từ hay quên (leech)
//   +0..2  gặp trong bài nghe còn ít lần (cần nhiều lần gặp mới nhớ lâu)
//   −3  vừa gặp trong bài nghe 2 ngày gần đây (giãn cách)
export function selectReviewChunks(now = Date.now()): ReviewChunk[] {
  const rows = getDb()
    .prepare(
      `SELECT v.id, v.text, v.leech, v.last_seen_at,
              (SELECT COUNT(*) FROM lesson_chunks lc WHERE lc.vocab_id = v.id) AS exposures
       FROM vocab v WHERE v.suspended = 0`
    )
    .all() as { id: number; text: string; leech: number; last_seen_at: string | null; exposures: number }[]

  const scored = rows.map((r) => {
    const R = vocabRetrievability(r.id, now)
    let score = 0
    if (R === null) score += 1
    else if (R >= RECALL_ZONE_MIN && R <= RECALL_ZONE_MAX) score += 3
    else if (R < RECALL_ZONE_MIN) score += 2
    if (r.leech) score += 3
    score += (Math.max(0, 6 - r.exposures) / 6) * 2
    if (r.last_seen_at) {
      const seen = new Date(r.last_seen_at.replace(' ', 'T') + 'Z').getTime()
      if (now - seen < 2 * 24 * 3600 * 1000) score -= 3
    }
    // Thêm chút ngẫu nhiên để các cụm điểm bằng nhau không lần nào cũng theo một thứ tự
    return { r, score: score + Math.random() * 0.1, R }
  })
  scored.sort((a, b) => b.score - a.score)
  const picked = scored.slice(0, MAX_REVIEW_CHUNKS)
  for (const p of picked) {
    console.log(`[lesson] cụm ôn "${p.r.text}": điểm ${p.score.toFixed(2)}, R=${p.R === null ? '-' : p.R.toFixed(2)}`)
  }
  return picked.map((p) => ({ id: p.r.id, text: p.r.text }))
}

function recentTitles(): string[] {
  return (getDb().prepare('SELECT title FROM lessons ORDER BY id DESC LIMIT 10').all() as { title: string }[]).map(
    (r) => r.title
  )
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function listTopics(): string[] {
  return TOPICS
}

// =====================================================================
// TẠO BÀI MỚI: chọn nội dung → gọi AI → kiểm tra độ khó → lưu DB → tạo audio
// =====================================================================

let creating = false
let creatingLessonId: number | null = null // bài đang tạo dở (không cho xóa lúc đang tạo)

export async function createLesson(topicInput: string | null, progress: Progress): Promise<number> {
  if (creating) throw new UserError('Đang tạo một bài khác, đợi bài đó xong nhé.')
  creating = true
  try {
    const settings = getSettings()

    // ---- 5.1 Chọn nội dung (local) ----
    progress({ stage: 'select', message: 'Đang chọn nội dung bài...' })
    const topic = topicInput && topicInput.trim() ? topicInput.trim() : TOPICS[randomInt(0, TOPICS.length - 1)]
    const { point, isReview } = selectGrammar()
    const reviewChunks = selectReviewChunks()
    const newChunkCount = randomInt(NEW_CHUNKS_MIN, NEW_CHUNKS_MAX)
    console.log(
      `[lesson] chủ đề="${topic}", ngữ pháp=${point.code}${isReview ? ' (ôn)' : ''}, cụm mới=${newChunkCount}, cụm ôn=${reviewChunks.length}`
    )

    // ---- 5.2 Gọi DeepSeek đúng 1 lần (zod validate, JSON lỗi thì callJson tự thử lại 1 lần) ----
    progress({ stage: 'generate', message: 'AI đang viết bài nghe (khoảng 30–60 giây)...' })
    const lesson = await callJson(
      {
        purpose: 'lesson',
        system: LESSON_SYSTEM,
        user: buildLessonUserMessage({
          level: settings.level,
          topic: TOPICS_EN[topic] ?? topic,
          grammarName: point.name_en,
          grammarDescription: point.description_en,
          isGrammarReview: isReview,
          newChunkCount,
          reviewChunks: reviewChunks.map((c) => c.text),
          recentTitles: recentTitles()
        }),
        temperature: 0.8,
        maxTokens: 6000
      },
      lessonSchema
    )
    sanitizeLesson(lesson)

    // ---- 5.3 Kiểm tra độ khó (local), nếu < 90% thì nhờ AI viết lại tối đa 1 lần ----
    progress({ stage: 'check', message: 'Đang kiểm tra độ khó của bài...' })
    const threshold = ZIPF_THRESHOLD[settings.level]
    const chunkTexts = lesson.chunks.map((c) => c.text)
    const personal = personalWordSets()
    let report = analyzeDifficulty(lesson.sentences.map((s) => s.text), threshold, chunkTexts, personal)
    console.log(
      `[lesson] tỉ lệ từ quen: ${(report.ratio * 100).toFixed(1)}% (${report.knownWords}/${report.totalWords}), từ lạ: ${report.hardWords.join(', ') || '(không có)'}`
    )
    if (report.ratio < MIN_KNOWN_RATIO && report.hardWords.length > 0) {
      progress({ stage: 'rewrite', message: `Bài hơi khó (${Math.round(report.ratio * 100)}% từ quen), AI đang viết lại cho dễ hơn...` })
      try {
        await rewriteHardSentences(lesson, report.hardWords, settings.level)
        report = analyzeDifficulty(lesson.sentences.map((s) => s.text), threshold, chunkTexts, personal)
        console.log(`[lesson] sau khi viết lại: ${(report.ratio * 100).toFixed(1)}% từ quen`)
      } catch (err) {
        // Viết lại thất bại thì vẫn dùng bài gốc, không bỏ cả bài
        console.warn('[lesson] viết lại thất bại, dùng bài gốc', err)
      }
    }

    // ---- 5.5b Lưu bài + tạo thẻ trong MỘT transaction ----
    progress({ stage: 'save', message: 'Đang lưu bài học...' })
    const lessonId = saveLesson(lesson, {
      topic,
      grammarPointId: point.id,
      isReview,
      level: settings.level,
      knownRatio: report.ratio,
      reviewChunks
    })

    creatingLessonId = lessonId

    // ---- Làm giàu bài (ngữ pháp chi tiết + chú thích script) chạy SONG SONG với tạo audio ----
    // enrichLesson không bao giờ ném lỗi (trả về danh sách lỗi); thiếu phần nào thì mở bài sẽ tự tạo lại.
    const enrichPromise = enrichLesson(lessonId)

    // ---- 5.4 Tạo audio từng câu ----
    await generateMissingAudio(lessonId, progress)
    progress({ stage: 'generate', message: 'Đang hoàn thiện giải thích ngữ pháp và chú thích script...' })
    const enrichErrors = await enrichPromise
    if (enrichErrors.length) console.warn('[lesson] làm giàu bài chưa xong:', enrichErrors)
    void clusterPendingVocab() // xếp các thẻ mới vào đơn vị nghĩa (chạy nền)
    progress({ stage: 'done', message: 'Đã tạo xong bài!' })
    return lessonId
  } finally {
    creating = false
    creatingLessonId = null
  }
}

// Sửa các chỉ số câu AI trả về bị sai (ngoài phạm vi), để không làm hỏng giao diện
function sanitizeLesson(lesson: LessonJson): void {
  const n = lesson.sentences.length
  const valid = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < n
  for (const q of lesson.questions) q.evidence = [...new Set(q.evidence.filter(valid))]
  for (const c of lesson.chunks) {
    // Nếu câu được chỉ ra không chứa cụm, thử tìm câu khác chứa cụm đó
    const lower = c.text.toLowerCase()
    if (!valid(c.sentence_idx) || !lesson.sentences[c.sentence_idx].text.toLowerCase().includes(lower)) {
      const found = lesson.sentences.findIndex((s) => s.text.toLowerCase().includes(lower))
      if (found >= 0) c.sentence_idx = found
      else if (!valid(c.sentence_idx)) c.sentence_idx = 0
    }
  }
}

async function rewriteHardSentences(lesson: LessonJson, hardWords: string[], level: string): Promise<void> {
  const hardSet = new Set(hardWords)
  // Chỉ gửi những câu có chứa từ lạ
  const targets = lesson.sentences
    .map((s, idx) => ({ idx, text: s.text }))
    .filter((s) => tokenize(s.text).some((t) => hardSet.has(t.word)))
  if (targets.length === 0) return

  const result = await callJson(
    {
      purpose: 'rewrite',
      system: REWRITE_SYSTEM,
      user: buildRewriteUserMessage({ level, sentences: targets, hardWords, keep: lesson.chunks.map((c) => c.text) }),
      temperature: 0.4,
      maxTokens: 2500
    },
    rewriteSchema
  )
  const allowed = new Set(targets.map((t) => t.idx))
  for (const s of result.sentences) {
    if (allowed.has(s.idx)) lesson.sentences[s.idx].text = s.text
  }
  // Câu ví dụ ngữ pháp được chép từ script → nếu câu đó vừa bị viết lại thì ví dụ vẫn giữ nguyên bản cũ (chấp nhận được)
}

// Dạng gốc của cả cụm, dùng để so cụm ôn AI trả về với cụm trong vocab (AI có thể đổi thì: run → ran)
function lemmaKey(text: string): string {
  return tokenize(text)
    .map((t) => t.lemma)
    .join(' ')
}

function matchReviewChunk(text: string, reviewChunks: ReviewChunk[], used: Set<number>): ReviewChunk | null {
  const key = lemmaKey(text)
  const exact = reviewChunks.find((r) => !used.has(r.id) && (normalizeTerm(r.text) === normalizeTerm(text) || lemmaKey(r.text) === key))
  if (exact) return exact
  // Gần đúng: trùng ít nhất một nửa số từ gốc
  const words = new Set(key.split(' '))
  let best: ReviewChunk | null = null
  let bestScore = 0
  for (const r of reviewChunks) {
    if (used.has(r.id)) continue
    const rw = lemmaKey(r.text).split(' ')
    const overlap = rw.filter((w) => words.has(w)).length / rw.length
    if (overlap >= 0.5 && overlap > bestScore) {
      best = r
      bestScore = overlap
    }
  }
  return best
}

function saveLesson(
  lesson: LessonJson,
  meta: { topic: string; grammarPointId: number; isReview: boolean; level: string; knownRatio: number; reviewChunks: ReviewChunk[] }
): number {
  const db = getDb()
  const grammar: GrammarExplanation = lesson.grammar

  // db.transaction(fn) trả về một hàm; gọi hàm đó thì mọi lệnh bên trong chạy trong 1 transaction.
  // Lỗi giữa chừng → tự động ROLLBACK, không để lại dữ liệu nửa vời (giống TransactionScope trong C#).
  const run = db.transaction((): number => {
    const lessonId = Number(
      db
        .prepare(
          `INSERT INTO lessons (topic, title, grammar_point_id, is_grammar_review, level, grammar_explanation_json, known_ratio, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'audio_pending')`
        )
        .run(meta.topic, lesson.title, meta.grammarPointId, meta.isReview ? 1 : 0, meta.level, JSON.stringify(grammar), meta.knownRatio)
        .lastInsertRowid
    )

    const insertSentence = db.prepare('INSERT INTO sentences (lesson_id, idx, speaker, text) VALUES (?, ?, ?, ?)')
    const sentenceIds: number[] = []
    lesson.sentences.forEach((s, idx) => {
      sentenceIds.push(Number(insertSentence.run(lessonId, idx, s.speaker, s.text).lastInsertRowid))
    })

    const insertQuestion = db.prepare(
      'INSERT INTO questions (lesson_id, idx, type, question, key_points_json, evidence_idxs_json) VALUES (?, ?, ?, ?, ?, ?)'
    )
    lesson.questions.forEach((q, idx) => {
      insertQuestion.run(lessonId, idx, q.type, q.question, JSON.stringify(q.key_points), JSON.stringify(q.evidence))
    })

    // Mọi cụm AI trả về (mới + ôn) tự động thành thẻ. Mỗi từ/cụm chỉ có MỘT dòng trong vocab.
    const findVocab = db.prepare('SELECT id, context_sentence_id FROM vocab WHERE text_normalized = ?')
    const insertVocab = db.prepare(
      `INSERT INTO vocab (text, text_normalized, kind, meaning_vi, source, first_lesson_id, context_sentence_id, context_vi)
       VALUES (?, ?, ?, ?, 'lesson', ?, ?, ?)`
    )
    const fillContext = db.prepare('UPDATE vocab SET context_sentence_id = ?, context_vi = ? WHERE id = ?')
    const insertLink = db.prepare(
      `INSERT OR IGNORE INTO lesson_chunks (lesson_id, vocab_id, meaning_vi_in_context, is_review, sentence_idx)
       VALUES (?, ?, ?, ?, ?)`
    )
    const usedReview = new Set<number>()
    for (const c of lesson.chunks) {
      const sentenceId = sentenceIds[c.sentence_idx] ?? null
      let vocabId: number | null = null
      let isReviewChunk = false

      if (c.is_review) {
        const match = matchReviewChunk(c.text, meta.reviewChunks, usedReview)
        if (match) {
          vocabId = match.id
          usedReview.add(match.id)
          isReviewChunk = true
        }
      }
      if (vocabId === null) {
        const norm = normalizeTerm(c.text)
        if (!norm) continue
        const existing = findVocab.get(norm) as { id: number; context_sentence_id: number | null } | undefined
        if (existing) {
          vocabId = existing.id
          isReviewChunk = true
          // Thẻ cũ chưa có câu ngữ cảnh (lưu từ trang tra từ) → bổ sung câu trong bài này
          if (existing.context_sentence_id === null && sentenceId !== null) fillContext.run(sentenceId, c.sentence_vi, existing.id)
        } else {
          const kind = norm.includes(' ') ? 'chunk' : 'word'
          vocabId = Number(insertVocab.run(c.text.trim(), norm, kind, c.meaning_vi, lessonId, sentenceId, c.sentence_vi).lastInsertRowid)
        }
      }
      insertLink.run(lessonId, vocabId, c.meaning_vi, isReviewChunk ? 1 : 0, c.sentence_idx)
    }
    return lessonId
  })
  return run()
}

// =====================================================================
// 5.4 TẠO AUDIO: chỉ tạo cho câu CHƯA có audio (không bao giờ tạo lại audio cũ)
// =====================================================================

export async function generateMissingAudio(lessonId: number, progress: Progress): Promise<void> {
  const db = getDb()
  const settings = getSettings()
  const all = db.prepare('SELECT id, idx, speaker, text, audio_path FROM sentences WHERE lesson_id = ? ORDER BY idx').all(lessonId) as {
    id: number
    idx: number
    speaker: string
    text: string
    audio_path: string | null
  }[]
  const missing = all.filter((s) => !s.audio_path)

  if (missing.length > 0) {
    progress({ stage: 'model', message: 'Đang chuẩn bị giọng đọc...' })
    await tts.ensureReady((p) => progress({ stage: 'model', message: p.message, current: p.percent, total: 100 }))

    const dir = lessonAudioDir(lessonId)
    const update = db.prepare('UPDATE sentences SET audio_path = ? WHERE id = ?')
    let done = all.length - missing.length
    for (const s of missing) {
      progress({ stage: 'audio', message: `Đang tạo audio ${done + 1}/${all.length} câu`, current: done, total: all.length })
      // Người kể (N) dùng giọng A
      const voice = s.speaker === 'B' ? settings.voiceB : settings.voiceA
      const outPath = join(dir, `${String(s.idx).padStart(3, '0')}.mp3`)
      await tts.synthesizeToFile(s.text, voice, outPath)
      update.run(toRelativeAudioPath(outPath), s.id)
      done++
    }
  }
  db.prepare("UPDATE lessons SET status = 'ready' WHERE id = ? AND status = 'audio_pending'").run(lessonId)
}

// =====================================================================
// ĐỌC DỮ LIỆU BÀI
// =====================================================================

export function listLessons(): LessonListItem[] {
  const rows = getDb()
    .prepare(
      `SELECT l.id, l.created_at, l.title, l.topic, l.is_grammar_review, l.status, g.name_vi AS grammar_name
       FROM lessons l JOIN grammar_points g ON g.id = l.grammar_point_id ORDER BY l.id DESC`
    )
    .all() as {
    id: number
    created_at: string
    title: string
    topic: string
    is_grammar_review: number
    status: LessonStatus
    grammar_name: string
  }[]
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    title: r.title,
    topic: r.topic,
    grammarName: r.grammar_name,
    isGrammarReview: r.is_grammar_review === 1,
    status: r.status
  }))
}

export function getLesson(id: number): LessonDetail {
  const db = getDb()
  const l = db
    .prepare(
      `SELECT l.*, g.name_vi AS grammar_name FROM lessons l JOIN grammar_points g ON g.id = l.grammar_point_id WHERE l.id = ?`
    )
    .get(id) as
    | {
        id: number
        created_at: string
        title: string
        topic: string
        level: string
        status: LessonStatus
        is_grammar_review: number
        known_ratio: number | null
        grammar_explanation_json: string
        grammar_deep_json: string | null
        annotations_json: string | null
        grammar_name: string
      }
    | undefined
  if (!l) throw new UserError('Không tìm thấy bài học này.')

  const sentences = (
    db.prepare('SELECT id, idx, speaker, text, audio_path FROM sentences WHERE lesson_id = ? ORDER BY idx').all(id) as {
      id: number
      idx: number
      speaker: 'A' | 'B' | 'N'
      text: string
      audio_path: string | null
    }[]
  ).map((s) => ({ id: s.id, idx: s.idx, speaker: s.speaker, text: s.text, audioUrl: audioUrl(s.audio_path) }))

  const qRows = db
    .prepare('SELECT id, idx, type, question, key_points_json, evidence_idxs_json FROM questions WHERE lesson_id = ? ORDER BY idx')
    .all(id) as { id: number; idx: number; type: QuestionType; question: string; key_points_json: string; evidence_idxs_json: string }[]
  const lastAnswer = db.prepare('SELECT * FROM answers WHERE question_id = ? ORDER BY id DESC LIMIT 1')
  const countAnswers = db.prepare('SELECT COUNT(*) AS n FROM answers WHERE question_id = ?')
  const questions: Question[] = qRows.map((q) => {
    const a = lastAnswer.get(q.id) as
      | { id: number; user_answer: string; result: 'full' | 'partial' | 'none'; feedback_vi: string; natural_version: string | null; created_at: string }
      | undefined
    return {
      id: q.id,
      idx: q.idx,
      type: q.type,
      question: q.question,
      keyPoints: JSON.parse(q.key_points_json),
      evidenceIdxs: JSON.parse(q.evidence_idxs_json),
      attempts: (countAnswers.get(q.id) as { n: number }).n,
      lastAnswer: a
        ? {
            id: a.id,
            userAnswer: a.user_answer,
            result: a.result,
            feedbackVi: a.feedback_vi,
            naturalVersion: a.natural_version,
            createdAt: a.created_at
          }
        : null
    }
  })

  const chunks: LessonChunk[] = (
    db
      .prepare(
        `SELECT lc.vocab_id, v.text, lc.meaning_vi_in_context, lc.is_review, lc.sentence_idx
         FROM lesson_chunks lc JOIN vocab v ON v.id = lc.vocab_id WHERE lc.lesson_id = ?`
      )
      .all(id) as { vocab_id: number; text: string; meaning_vi_in_context: string; is_review: number; sentence_idx: number | null }[]
  ).map((c) => ({ vocabId: c.vocab_id, text: c.text, meaningVi: c.meaning_vi_in_context, isReview: c.is_review === 1, sentenceIdx: c.sentence_idx }))

  return {
    id: l.id,
    createdAt: l.created_at,
    title: l.title,
    topic: l.topic,
    level: l.level,
    status: l.status,
    grammarName: l.grammar_name,
    isGrammarReview: l.is_grammar_review === 1,
    knownRatio: l.known_ratio,
    grammar: JSON.parse(l.grammar_explanation_json),
    grammarDeep: isGrammarV2(l.grammar_deep_json) ? JSON.parse(l.grammar_deep_json!) : null,
    annotations: l.annotations_json ? JSON.parse(l.annotations_json) : null,
    wordStates: getLessonWordStates(sentences, l.annotations_json ? JSON.parse(l.annotations_json) : null),
    newWordCount: l.status === 'done' ? 0 : countMarkableWords(id),
    sentences,
    questions,
    chunks
  }
}

// =====================================================================
// HOÀN THÀNH BÀI: cập nhật số lần gặp cụm và số lần dạy ngữ pháp (chỉ lần đầu hoàn thành)
// =====================================================================

export function finishLesson(lessonId: number, markKnown = false): void {
  const db = getDb()
  const wasDone = (db.prepare('SELECT status FROM lessons WHERE id = ?').get(lessonId) as { status: string } | undefined)?.status === 'done'
  // Đếm số lần gặp từng từ + (tùy chọn) đánh dấu "đã biết" các từ mới không tra — chỉ lần đầu hoàn thành
  if (!wasDone) {
    const marked = onLessonFinished(lessonId, markKnown)
    if (marked) console.log(`[words] đã đánh dấu ${marked} từ là "đã biết" (bài ${lessonId})`)
  }
  db.transaction(() => {
    const changed = db.prepare("UPDATE lessons SET status = 'done' WHERE id = ? AND status != 'done'").run(lessonId).changes
    if (changed === 0) return // đã hoàn thành trước đó → không cộng thêm lần nữa
    db.prepare(
      `UPDATE vocab SET times_seen = times_seen + 1, last_seen_at = datetime('now')
       WHERE id IN (SELECT vocab_id FROM lesson_chunks WHERE lesson_id = ?)`
    ).run(lessonId)
    db.prepare(
      `UPDATE grammar_points SET times_taught = times_taught + 1, last_taught_at = datetime('now')
       WHERE id = (SELECT grammar_point_id FROM lessons WHERE id = ?)`
    ).run(lessonId)
  })()
}

export function getHomeStats(): HomeStats {
  const db = getDb()
  const coreTotal = (db.prepare('SELECT COUNT(*) AS n FROM grammar_points WHERE is_core = 1').get() as { n: number }).n
  const coreTaught = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT g.id) AS n FROM grammar_points g JOIN lessons l ON l.grammar_point_id = g.id
         WHERE g.is_core = 1 AND l.status = 'done'`
      )
      .get() as { n: number }
  ).n
  const lessonCount = (db.prepare('SELECT COUNT(*) AS n FROM lessons').get() as { n: number }).n
  const vocabCount = (db.prepare('SELECT COUNT(*) AS n FROM vocab').get() as { n: number }).n
  const c = getReviewCounts()
  const learningItems = (db.prepare('SELECT COUNT(*) AS n FROM vocab WHERE suspended = 0').get() as { n: number }).n
  const leechCount = (db.prepare('SELECT COUNT(*) AS n FROM vocab WHERE leech = 1 AND suspended = 0').get() as { n: number }).n
  return {
    coreTaught,
    coreTotal,
    lessonCount,
    vocabCount,
    dueToday: c.newCount + c.learningCount + c.reviewCount,
    knownWords: wordCounts().knownWords,
    learningItems,
    leechCount,
    vocab: getVocabCount(),
    listening: getListeningStats()
  }
}

// =====================================================================
// XÓA BÀI: xóa nội dung + toàn bộ audio của bài (dùng khi bài hoặc audio bị sai)
// =====================================================================

export function deleteLesson(lessonId: number, deleteVocabOnlyInLesson: boolean): void {
  if (creatingLessonId === lessonId) throw new UserError('Bài này đang được tạo, đợi tạo xong rồi hãy xóa.')
  const db = getDb()
  const exists = db.prepare('SELECT id FROM lessons WHERE id = ?').get(lessonId)
  if (!exists) throw new UserError('Không tìm thấy bài học này.')

  const exampleAudioToDelete: string[] = []
  db.transaction(() => {
    // Các thẻ từ vựng gắn với bài này (qua danh sách cụm, câu ngữ cảnh, hoặc bài gốc)
    const vocabRows = db
      .prepare(
        `SELECT DISTINCT v.id, v.source, v.first_lesson_id, v.context_sentence_id, v.example_audio_path FROM vocab v
         WHERE v.id IN (SELECT vocab_id FROM lesson_chunks WHERE lesson_id = @id)
            OR v.first_lesson_id = @id
            OR v.context_sentence_id IN (SELECT id FROM sentences WHERE lesson_id = @id)`
      )
      .all({ id: lessonId }) as {
      id: number
      source: string
      first_lesson_id: number | null
      context_sentence_id: number | null
      example_audio_path: string | null
    }[]
    const lessonSentenceIds = new Set(
      (db.prepare('SELECT id FROM sentences WHERE lesson_id = ?').all(lessonId) as { id: number }[]).map((r) => r.id)
    )
    // Cụm cũng xuất hiện ở bài khác → chuyển câu ngữ cảnh sang bài đó (vẫn có audio)
    const otherLink = db.prepare(
      `SELECT lc.lesson_id, lc.sentence_idx, s.id AS sentence_id, l.annotations_json FROM lesson_chunks lc
       JOIN lessons l ON l.id = lc.lesson_id
       LEFT JOIN sentences s ON s.lesson_id = lc.lesson_id AND s.idx = lc.sentence_idx
       WHERE lc.vocab_id = ? AND lc.lesson_id != ? ORDER BY lc.lesson_id DESC LIMIT 1`
    )
    for (const v of vocabRows) {
      const other = otherLink.get(v.id, lessonId) as
        | { lesson_id: number; sentence_idx: number | null; sentence_id: number | null; annotations_json: string | null }
        | undefined
      const contextInThisLesson = v.context_sentence_id !== null && lessonSentenceIds.has(v.context_sentence_id)
      if (other) {
        if (contextInThisLesson && other.sentence_id) {
          // Lấy bản dịch câu mới từ chú thích của bài kia (nếu có)
          let vi: string | null = null
          if (other.annotations_json) {
            const notes = JSON.parse(other.annotations_json) as { idx: number; vi: string }[]
            vi = notes.find((n) => n.idx === other.sentence_idx)?.vi ?? null
          }
          db.prepare('UPDATE vocab SET context_sentence_id = ?, context_vi = ? WHERE id = ?').run(other.sentence_id, vi, v.id)
        }
        if (v.first_lesson_id === lessonId) db.prepare('UPDATE vocab SET first_lesson_id = ? WHERE id = ?').run(other.lesson_id, v.id)
      } else if (deleteVocabOnlyInLesson && v.source === 'lesson') {
        // Thẻ chỉ có trong bài này (bài sai → thẻ cũng không đáng tin) → xóa luôn (kèm thẻ ôn tập)
        if (v.example_audio_path) exampleAudioToDelete.push(v.example_audio_path)
        db.prepare('DELETE FROM vocab WHERE id = ?').run(v.id)
      } else if (contextInThisLesson) {
        db.prepare('UPDATE vocab SET context_vi = NULL WHERE id = ?').run(v.id)
      }
    }
    // Xóa bài: câu, câu hỏi, câu trả lời, danh sách cụm tự xóa theo (ON DELETE CASCADE)
    db.prepare('DELETE FROM lessons WHERE id = ?').run(lessonId)
  })()

  // Xóa file audio SAU khi DB đã xóa thành công
  const dir = join(audioRoot(), String(lessonId))
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  for (const rel of exampleAudioToDelete) {
    const abs = toAbsoluteAudioPath(rel)
    if (existsSync(abs)) rmSync(abs)
  }
  console.log(`[lesson] đã xóa bài ${lessonId}`)
}
