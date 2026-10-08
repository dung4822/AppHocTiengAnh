import { z } from 'zod'

// ===== Prompt C: Tra từ / cụm =====
// Cố ý KHÔNG gửi ngữ cảnh câu, để kết quả dùng lại được (lưu lookup_cache theo từ).

export const LOOKUP_SYSTEM = `Explain an English word or phrase to a Vietnamese learner at about B1.
Plain everyday Vietnamese, no academic or grammar jargon.
- term: the dictionary form of the input (e.g. "went" -> "go", "ran into" -> "run into").
- meanings: at most 3, ORDERED from most common to least common in everyday English.
  Skip rare/technical meanings. Each: short meaning_vi, one simple natural example (example_en) + example_vi.
- collocations: up to 4 common combinations with this word (short vi gloss each).
- note_vi: optional ONE short tip (common mistake of Vietnamese learners, or tone/register). Else null.
Do NOT say how common the word is.
Return ONLY json:
{"term":"","meanings":[{"meaning_vi":"","example_en":"","example_vi":""}],
 "collocations":[{"text":"","vi":""}],"note_vi":null}`

export function buildLookupUserMessage(term: string): string {
  return term
}

export const lookupSchema = z.object({
  term: z.string(),
  meanings: z
    .array(z.object({ meaning_vi: z.string(), example_en: z.string(), example_vi: z.string() }))
    .min(1)
    .max(3),
  collocations: z.array(z.object({ text: z.string(), vi: z.string() })).max(6),
  note_vi: z.string().nullable().optional()
})

export type LookupJson = z.infer<typeof lookupSchema>
