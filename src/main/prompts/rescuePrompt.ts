import { z } from 'zod'

// ===== Prompt R: "Cứu trợ" cho từ hay quên (leech) =====
// Theo Anki, thẻ hay quên nghĩa là CÁCH HỌC thẻ đó đang không hiệu quả → cần đổi cách:
// hiểu vì sao hay quên, phân biệt với từ dễ nhầm, có mẹo nhớ, và gặp từ trong ngữ cảnh MỚI.

export const RESCUE_SYSTEM = `A Vietnamese learner of English (level given below) keeps forgetting an English word or phrase
(they failed its flashcard many times). Help them finally remember it. Everything for the learner in natural, friendly Vietnamese,
short and concrete (no long essays).

- why_hard: 1–2 sentences: the likely reason it is hard for a Vietnamese speaker (no direct Vietnamese equivalent,
  looks like another word, several meanings, the particle changes the meaning, etc.).
- explain: 2–3 sentences explaining the core meaning/feeling clearly, with when natives use it.
- confusables: 1–3 words/phrases the learner probably mixes it up with, each with a short "difference" in Vietnamese
  (empty array if none).
- memory_hook: ONE vivid memory trick in Vietnamese (an image, a story, a sound-alike with a Vietnamese word, or splitting
  the phrase into parts). Must be memorable and not silly-wrong.
- examples: exactly 3 NEW natural spoken example sentences (≤ 15 words, everyday or office situations, different contexts
  from the given sentence), each with a natural Vietnamese translation. Use the expression exactly as a native would.

Return ONLY json:
{"why_hard":"","explain":"","confusables":[{"text":"","difference":""}],"memory_hook":"","examples":[{"en":"","vi":""}]}`

export function buildRescueUserMessage(i: { level: string; term: string; meaningVi: string; sentence: string | null; lapses: number }): string {
  return [
    `Learner level: ${i.level}`,
    `Expression: ${i.term}`,
    `Meaning they studied: ${i.meaningVi}`,
    `Original sentence: ${i.sentence ?? '(none)'}`,
    `Times forgotten: ${i.lapses}`
  ].join('\n')
}

export const rescueSchema = z.object({
  why_hard: z.string(),
  explain: z.string(),
  confusables: z.array(z.object({ text: z.string(), difference: z.string() })).default([]),
  memory_hook: z.string(),
  examples: z.array(z.object({ en: z.string(), vi: z.string() })).min(1).max(5)
})
