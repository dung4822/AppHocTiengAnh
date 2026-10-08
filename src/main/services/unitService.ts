import { getDb } from '../db'
import { KNOWN_STABILITY_DAYS } from '../config'
import type { VocabCount } from '@shared/types'
import { callJson } from './deepseek'
import { normalizeTerm, tokenize } from './wordInfo'
import { vocabRetrievability } from './reviewService'
import { UNIT_SYSTEM, buildUnitUserMessage, unitSchema, type UnitItem } from '../prompts/unitPrompt'

// =====================================================================
// ĐẾM VỐN TỪ THEO "ĐƠN VỊ NGHĨA" — PHẦN LÕI
// Một đơn vị = một ý nghĩa. Nhiều thẻ có thể thuộc cùng một đơn vị → chỉ đếm 1.
// Bước 1 (local, miễn phí): chuẩn hóa — đưa về dạng gốc, bỏ đại từ/mạo từ → "runs out" và "run out of it" cùng khóa "run out of".
// Bước 2 (AI, chỉ khi cần): mục có CHUNG TỪ với một nhóm đã có nhưng khác khóa ("on it" / "get on it", "run" / "run out")
//          → hỏi AI có cùng nghĩa không. Không chung từ nào thì chắc chắn là đơn vị mới, không cần hỏi.
// =====================================================================

// Từ không mang nghĩa riêng: bỏ khi chuẩn hóa (giữ lại giới từ/tiểu từ như up, out, on vì chúng đổi nghĩa cụm động từ)
const FILLER = new Set([
  'a', 'an', 'the', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her',
  'us', 'them', 'my', 'your', 'his', 'our', 'their', 'sth', 'sb', 'something', 'someone', 'somebody', 'one\'s', 'really',
  'very', 'so', 'just'
])
// Từ quá chung, không dùng để tìm ứng viên (nhưng vẫn giữ trong khóa)
const WEAK = new Set(['be', 'do', 'have', 'to', 'of', 'and', 'or', 'in', 'on', 'at', 'for', 'with', 'up', 'out', 'off', 'get', 'go', 'make', 'take'])

export function canonicalize(text: string): string {
  const lemmas = tokenize(normalizeTerm(text)).map((t) => t.lemma)
  const kept = lemmas.filter((l) => !FILLER.has(l))
  return (kept.length ? kept : lemmas).join(' ')
}

function contentWords(canonical: string): string[] {
  return canonical.split(' ').filter((w) => w && !WEAK.has(w))
}

interface PendingRow {
  id: number
  text: string
  meaning_vi: string
  canonical: string | null
}

let running: Promise<void> | null = null
let again = false

// Xếp nhóm cho mọi thẻ chưa có đơn vị. Chạy nền; đang chạy mà có thẻ mới thêm vào thì chạy thêm một lượt sau đó.
export function clusterPendingVocab(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await doCluster()
    } while (again)
  })().finally(() => (running = null))
  return running
}

async function doCluster(): Promise<void> {
  const db = getDb()
  const pending = db.prepare('SELECT id, text, meaning_vi, canonical FROM vocab WHERE unit_id IS NULL ORDER BY id').all() as PendingRow[]
  if (pending.length === 0) return

  const setCanonical = db.prepare('UPDATE vocab SET canonical = ? WHERE id = ?')
  const assign = db.prepare('UPDATE vocab SET unit_id = ? WHERE id = ?')
  const newUnit = db.prepare('INSERT INTO vocab_units (head, meaning_vi) VALUES (?, ?)')
  const byCanonical = db.prepare('SELECT unit_id FROM vocab WHERE canonical = ? AND unit_id IS NOT NULL LIMIT 1')

  const needAi: { row: PendingRow; canonical: string; candidates: UnitItem['candidates'] }[] = []
  for (const row of pending) {
    const canonical = row.canonical ?? canonicalize(row.text)
    if (!row.canonical) setCanonical.run(canonical, row.id)

    // Bước 1: trùng khóa chuẩn hóa → cùng đơn vị
    const same = byCanonical.get(canonical) as { unit_id: number } | undefined
    if (same) {
      assign.run(same.unit_id, row.id)
      continue
    }
    // Tìm ứng viên: đơn vị có chung ít nhất một từ mang nghĩa
    const candidates = findCandidates(canonical)
    if (candidates.length === 0) {
      const uid = Number(newUnit.run(row.text, row.meaning_vi).lastInsertRowid)
      assign.run(uid, row.id)
      continue
    }
    needAi.push({ row, canonical, candidates })
  }
  if (needAi.length === 0) return

  // Bước 2: hỏi AI theo nhóm 20 mục/lần
  for (let i = 0; i < needAi.length; i += 20) {
    const batch = needAi.slice(i, i + 20)
    let decisions = new Map<number, number | null>()
    try {
      const res = await callJson(
        {
          purpose: 'units',
          system: UNIT_SYSTEM,
          user: buildUnitUserMessage(
            batch.map((b, k) => ({ item: k, text: b.row.text, meaning_vi: b.row.meaning_vi, candidates: b.candidates }))
          ),
          temperature: 0,
          maxTokens: 800
        },
        unitSchema
      )
      decisions = new Map(res.results.map((r) => [r.item, r.unit]))
    } catch (err) {
      // Mất mạng / lỗi → để chưa xếp nhóm, lần sau thử lại (lúc đếm vẫn tính tạm theo khóa chuẩn hóa)
      console.warn('[units] chưa xếp nhóm được, sẽ thử lại sau', err)
      return
    }
    db.transaction(() => {
      batch.forEach((b, k) => {
        const unit = decisions.get(k)
        const valid = unit !== undefined && unit !== null && b.candidates.some((c) => c.unit === unit)
        if (valid) assign.run(unit, b.row.id)
        else assign.run(Number(newUnit.run(b.row.text, b.row.meaning_vi).lastInsertRowid), b.row.id)
      })
    })()
  }
}

function findCandidates(canonical: string): UnitItem['candidates'] {
  const words = contentWords(canonical)
  const mine = canonical.split(' ')
  const rows = getDb()
    .prepare(
      `SELECT u.id, u.meaning_vi, GROUP_CONCAT(v.text, ' | ') AS members, GROUP_CONCAT(v.canonical, ' | ') AS canons
       FROM vocab_units u JOIN vocab v ON v.unit_id = u.id GROUP BY u.id`
    )
    .all() as { id: number; meaning_vi: string; members: string; canons: string }[]
  const out: UnitItem['candidates'] = []
  for (const r of rows) {
    const canons = r.canons.split(' | ')
    const related = canons.some((c) => {
      const theirs = c.split(' ')
      // Chung một từ mang nghĩa, hoặc một bên nằm gọn trong bên kia ("on" ⊂ "get on")
      const shareContent = words.some((w) => theirs.includes(w))
      const contained = mine.every((w) => theirs.includes(w)) || theirs.every((w) => mine.includes(w))
      return shareContent || contained
    })
    if (related) out.push({ unit: r.id, members: r.members.split(' | ').slice(0, 5), meaning_vi: r.meaning_vi })
  }
  return out.slice(0, 8)
}

// Số liệu vốn từ cho trang chủ
export function getVocabCount(now = Date.now()): VocabCount {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT v.id, v.unit_id, v.canonical, v.text,
              (SELECT MAX(stability) FROM review_cards c WHERE c.vocab_id = v.id AND c.reps > 0) AS stability
       FROM vocab v WHERE v.suspended = 0`
    )
    .all() as { id: number; unit_id: number | null; canonical: string | null; text: string; stability: number | null }[]
  // Thẻ chưa kịp xếp nhóm (đang chờ AI / mất mạng): tạm gộp theo khóa chuẩn hóa
  const unitKey = (r: (typeof rows)[number]): string =>
    r.unit_id !== null ? 'u' + r.unit_id : 'c' + (r.canonical ?? canonicalize(r.text))

  // Mỗi đơn vị lấy thẻ TỐT NHẤT của nó (bạn nhớ được một cách nói là đã biết nghĩa đó)
  const best = new Map<string, { r: number; s: number }>()
  for (const row of rows) {
    const r = vocabRetrievability(row.id, now) ?? 0
    const s = row.stability ?? 0
    const key = unitKey(row)
    const cur = best.get(key)
    best.set(key, { r: Math.max(r, cur?.r ?? 0), s: Math.max(s, cur?.s ?? 0) })
  }
  let remembered = 0
  let solid = 0
  for (const b of best.values()) {
    if (b.r >= 0.8) remembered++
    if (b.s >= KNOWN_STABILITY_DAYS) solid++
  }
  return { units: best.size, cards: rows.length, remembered, solid }
}
