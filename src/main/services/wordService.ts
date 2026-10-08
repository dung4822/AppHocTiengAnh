import { getDb } from '../db'
import { UserError } from '../errors'
import { HARD_LOOKUP_COUNT, NEW_WORD_ZIPF_MARGIN, ZIPF_THRESHOLD } from '../config'
import type { SentenceNote, WordState } from '@shared/types'
import { getSettings } from './settingsService'
import { lemmaOf, normalizeTerm, singleWordZipf, tokenize } from './wordInfo'

// =====================================================================
// TRẠNG THÁI TỪNG TỪ (kiểu LingQ) — xem docs/THIET_KE_TU_VUNG.md
//   new      : chưa đánh dấu
//   learning : đã có thẻ trong vocab (suy ra, không lưu trong bảng words)
//   known    : bạn đánh dấu "đã biết" (hoặc tự động khi hoàn thành bài mà không tra)
//   ignored  : bỏ qua (tên riêng, từ không cần học)
// =====================================================================

interface WordRow {
  lemma: string
  status: 'new' | 'known' | 'ignored'
  seen_count: number
  lookup_count: number
}

// Khóa chung cho một từ đơn: dạng gốc viết thường. Cụm nhiều từ / từ viết tắt thì không có khóa.
export function wordKey(term: string): string | null {
  const n = normalizeTerm(term)
  if (!n || n.includes(' ') || n.includes("'") || /^[0-9]/.test(n)) return null
  return lemmaOf(n)
}

function getWordRow(lemma: string): WordRow | undefined {
  return getDb().prepare('SELECT * FROM words WHERE lemma = ?').get(lemma) as WordRow | undefined
}

function ensureWordRow(lemma: string): void {
  getDb().prepare('INSERT OR IGNORE INTO words (lemma) VALUES (?)').run(lemma)
}

// Từ này có thẻ đang học không? Trả về độ ổn định nhỏ nhất của các thẻ (để biết yếu hay mạnh)
function trackedStrength(lemma: string): { tracked: boolean; weak: boolean } {
  const row = getDb()
    .prepare(
      `SELECT MIN(CASE WHEN c.reps > 0 THEN c.stability ELSE 0 END) AS s FROM vocab v
       JOIN review_cards c ON c.vocab_id = v.id
       WHERE v.text_normalized = ? AND v.suspended = 0`
    )
    .get(lemma) as { s: number | null }
  if (row.s === null) return { tracked: false, weak: false }
  return { tracked: true, weak: row.s < 7 } // ổn định < 1 tuần = còn yếu
}

export function getWordState(term: string): WordState {
  const key = wordKey(term)
  if (!key) return { status: 'new', highlight: 'none', lookups: 0 }
  const row = getWordRow(key)
  const t = trackedStrength(key)
  if (t.tracked) return { status: 'learning', highlight: t.weak ? 'weak' : 'learning', lookups: row?.lookup_count ?? 0 }
  if (row && row.status !== 'new') return { status: row.status, highlight: 'none', lookups: row.lookup_count }
  // Từ mới: chỉ tô nếu không quá phổ biến (từ như "the", "go" không cần tô)
  const zipf = singleWordZipf(normalizeTerm(term), key)
  const limit = ZIPF_THRESHOLD[getSettings().level] + NEW_WORD_ZIPF_MARGIN
  const highlight = zipf === null || zipf < limit ? 'new' : 'none'
  return { status: 'new', highlight, lookups: row?.lookup_count ?? 0 }
}

// Tính trạng thái cho mọi từ trong bài (khóa = dạng gốc từ chú thích, hoặc chính từ đó, viết thường)
export function getLessonWordStates(sentences: { text: string }[], notes: SentenceNote[] | null): Record<string, WordState> {
  const keys = new Set<string>()
  // Tên riêng: viết hoa ở giữa câu (New York, Sarah) → không tô, không tính là từ cần học
  const proper = new Set<string>()
  for (const s of sentences) {
    for (const m of s.text.matchAll(/[A-Za-z][A-Za-z'’-]*/g)) {
      const w = m[0]
      keys.add(w.toLowerCase())
      const prev = s.text.slice(0, m.index).trimEnd()
      const sentenceStart = prev === '' || /[.!?:"“]$/.test(prev)
      if (/^[A-Z]/.test(w) && !sentenceStart && !/^I(['’]|$)/.test(w)) proper.add(w.toLowerCase())
    }
  }
  for (const n of notes ?? []) for (const w of n.words) keys.add((w.base || w.t).toLowerCase())
  const out: Record<string, WordState> = {}
  for (const k of keys) {
    const st = getWordState(k)
    out[k] = proper.has(k) && st.status === 'new' ? { ...st, highlight: 'none' } : st
  }
  return out
}

export function setWordStatus(term: string, status: 'new' | 'known' | 'ignored'): void {
  const key = wordKey(term)
  if (!key) throw new UserError('Chỉ đánh dấu được từ đơn (không phải cụm).')
  ensureWordRow(key)
  getDb().prepare("UPDATE words SET status = ?, updated_at = datetime('now') WHERE lemma = ?").run(status, key)
}

// "Tra lại = sắp quên": gọi mỗi khi bạn CHỦ ĐỘNG tra một từ/cụm
//  - đếm số lần tra (từ tra ≥ 2 lần bị coi là từ lạ khi kiểm tra độ khó)
//  - từ đã đánh dấu "đã biết" mà phải tra lại → trở về "mới"
//  - từ/cụm đang có thẻ → đưa thẻ lên ôn ngay (chỉ dời ngày tới hạn, giữ nguyên trí nhớ FSRS)
export function recordLookup(term: string): void {
  const db = getDb()
  const key = wordKey(term)
  if (key) {
    ensureWordRow(key)
    db.prepare(
      `UPDATE words SET lookup_count = lookup_count + 1, last_lookup_at = datetime('now'),
         status = CASE WHEN status = 'known' THEN 'new' ELSE status END, updated_at = datetime('now')
       WHERE lemma = ?`
    ).run(key)
  }
  const norm = normalizeTerm(term)
  const now = Date.now()
  db.prepare(
    `UPDATE review_cards SET due = ?
     WHERE state = 2 AND due > ? + 3600000
       AND vocab_id IN (SELECT id FROM vocab WHERE text_normalized IN (?, ?) AND suspended = 0)`
  ).run(now, now, norm, key ?? norm)
}

// Khi hoàn thành bài: đếm số lần gặp mỗi từ; (tùy chọn) đánh dấu "đã biết" các từ mới không tra / không lưu
function lessonLemmas(lessonId: number): Set<string> {
  const sentences = getDb().prepare('SELECT text FROM sentences WHERE lesson_id = ?').all(lessonId) as { text: string }[]
  const lemmas = new Set<string>()
  for (const s of sentences) {
    for (const t of tokenize(s.text)) {
      if (t.skip) continue
      const k = wordKey(t.lemma)
      if (k) lemmas.add(k)
    }
  }
  return lemmas
}

// Từ được tô xanh (mới, ít gặp) mà chưa tra lần nào → ứng viên "đã biết" khi hoàn thành bài
function isMarkable(lemma: string): boolean {
  const st = getWordState(lemma)
  return st.status === 'new' && st.highlight === 'new' && st.lookups === 0
}

export function countMarkableWords(lessonId: number): number {
  let n = 0
  for (const k of lessonLemmas(lessonId)) if (isMarkable(k)) n++
  return n
}

export function onLessonFinished(lessonId: number, markKnown: boolean): number {
  const db = getDb()
  const lemmas = lessonLemmas(lessonId)
  let marked = 0
  db.transaction(() => {
    for (const k of lemmas) {
      ensureWordRow(k)
      db.prepare("UPDATE words SET seen_count = seen_count + 1, last_seen_at = datetime('now') WHERE lemma = ?").run(k)
      if (!markKnown) continue
      // Giống LingQ "lật trang": từ được tô xanh mà bạn không tra lần nào và không lưu → coi như đã biết
      if (isMarkable(k)) {
        db.prepare("UPDATE words SET status = 'known', updated_at = datetime('now') WHERE lemma = ?").run(k)
        marked++
      }
    }
  })()
  return marked
}

// Dùng cho kiểm tra độ khó (5.3): từ bạn đã đánh dấu biết/bỏ qua, và từ bạn hay tra
export function personalWordSets(): { known: Set<string>; hard: Set<string> } {
  const rows = getDb().prepare('SELECT lemma, status, lookup_count FROM words').all() as WordRow[]
  const known = new Set<string>()
  const hard = new Set<string>()
  for (const r of rows) {
    if (r.status === 'known' || r.status === 'ignored') known.add(r.lemma)
    else if (r.lookup_count >= HARD_LOOKUP_COUNT) hard.add(r.lemma)
  }
  return { known, hard }
}

export function wordCounts(): { knownWords: number } {
  const r = getDb().prepare("SELECT COUNT(*) AS n FROM words WHERE status = 'known'").get() as { n: number }
  return { knownWords: r.n }
}
