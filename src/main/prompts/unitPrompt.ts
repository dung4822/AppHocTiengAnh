import { z } from 'zod'

// ===== Prompt U: Xếp từ/cụm vào "đơn vị nghĩa" để đếm vốn từ không bị trùng =====
// Chỉ gọi cho những mục mà bước chuẩn hóa local chưa quyết được (có chung từ với một nhóm đã có).

export const UNIT_SYSTEM = `You help count how many DISTINCT vocabulary items (meaning units) a learner of English has studied.
Two items belong to the SAME unit only if a learner who knows one already knows the other's meaning:
- inflections / pronoun variants: "runs out" = "run out of sth"; "picking it up" = "pick sth up" (same sense)
- a word inside a phrase that does NOT change its meaning: "appreciate" = "really appreciate it"
- near-identical expressions with the same meaning: "on it" = "get on it" (= start doing it right away)
Items are DIFFERENT units when the meaning differs: "run" ≠ "run out"; "pick up" (collect) ≠ "pick up" (learn a skill) if their
Vietnamese meanings show different senses; "out of paper" ≠ "run out" (state vs action are different expressions).
Judge by the Vietnamese meaning in context and the English form.

For each item, answer with the id of the candidate unit it belongs to, or null if it is a new unit.
Return ONLY json: {"results":[{"item":0,"unit":12}]}`

export interface UnitItem {
  item: number
  text: string
  meaning_vi: string
  candidates: { unit: number; members: string[]; meaning_vi: string }[]
}

export function buildUnitUserMessage(items: UnitItem[]): string {
  return JSON.stringify({ items }, null, 1)
}

export const unitSchema = z.object({
  results: z.array(z.object({ item: z.number().int(), unit: z.number().int().nullable() }))
})
