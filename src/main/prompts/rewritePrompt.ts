import { z } from 'zod'

// ===== Prompt viết lại câu khó (dùng ở bước kiểm tra độ khó 5.3, tối đa 1 lần / bài) =====

export const REWRITE_SYSTEM = `You simplify a listening script for a Vietnamese learner of English.
You get numbered sentences and a list of words that are too rare for the learner's level.
Rewrite ONLY the sentences that contain those words, replacing them with more common, everyday words
while keeping the same meaning, the same speaker, natural spoken American English and ≤ 20 words.
Keep every "keep" phrase exactly as it is (they are the lesson's target chunks).
Keep the use of the target grammar. Do not merge or split sentences. Names of people/places may stay.
Return ONLY a json object: {"sentences":[{"idx":0,"text":"rewritten sentence"}]} with only the changed sentences.`

export function buildRewriteUserMessage(input: {
  level: string
  sentences: { idx: number; text: string }[]
  hardWords: string[]
  keep: string[]
}): string {
  return [
    `Learner level: ${input.level}`,
    `Too-rare words: ${input.hardWords.join(', ')}`,
    `Keep exactly: ${input.keep.length ? input.keep.map((k) => `"${k}"`).join(', ') : '(none)'}`,
    'Sentences:',
    ...input.sentences.map((s) => `${s.idx}: ${s.text}`)
  ].join('\n')
}

export const rewriteSchema = z.object({
  sentences: z.array(z.object({ idx: z.number().int(), text: z.string().min(1) }))
})
