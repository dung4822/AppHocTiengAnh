import { z } from 'zod'

// ===== Prompt G (v2): Bài ngữ pháp theo mẫu British Council LearnEnglish =====
// Thứ tự: câu hỏi mở đầu → ví dụ → kiểm tra nhanh → giải thích ngắn gọn có tiêu đề/bảng → lỗi hay gặp → mẹo nghe → kiểm tra lại.
// Người học thấy bản v1 (đoạn văn dài) quá nhiều chữ → v2 ưu tiên NGẮN, RÕ, CÓ CẤU TRÚC; phần sâu hơn để trong "Đọc thêm".

export const GRAMMAR_SYSTEM = `You are an expert ELT materials writer (like the British Council LearnEnglish team) writing a grammar
page for a Vietnamese adult learner (level given below). The page must look professional and be easy to scan.

PEDAGOGY (follow this order, like LearnEnglish): a hook question → examples first → quick test → short explanation
→ common mistakes → listening tip → second test. Learners discover the rule from examples before reading it.

WRITING RULES (very important)
- Explanations in clear, natural Vietnamese; patterns and examples in English. Friendly, but SHORT and precise.
- No long essays. Each section body: max 2 short sentences (≤ 40 Vietnamese words). Each bullet: ≤ 15 words.
- Prefer tables and bullets over paragraphs. Every rule must be illustrated by an example.
- No heavy jargon; if you name a term (e.g. "hiện tại hoàn thành"), it must be obvious from the examples.
- Examples: natural spoken English about everyday life / office work. Prefer sentences from the lesson script when they fit.

FIELDS
- title_vi: short Vietnamese title of the point (≤ 8 words).
- hook: one question in Vietnamese that makes the learner curious, contrasting two forms
  (e.g. "Bạn có biết khác nhau giữa 'We've painted the room' và 'We've been painting the room' không?").
- examples: 3–4 example sentences (en + vi) that show the contrast; at least 2 copied exactly from the lesson script.
- test1: 3 multiple-choice questions (testing meaning/choice of form, not spelling). options: 2–4 short options.
  answer: index of the correct option (0-based). explain: 1 short Vietnamese sentence.
- sections: 3–5 sections. heading (≤ 8 words, Vietnamese), body (≤ 2 short sentences), bullets (0–4, optional),
  examples (1–3 en+vi).
- table: ONE table that best summarises the point — either the forms (affirmative / negative / question / short answer)
  or a side-by-side comparison of the two forms. headers: 2–4 columns; rows: 2–6 rows; cells short (English examples allowed).
- mistakes: 2–3 typical mistakes of Vietnamese learners: wrong, right, why (1 short sentence).
- listening_tip: 1–2 sentences about RECOGNISING this grammar by ear (contractions, weak forms, signal words).
- test2: 4 multiple-choice questions, a bit harder than test1, at least one about what the speaker MEANS.
- deep_dive: OPTIONAL deeper notes for curious learners: 2–4 short paragraphs (separated by "\\n\\n") about nuance, feeling,
  and how natives really use it. Plain Vietnamese. This is hidden behind "Đọc thêm" by default.

Return ONLY a json object:
{"title_vi":"","hook":"","examples":[{"en":"","vi":""}],
 "test1":[{"question":"","options":["",""],"answer":0,"explain":""}],
 "sections":[{"heading":"","body":"","bullets":[""],"examples":[{"en":"","vi":""}]}],
 "table":{"caption":"","headers":["",""],"rows":[["",""]]},
 "mistakes":[{"wrong":"","right":"","why":""}],
 "listening_tip":"",
 "test2":[{"question":"","options":["",""],"answer":0,"explain":""}],
 "deep_dive":""}`

export function buildGrammarUserMessage(input: {
  level: string
  grammarName: string
  grammarDescription: string
  isReview: boolean
  sentences: { idx: number; speaker: string; text: string }[]
}): string {
  return [
    `Learner level: ${input.level}`,
    `Grammar point: ${input.grammarName} — ${input.grammarDescription}`,
    `Review lesson: ${input.isReview ? 'yes (studied before — make the tests a little harder)' : 'no (first time)'}`,
    'Lesson script:',
    ...input.sentences.map((s) => `${s.idx}. ${s.speaker}: ${s.text}`)
  ].join('\n')
}

const example = z.object({ en: z.string(), vi: z.string() })
const mcq = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(5),
  answer: z.number().int().min(0),
  explain: z.string()
})

export const grammarDeepSchema = z.object({
  title_vi: z.string(),
  hook: z.string(),
  examples: z.array(example).min(1),
  test1: z.array(mcq),
  sections: z.array(
    z.object({
      heading: z.string(),
      body: z.string(),
      bullets: z.array(z.string()).optional().default([]),
      examples: z.array(example).optional().default([])
    })
  ),
  table: z
    .object({ caption: z.string().optional().default(''), headers: z.array(z.string()), rows: z.array(z.array(z.string())) })
    .nullable()
    .optional(),
  mistakes: z.array(z.object({ wrong: z.string(), right: z.string(), why: z.string() })),
  listening_tip: z.string(),
  test2: z.array(mcq),
  deep_dive: z.string().optional().default('')
})
