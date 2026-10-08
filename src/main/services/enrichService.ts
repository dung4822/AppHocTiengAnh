import { getDb } from '../db'
import type { GrammarDeep, SentenceNote } from '@shared/types'
import { callJson } from './deepseek'
import { getSettings } from './settingsService'
import { frequencyLabel, termZipf } from './wordInfo'
import { GRAMMAR_SYSTEM, buildGrammarUserMessage, grammarDeepSchema } from '../prompts/grammarPrompt'
import { ANNOTATE_SYSTEM, annotateSchema, buildAnnotateUserMessage } from '../prompts/annotatePrompt'

// =====================================================================
// "Làm giàu" bài học bằng 2 lần gọi AI riêng (chạy song song với tạo audio):
//  - Giải thích ngữ pháp chi tiết (prompt G)
//  - Chú thích script kiểu Language Reactor (prompt N): dịch câu, nghĩa từng từ, các cụm từ
// Kết quả lưu vào bảng lessons → mở lại bài / rê chuột không cần gọi API nữa.
// =====================================================================

interface SentenceRow {
  idx: number
  speaker: string
  text: string
}

// Số câu mỗi lần gọi chú thích: chia nhỏ để gọi SONG SONG (nhanh hơn) và mỗi câu trả lời không quá dài
const ANNOTATE_BATCH = 10

function loadSentences(lessonId: number): SentenceRow[] {
  return getDb().prepare('SELECT idx, speaker, text FROM sentences WHERE lesson_id = ? ORDER BY idx').all(lessonId) as SentenceRow[]
}

export async function generateGrammarDeep(lessonId: number): Promise<void> {
  const db = getDb()
  const l = db
    .prepare(
      `SELECT l.is_grammar_review, l.level, g.name_en, g.description_en FROM lessons l
       JOIN grammar_points g ON g.id = l.grammar_point_id WHERE l.id = ?`
    )
    .get(lessonId) as { is_grammar_review: number; level: string; name_en: string; description_en: string }
  const raw = await callJson(
    {
      purpose: 'grammar',
      system: GRAMMAR_SYSTEM,
      user: buildGrammarUserMessage({
        level: l.level,
        grammarName: l.name_en,
        grammarDescription: l.description_en,
        isReview: l.is_grammar_review === 1,
        sentences: loadSentences(lessonId)
      }),
      temperature: 0.5,
      maxTokens: 6000,
      timeoutMs: 300_000
    },
    grammarDeepSchema
  )
  // Sửa đáp án ngoài phạm vi (AI hiếm khi sai, nhưng để chắc chắn không làm hỏng giao diện)
  const fixQuiz = (q: GrammarDeep['test1']): GrammarDeep['test1'] =>
    q.filter((x) => x.options.length >= 2).map((x) => ({ ...x, answer: Math.min(Math.max(0, x.answer), x.options.length - 1) }))
  const deep: GrammarDeep = {
    ...raw,
    table: raw.table && raw.table.headers.length > 0 && raw.table.rows.length > 0 ? raw.table : null,
    test1: fixQuiz(raw.test1),
    test2: fixQuiz(raw.test2)
  }
  db.prepare('UPDATE lessons SET grammar_deep_json = ? WHERE id = ?').run(JSON.stringify(deep), lessonId)
}

export async function generateAnnotations(lessonId: number): Promise<void> {
  const level = getSettings().level
  const sentences = loadSentences(lessonId)
  const batches: SentenceRow[][] = []
  for (let i = 0; i < sentences.length; i += ANNOTATE_BATCH) batches.push(sentences.slice(i, i + ANNOTATE_BATCH))

  // Gọi song song các nhóm câu
  const results = await Promise.all(
    batches.map((b) =>
      callJson(
        {
          purpose: 'annotate',
          system: ANNOTATE_SYSTEM,
          user: buildAnnotateUserMessage(level, b),
          temperature: 0.2,
          maxTokens: 8000,
          timeoutMs: 300_000
        },
        annotateSchema
      )
    )
  )

  const textByIdx = new Map(sentences.map((s) => [s.idx, s.text]))
  const notes: SentenceNote[] = []
  for (const r of results) {
    for (const s of r.sentences) {
      const sentenceText = textByIdx.get(s.idx)
      if (sentenceText === undefined) continue
      notes.push({
        idx: s.idx,
        vi: s.vi,
        words: s.words.map(([t, base, vi]) => {
          const b = base || t
          // Con số / giờ giấc không cần nhãn tần suất
          return { t, base: b, vi: vi ?? '', freq: /^[0-9]/.test(b) ? '' : frequencyLabel(termZipf(b)) }
        }),
        // Chỉ giữ cụm thật sự có trong câu (để tô và tìm được vị trí)
        phrases: s.phrases
          .filter((p) => sentenceText.toLowerCase().includes(p.text.toLowerCase()))
          .map((p) => ({ text: p.text, base: p.base || p.text, vi: p.vi, kind: p.kind, note: p.note ?? null }))
      })
    }
  }
  notes.sort((a, b) => a.idx - b.idx)
  getDb().prepare('UPDATE lessons SET annotations_json = ? WHERE id = ?').run(JSON.stringify(notes), lessonId)
}

// Tạo những phần còn thiếu. Hai phần chạy song song, phần nào lỗi thì phần kia vẫn được lưu.
// Trả về danh sách lỗi (rỗng = thành công hết).
// Bản v1 (đoạn văn dài, không có "hook") coi như chưa có → tạo lại theo mẫu mới
export function isGrammarV2(json: string | null): boolean {
  if (!json) return false
  try {
    return typeof (JSON.parse(json) as { hook?: unknown }).hook === 'string'
  } catch {
    return false
  }
}

// Bài đang được làm giàu → dùng chung một Promise, tránh gọi API 2 lần
// (ví dụ đang tạo bài thì người dùng mở bài đó ra)
const inFlight = new Map<number, Promise<string[]>>()

export function enrichLesson(lessonId: number): Promise<string[]> {
  const running = inFlight.get(lessonId)
  if (running) return running
  const p = doEnrich(lessonId).finally(() => inFlight.delete(lessonId))
  inFlight.set(lessonId, p)
  return p
}

async function doEnrich(lessonId: number): Promise<string[]> {
  const row = getDb().prepare('SELECT grammar_deep_json, annotations_json FROM lessons WHERE id = ?').get(lessonId) as
    | { grammar_deep_json: string | null; annotations_json: string | null }
    | undefined
  if (!row) return ['Không tìm thấy bài học.']
  const tasks: Promise<void>[] = []
  if (!isGrammarV2(row.grammar_deep_json)) tasks.push(generateGrammarDeep(lessonId))
  if (!row.annotations_json) tasks.push(generateAnnotations(lessonId))
  const settled = await Promise.allSettled(tasks)
  return settled
    .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
    .map((s) => (s.reason instanceof Error ? s.reason.message : String(s.reason)))
}
