import { z } from 'zod'

// ===== Prompt A: Tạo bài nghe =====
// System prompt CỐ ĐỊNH (không chèn dữ liệu thay đổi vào đây) để DeepSeek cache được prefix.

export const LESSON_SYSTEM = `You write listening lessons for a Vietnamese adult learning English (current level given in the user message).
Goal: natural listening comprehension, NOT vocabulary drilling.

SCRIPT RULES
- Natural spoken American English: contractions, everyday phrasing, light natural fillers (rare).
- Dialogue between A and B (or a monologue by N if the topic suits it).
- LENGTH: 250–380 words in total (~2–3 min of audio), usually 28–40 sentences. Count carefully: a script under 250 words is WRONG.
  Develop the story: background, the problem, details, a decision or change of mind, and a short ending.
- Each sentence ≤ 20 words. Exactly one sentence per item in "sentences" (split longer turns into several items with the same speaker).
- Vocabulary: stay mostly within the ~3000 most common English words for the given level.
  About 90–95% of the words must already be familiar to a learner at that level.
- Include exactly the requested number of NEW chunks: high-frequency collocations, phrasal verbs
  or fixed expressions useful in daily life or work. Never rare, literary or academic words.
- Naturally reuse EACH review chunk once (you may change its verb form or pronoun). Do not highlight it.
- Use the target grammar point naturally 2–3 times. Never force it, never mention it in the script.
- The script must have a clear point (a problem, a decision, a change of mind) so inference questions are possible.
- Do not reuse any of the recent titles or their storylines.

QUESTIONS (simple English, ≤ 15 words each)
- 4 questions in this order: 1 main_idea, 1 detail, 1 inference (the answer is NOT said directly; the learner must
  work it out from what the speakers say), 1 grammar_meaning
  (grammar_meaning asks what the speaker MEANS by a sentence using the target grammar, e.g. "Did she call him?").
- Optionally a 5th: opinion (no right answer; key_points = []).
- For each: key_points = 1–3 short phrases a correct answer must contain (meaning, not wording);
  evidence = 0-based indices of the 1–4 sentences that best contain the answer (opinion: []).

GRAMMAR EXPLANATION — write form, when, meaning and vs_vietnamese IN VIETNAMESE (only the English pattern/examples stay English).
Plain everyday Vietnamese, as if a friendly Vietnamese teacher is talking. NO linguistic jargon such as "trợ động từ", "phân từ", "mệnh đề".
- form: short pattern (e.g. "have/has + V3"); when: when people use it; meaning: what the speaker wants to express;
  vs_vietnamese: how Vietnamese says it / the common mistake of Vietnamese learners;
  examples: exactly 2 sentences copied from the script, each with a natural Vietnamese translation.
- If this is a grammar REVIEW lesson, still give the full explanation (the learner has seen it before).

CHUNKS: list every NEW chunk and every review chunk exactly as used in the script (the words as they appear),
with a short Vietnamese meaning IN THIS CONTEXT, the 0-based index of the sentence containing it,
a natural Vietnamese translation of that whole sentence, and is_review (true for review chunks).

Return ONLY a json object matching this example schema:
{
  "title": "short English title",
  "sentences": [{"speaker": "A", "text": "Hey, are you free for a minute?"}],
  "questions": [{"type": "main_idea", "question": "What is the problem?", "key_points": ["the delivery is late"], "evidence": [3, 4]}],
  "grammar": {"form": "have/has + V3 (I've finished)", "when": "Dùng khi ...", "meaning": "Người nói muốn nhấn mạnh ...",
              "vs_vietnamese": "Tiếng Việt hay nói 'đã ... rồi', nên người Việt hay ...",
              "examples": [{"en": "sentence copied from the script", "vi": "bản dịch tiếng Việt"}]},
  "chunks": [{"text": "run out of", "meaning_vi": "hết (cái gì đó)", "sentence_idx": 5,
              "sentence_vi": "Chúng ta sắp hết giấy in rồi.", "is_review": false}]
}
speaker is "A", "B" or "N". type is one of main_idea | detail | inference | grammar_meaning | opinion.`

export interface LessonPromptInput {
  level: string
  topic: string
  grammarName: string
  grammarDescription: string
  isGrammarReview: boolean
  newChunkCount: number
  reviewChunks: string[]
  recentTitles: string[]
}

// Phần dữ liệu thay đổi → đặt trong user message (cuối prompt)
export function buildLessonUserMessage(i: LessonPromptInput): string {
  return [
    `Learner level: ${i.level}`,
    `Topic: ${i.topic}`,
    `Target grammar point: ${i.grammarName} — ${i.grammarDescription}`,
    `Grammar review lesson: ${i.isGrammarReview ? 'yes (the learner studied this point before)' : 'no (first time)'}`,
    `Number of NEW chunks: ${i.newChunkCount}`,
    `Review chunks (reuse each once): ${i.reviewChunks.length ? i.reviewChunks.map((c) => `"${c}"`).join(', ') : '(none)'}`,
    `Recent titles to avoid: ${i.recentTitles.length ? i.recentTitles.map((t) => `"${t}"`).join(', ') : '(none)'}`
  ].join('\n')
}

// Schema kiểm tra JSON trả về (zod giống FluentValidation + DTO trong C#)
export const lessonSchema = z.object({
  title: z.string().min(1),
  sentences: z
    .array(
      z.object({
        speaker: z.enum(['A', 'B', 'N']),
        text: z.string().min(1)
      })
    )
    .min(10),
  questions: z
    .array(
      z.object({
        type: z.enum(['main_idea', 'detail', 'inference', 'grammar_meaning', 'opinion']),
        question: z.string().min(1),
        key_points: z.array(z.string()),
        evidence: z.array(z.number().int())
      })
    )
    .min(4)
    .max(5),
  grammar: z.object({
    form: z.string(),
    when: z.string(),
    meaning: z.string(),
    vs_vietnamese: z.string(),
    examples: z.array(z.object({ en: z.string(), vi: z.string() }))
  }),
  chunks: z.array(
    z.object({
      text: z.string().min(1),
      meaning_vi: z.string().min(1),
      sentence_idx: z.number().int(),
      sentence_vi: z.string(),
      is_review: z.boolean()
    })
  )
})

export type LessonJson = z.infer<typeof lessonSchema>
