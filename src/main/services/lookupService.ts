import { join } from 'node:path'
import { getDb } from '../db'
import { UserError } from '../errors'
import { vocabAudioDir } from '../paths'
import type { LookupContext, LookupResult, SaveVocabResult } from '@shared/types'
import { callJson } from './deepseek'
import { getSettings } from './settingsService'
import { cefrOf, frequencyLabel, lemmaOf, normalizeTerm, termZipf } from './wordInfo'
import { tts } from './tts/kokoroProvider'
import { toRelativeAudioPath } from './audioUrl'
import { recordLookup } from './wordService'
import { clusterPendingVocab } from './unitService'
import { LOOKUP_SYSTEM, buildLookupUserMessage, lookupSchema, type LookupJson } from '../prompts/lookupPrompt'

// Khóa cache: dạng gốc nếu là 1 từ (went → go), nguyên cụm nếu là cụm
function cacheKey(term: string): string {
  const norm = normalizeTerm(term)
  return norm.includes(' ') ? norm : lemmaOf(norm)
}

function findSavedVocab(term: string): number | null {
  const db = getDb()
  const get = db.prepare('SELECT id FROM vocab WHERE text_normalized = ?')
  const norm = normalizeTerm(term)
  const row = (get.get(norm) ?? get.get(cacheKey(term))) as { id: number } | undefined
  return row?.id ?? null
}

// Phần thông tin tính ở LOCAL (AI không đoán tần suất)
function localInfo(term: string): Pick<LookupResult, 'frequencyLabel' | 'zipf' | 'cefr'> {
  const zipf = termZipf(term)
  return { zipf, frequencyLabel: frequencyLabel(zipf), cefr: cefrOf(term) }
}

// Cụm có trong danh sách cụm của bài → đã có nghĩa theo ngữ cảnh, không cần gọi API
function findLessonChunk(term: string, lessonId: number): { text: string; meaning: string; sentenceIdx: number | null } | null {
  const norm = normalizeTerm(term)
  const row = getDb()
    .prepare(
      `SELECT v.text, lc.meaning_vi_in_context AS meaning, lc.sentence_idx FROM lesson_chunks lc JOIN vocab v ON v.id = lc.vocab_id
       WHERE lc.lesson_id = ? AND v.text_normalized = ?`
    )
    .get(lessonId, norm) as { text: string; meaning: string; sentence_idx: number | null } | undefined
  return row ? { text: row.text, meaning: row.meaning, sentenceIdx: row.sentence_idx } : null
}

async function getLookupJson(term: string): Promise<{ data: LookupJson; fromCache: boolean }> {
  const db = getDb()
  const key = cacheKey(term)
  if (!key) throw new UserError('Hãy nhập một từ hoặc cụm tiếng Anh.')
  // 1) Có trong cache thì trả về luôn, KHÔNG gọi API
  const cached = db.prepare('SELECT result_json FROM lookup_cache WHERE term_normalized = ?').get(key) as { result_json: string } | undefined
  if (cached) return { data: JSON.parse(cached.result_json), fromCache: true }

  // 2) Chưa có thì gọi DeepSeek (prompt C) rồi lưu cache
  const data = await callJson(
    { purpose: 'lookup', system: LOOKUP_SYSTEM, user: buildLookupUserMessage(term.trim()), temperature: 0.3, maxTokens: 900 },
    lookupSchema
  )
  db.prepare('INSERT OR REPLACE INTO lookup_cache (term_normalized, result_json) VALUES (?, ?)').run(key, JSON.stringify(data))
  return { data, fromCache: false }
}

export async function lookup(term: string, ctx?: LookupContext): Promise<LookupResult> {
  const clean = term.trim().slice(0, 80)
  if (!normalizeTerm(clean)) throw new UserError('Hãy nhập một từ hoặc cụm tiếng Anh.')
  // Chủ động tra = tín hiệu chưa biết / sắp quên (trừ khi chỉ mở xem lại thẻ ở trang Từ vựng)
  if (!ctx?.passive) recordLookup(clean)

  if (ctx?.lessonId) {
    const chunk = findLessonChunk(clean, ctx.lessonId)
    if (chunk) {
      // Nếu cụm này đã từng được tra (có cache) thì hiện thêm giải thích đầy đủ, vẫn không gọi API
      const cached = getDb().prepare('SELECT result_json FROM lookup_cache WHERE term_normalized = ?').get(cacheKey(clean)) as
        | { result_json: string }
        | undefined
      const extra: LookupJson | null = cached ? JSON.parse(cached.result_json) : null
      return {
        term: chunk.text,
        source: 'lesson',
        meanings: [{ meaning_vi: chunk.meaning, example_en: '', example_vi: '' }, ...(extra?.meanings ?? [])],
        collocations: extra?.collocations ?? [],
        noteVi: extra?.note_vi ?? null,
        ...localInfo(chunk.text),
        savedVocabId: findSavedVocab(chunk.text)
      }
    }
  }

  const { data, fromCache } = await getLookupJson(clean)
  const shownTerm = data.term?.trim() || clean
  return {
    term: shownTerm,
    source: fromCache ? 'cache' : 'api',
    meanings: data.meanings,
    collocations: data.collocations,
    noteVi: data.note_vi ?? null,
    ...localInfo(shownTerm),
    savedVocabId: findSavedVocab(clean) ?? findSavedVocab(shownTerm)
  }
}

// Nút "Lưu thành thẻ" ở panel tra từ
export async function saveLookupAsCard(term: string, ctx?: LookupContext): Promise<SaveVocabResult> {
  const db = getDb()
  const existingId = findSavedVocab(term)
  if (existingId) return { vocabId: existingId, alreadyExisted: true } // lưu trùng không tạo thẻ thứ hai

  const { data } = await getLookupJson(term) // thường đã có trong cache nên không gọi API
  const shownTerm = data.term?.trim() || term.trim()
  const norm = normalizeTerm(shownTerm)
  const existing2 = db.prepare('SELECT id FROM vocab WHERE text_normalized = ?').get(norm) as { id: number } | undefined
  if (existing2) return { vocabId: existing2.id, alreadyExisted: true }

  const first = data.meanings[0] // nghĩa phổ biến nhất + câu ví dụ đầu tiên
  const kind = norm.includes(' ') ? 'chunk' : 'word'

  // Đang tra trong script của một bài → dùng luôn câu trong bài làm ngữ cảnh (có sẵn audio, không gọi TTS)
  let contextSentenceId: number | null = null
  let firstLessonId: number | null = null
  if (ctx?.sentenceId) {
    const s = db.prepare('SELECT id, lesson_id FROM sentences WHERE id = ?').get(ctx.sentenceId) as { id: number; lesson_id: number } | undefined
    if (s) {
      contextSentenceId = s.id
      firstLessonId = s.lesson_id
    }
  }

  const vocabId = Number(
    db
      .prepare(
        `INSERT INTO vocab (text, text_normalized, kind, meaning_vi, source, first_lesson_id, context_sentence_id, example_en, example_vi)
         VALUES (?, ?, ?, ?, 'lookup', ?, ?, ?, ?)`
      )
      .run(shownTerm, norm, kind, first.meaning_vi, firstLessonId, contextSentenceId, first.example_en, first.example_vi).lastInsertRowid
  )

  void clusterPendingVocab()
  // Không có câu trong bài → gọi TTS MỘT lần cho câu ví dụ để làm thẻ nghe
  if (contextSentenceId === null && first.example_en) {
    try {
      const outPath = join(vocabAudioDir(), `${vocabId}.mp3`)
      await tts.synthesizeToFile(first.example_en, getSettings().voiceA, outPath)
      db.prepare('UPDATE vocab SET example_audio_path = ? WHERE id = ?').run(toRelativeAudioPath(outPath), vocabId)
    } catch (err) {
      // Thẻ vẫn được lưu, chỉ thiếu audio
      console.warn('[lookup] không tạo được audio câu ví dụ', err)
    }
  }
  return { vocabId, alreadyExisted: false }
}

// "Học từ này" trong popup script: lưu thẻ với NGHĨA ĐÚNG TRONG CÂU (đã có trong chú thích) — không gọi API.
// Câu ngữ cảnh = câu trong bài (có sẵn audio), bản dịch câu lấy từ chú thích của bài.
export function saveFromContext(input: { term: string; meaningVi: string; sentenceId: number }): SaveVocabResult {
  const db = getDb()
  const norm = normalizeTerm(input.term)
  if (!norm) throw new UserError('Từ không hợp lệ.')
  const existing = db.prepare('SELECT id FROM vocab WHERE text_normalized = ?').get(norm) as { id: number } | undefined
  if (existing) return { vocabId: existing.id, alreadyExisted: true }

  const s = db
    .prepare('SELECT s.id, s.idx, s.lesson_id, l.annotations_json FROM sentences s JOIN lessons l ON l.id = s.lesson_id WHERE s.id = ?')
    .get(input.sentenceId) as { id: number; idx: number; lesson_id: number; annotations_json: string | null } | undefined
  if (!s) throw new UserError('Không tìm thấy câu trong bài.')
  let contextVi: string | null = null
  if (s.annotations_json) {
    const notes = JSON.parse(s.annotations_json) as { idx: number; vi: string }[]
    contextVi = notes.find((n) => n.idx === s.idx)?.vi ?? null
  }
  const kind = norm.includes(' ') ? 'chunk' : 'word'
  const vocabId = Number(
    db
      .prepare(
        `INSERT INTO vocab (text, text_normalized, kind, meaning_vi, source, first_lesson_id, context_sentence_id, context_vi)
         VALUES (?, ?, ?, ?, 'lookup', ?, ?, ?)`
      )
      .run(input.term.trim(), norm, kind, input.meaningVi, s.lesson_id, s.id, contextVi).lastInsertRowid
  )
  void clusterPendingVocab()
  return { vocabId, alreadyExisted: false }
}
