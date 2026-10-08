import nlp from 'compromise'
import { getDb } from '../db'
import freqData from '../../../resources/wordfreq-en.json'

// Bảng tần suất: từ → điểm Zipf (thang 1–7; 7 = cực phổ biến như "the", 3 = khá hiếm).
// Dữ liệu từ wordfreq (Apache-2.0 code, dữ liệu CC-BY-SA 4.0), xem README.
// Record<string, number> trong TS ~ Dictionary<string, double> trong C#.
const FREQ = freqData as Record<string, number>

// Chuẩn hóa từ/cụm để so sánh và làm khóa: chữ thường, bỏ dấu câu ở đầu/cuối, gộp khoảng trắng
export function normalizeTerm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '')
}

function zipfRaw(word: string): number | null {
  return FREQ[word] ?? null
}

// Tìm Zipf của một từ: thử dạng gốc trước, rồi dạng nguyên văn, lấy giá trị cao hơn.
function zipfOfWord(word: string, lemma: string): number | null {
  let best: number | null = null
  for (const w of [lemma, word]) {
    let z = zipfRaw(w)
    // Từ có gạch nối (follow-up) không có trong danh sách thì lấy phần ít gặp nhất
    if (z === null && w.includes('-')) {
      const parts = w.split('-').filter(Boolean).map((p) => zipfRaw(p) ?? 0)
      z = parts.length ? Math.min(...parts) : null
    }
    if (z !== null && (best === null || z > best)) best = z
  }
  return best
}

export interface Token {
  word: string // dạng xuất hiện trong câu (chữ thường)
  lemma: string // dạng gốc (went → go, meetings → meeting)
  skip: boolean // tên riêng, con số... không tính vào độ khó
}

// Tách từ và lemma hóa bằng thư viện compromise (có gắn nhãn từ loại nên lemma chính xác hơn)
export function tokenize(text: string): Token[] {
  const doc = nlp(text)
  doc.compute('root')
  const out: Token[] = []
  for (const s of doc.json() as { terms: { normal?: string; root?: string; tags?: string[] }[] }[]) {
    for (const t of s.terms) {
      let word = (t.normal ?? '').toLowerCase()
      if (!/[a-z]/.test(word)) continue
      const tags = t.tags ?? []
      word = word.replace(/[‘’]/g, "'")
      // Từ viết tắt (didn't, he's, we'd) luôn là từ rất thông dụng → không tính vào độ khó
      const isContraction = word.includes("'")
      const skip =
        isContraction || tags.some((tag) => ['ProperNoun', 'Person', 'Place', 'Organization', 'Value', 'Url'].includes(tag))
      if (isContraction) word = word.split("'")[0] || word
      let lemma = (t.root ?? word).toLowerCase()
      if (lemma.includes("'")) lemma = lemma.split("'")[0] || word
      out.push({ word, lemma, skip })
    }
  }
  return out
}

export function lemmaOf(word: string): string {
  const toks = tokenize(word)
  return toks.length === 1 ? toks[0].lemma : normalizeTerm(word)
}

// Zipf của MỘT từ (không qua bước tách từ, nên cả số đếm như "one", "ten" cũng có giá trị)
export function singleWordZipf(word: string, lemma?: string): number | null {
  return zipfOfWord(word.toLowerCase(), (lemma ?? word).toLowerCase())
}

// Zipf của một từ hoặc cụm. Với cụm: lấy từ ÍT GẶP NHẤT trong cụm.
export function termZipf(term: string): number | null {
  const toks = tokenize(term).filter((t) => !t.skip)
  if (toks.length === 0) return null
  const values = toks.map((t) => zipfOfWord(t.word, t.lemma))
  if (values.some((v) => v === null)) return null
  return Math.min(...(values as number[]))
}

// Đổi Zipf thành nhãn dễ hiểu. AI KHÔNG được đoán tần suất, nhãn này chỉ lấy từ dữ liệu đóng gói sẵn.
export function frequencyLabel(zipf: number | null): string {
  if (zipf === null) return 'Hiếm (không có trong danh sách)'
  if (zipf >= 5) return 'Rất phổ biến'
  if (zipf >= 4) return 'Phổ biến'
  if (zipf >= 3) return 'Ít gặp'
  return 'Hiếm'
}

// CEFR theo danh sách CEFR-J (A1–B2) + Octanove (C1–C2). Không có thì trả null.
export function cefrOf(term: string): string | null {
  const db = getDb()
  const get = db.prepare('SELECT level FROM word_cefr WHERE word = ?')
  const norm = normalizeTerm(term)
  const direct = get.get(norm) as { level: string } | undefined
  if (direct) return direct.level
  if (!norm.includes(' ')) {
    const viaLemma = get.get(lemmaOf(norm)) as { level: string } | undefined
    if (viaLemma) return viaLemma.level
  }
  return null
}

export interface DifficultyReport {
  totalWords: number
  knownWords: number
  ratio: number
  hardWords: string[] // dạng xuất hiện trong script, không trùng
}

// Bước 5.3: một từ bị coi là "lạ" nếu thỏa CẢ BA điều kiện:
//  1) tần suất thấp hơn ngưỡng của level,
//  2) không có trong vocab với status known/learning, và bạn chưa đánh dấu "đã biết" / "bỏ qua",
//  3) không thuộc các cụm của bài.
// Cá nhân hóa thêm: từ bạn đã TRA ≥ 2 lần cũng bị coi là lạ dù phổ biến (personal.hard).
export function analyzeDifficulty(
  sentences: string[],
  threshold: number,
  chunkTexts: string[],
  personal: { known: Set<string>; hard: Set<string> } = { known: new Set(), hard: new Set() }
): DifficultyReport {
  const db = getDb()
  const knownVocab = new Set(
    (db.prepare("SELECT text_normalized FROM vocab WHERE status IN ('known','learning')").all() as {
      text_normalized: string
    }[]).map((r) => r.text_normalized)
  )
  // Các từ nằm trong cụm của bài (so sánh cả dạng gốc)
  const chunkWords = new Set<string>()
  for (const c of chunkTexts) {
    for (const t of tokenize(c)) {
      chunkWords.add(t.word)
      chunkWords.add(t.lemma)
    }
  }

  let total = 0
  let known = 0
  const hard = new Set<string>()
  for (const s of sentences) {
    for (const t of tokenize(s)) {
      if (t.skip) continue
      total++
      const z = zipfOfWord(t.word, t.lemma)
      const isRare = z === null || z < threshold
      const inVocab = knownVocab.has(t.word) || knownVocab.has(t.lemma) || personal.known.has(t.lemma)
      const inChunk = chunkWords.has(t.word) || chunkWords.has(t.lemma)
      const personallyHard = personal.hard.has(t.lemma) && !inVocab
      if (((isRare && !inVocab) || personallyHard) && !inChunk) hard.add(t.word)
      else known++
    }
  }
  return { totalWords: total, knownWords: known, ratio: total ? known / total : 1, hardWords: [...hard] }
}
