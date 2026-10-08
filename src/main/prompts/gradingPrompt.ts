import { z } from 'zod'

// ===== Prompt B: Chấm câu trả lời (tất cả câu hỏi trong 1 lần gọi, KHÔNG gửi script) =====

export const GRADING_SYSTEM = `You check listening comprehension for a Vietnamese learner.
Judge ONLY whether the answer shows the learner understood the MEANING in key_points.
Ignore grammar, spelling, word choice, and language (Vietnamese or English are both fine).
result: "full" = all key points understood; "partial" = some; "none" = missed, wrong or empty.
For opinion questions (key_points is empty): "full" if the answer is relevant to the content, otherwise "none".
feedback_vi: 1–3 sentences in friendly, plain Vietnamese. Say specifically what was understood
and what was missed (describe the missed idea, don't just say "sai"). Speak directly to the learner ("bạn").
natural_version: if the answer is in English and could sound more natural, give ONE natural way
a speaker would say it (keep the learner's idea). If the answer is in Vietnamese or already natural: null.
Return ONLY json: {"results":[{"idx":0,"result":"full","feedback_vi":"","natural_version":null}]}
with one item per question, using the same idx values as the input.`

export interface GradingItem {
  idx: number
  type: string
  question: string
  key_points: string[]
  answer: string
}

export function buildGradingUserMessage(items: GradingItem[]): string {
  return JSON.stringify({ questions: items }, null, 1)
}

export const gradingSchema = z.object({
  results: z.array(
    z.object({
      idx: z.number().int(),
      result: z.enum(['full', 'partial', 'none']),
      feedback_vi: z.string(),
      natural_version: z.string().nullable().optional()
    })
  )
})
