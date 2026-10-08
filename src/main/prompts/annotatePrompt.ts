import { z } from 'zod'

// ===== Prompt N: Chú thích script kiểu Language Reactor =====
// Dịch từng câu, nghĩa từng từ THEO NGỮ CẢNH, và tìm các cụm từ (phrasal verb, collocation, thành ngữ...)
// để khi rê chuột vào một từ, app biết từ đó có nằm trong cụm nào không. Lưu vào DB → hover không cần gọi API.

export const ANNOTATE_SYSTEM = `You annotate an English listening script for a Vietnamese learner (level given below),
like the "Language Reactor" browser extension: hovering any word shows its meaning in context, and if the word belongs
to a multi-word expression, the meaning of the whole expression too.

For EACH sentence return:
- idx: the sentence number given.
- vi: a natural Vietnamese translation of the whole sentence (spoken style, not word-by-word).
- words: EVERY word token of the sentence, in order. Tokens are split on spaces; strip surrounding punctuation;
  keep apostrophes inside the token (I've, don't, client's stay as one token); keep hyphenated words as one token.
  Each token is an array [token, base, vi]:
    token = exactly as written (same capitalisation), base = dictionary form (went→go, meetings→meeting, I've→I have),
    vi = the SHORT Vietnamese meaning of this word IN THIS SENTENCE (2–6 words). For function words give the role in plain
    words (e.g. "the" → "(mạo từ, chỉ cái đã biết)", "to" in "want to go" → "(đi với động từ)").
- phrases: every multi-word expression whose meaning is more than the sum of its words, or that learners should learn
  as one unit: phrasal verbs (also when split: "picking it up"), prepositional verbs, collocations ("make a decision"),
  fixed expressions ("I'm on it", "no worries"), idioms, verb patterns ("be able to", "used to", "have to").
  Each phrase: text = the exact substring of the sentence that covers the expression (copy it exactly, including any
  object in the middle, e.g. "picking it up"); base = its dictionary form ("pick sth up"); vi = meaning IN THIS SENTENCE;
  kind = one of "phrasal_verb" | "collocation" | "idiom" | "fixed_expression" | "pattern"; note = optional short tip in
  Vietnamese about usage/tone (or null).
  Do NOT list plain noun phrases like "the meeting" or "my email".
  Do NOT list verb tense/aspect forms (have seen, was going, will call, 's been sitting) — they are grammar, not vocabulary.
  Only list expressions a learner would want to save as a vocabulary card.

Return ONLY json:
{"sentences":[{"idx":0,"vi":"","words":[["Hey","hey","này (lời chào)"]],
  "phrases":[{"text":"","base":"","vi":"","kind":"phrasal_verb","note":null}]}]}`

export function buildAnnotateUserMessage(level: string, sentences: { idx: number; text: string }[]): string {
  return [`Learner level: ${level}`, 'Sentences:', ...sentences.map((s) => `${s.idx}. ${s.text}`)].join('\n')
}

export const annotateSchema = z.object({
  sentences: z.array(
    z.object({
      idx: z.number().int(),
      vi: z.string(),
      words: z.array(z.array(z.string()).min(1)), // [token, base, vi] — AI đôi khi thiếu phần tử nên không ép đúng 3
      phrases: z.array(
        z.object({
          text: z.string().min(1),
          base: z.string(),
          vi: z.string(),
          kind: z.string(),
          note: z.string().nullable().optional()
        })
      )
    })
  )
})
