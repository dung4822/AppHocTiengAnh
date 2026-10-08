import { getDb } from '../db'
import { UserError } from '../errors'
import type { AnswerResult, GradeInput } from '@shared/types'
import { callJson } from './deepseek'
import { GRADING_SYSTEM, buildGradingUserMessage, gradingSchema, type GradingItem } from '../prompts/gradingPrompt'

interface QuestionRow {
  id: number
  idx: number
  type: string
  question: string
  key_points_json: string
}

interface GradedAnswer {
  questionId: number
  answer: string
  result: AnswerResult
  feedbackVi: string
  naturalVersion: string | null
}

// Chấm TẤT CẢ câu trả lời trong 1 lần gọi API (prompt B). Không gửi script.
// Mỗi lần chấm lưu thành các dòng answers MỚI (làm lại không ghi đè lượt cũ).
export async function gradeAnswers(lessonId: number, inputs: GradeInput[]): Promise<void> {
  const db = getDb()
  const questions = db
    .prepare('SELECT id, idx, type, question, key_points_json FROM questions WHERE lesson_id = ? ORDER BY idx')
    .all(lessonId) as QuestionRow[]
  const byId = new Map(questions.map((q) => [q.id, q]))

  const graded: GradedAnswer[] = []
  const toSend: GradingItem[] = []
  for (const input of inputs) {
    const q = byId.get(input.questionId)
    if (!q) continue
    const answer = input.answer.trim()
    if (answer === '') {
      // Câu bỏ trống: chấm luôn ở local, không tốn API
      graded.push({ questionId: q.id, answer: '', result: 'none', feedbackVi: 'Bạn chưa trả lời câu này. Nghe lại đoạn chứa đáp án rồi thử nhé.', naturalVersion: null })
      continue
    }
    toSend.push({ idx: q.idx, type: q.type, question: q.question, key_points: JSON.parse(q.key_points_json), answer })
  }
  if (graded.length === 0 && toSend.length === 0) throw new UserError('Chưa có câu trả lời nào để chấm.')

  if (toSend.length > 0) {
    const res = await callJson(
      { purpose: 'grading', system: GRADING_SYSTEM, user: buildGradingUserMessage(toSend), temperature: 0.2, maxTokens: 1500 },
      gradingSchema
    )
    const byIdx = new Map(res.results.map((r) => [r.idx, r]))
    for (const item of toSend) {
      const q = questions.find((x) => x.idx === item.idx)!
      const r = byIdx.get(item.idx)
      if (!r) throw new UserError('AI chấm thiếu một số câu. Bấm chấm lại nhé.')
      graded.push({
        questionId: q.id,
        answer: item.answer,
        result: r.result,
        feedbackVi: r.feedback_vi,
        naturalVersion: r.natural_version ?? null
      })
    }
  }

  const insert = db.prepare(
    'INSERT INTO answers (question_id, user_answer, result, feedback_vi, natural_version) VALUES (?, ?, ?, ?, ?)'
  )
  db.transaction(() => {
    for (const g of graded) insert.run(g.questionId, g.answer, g.result, g.feedbackVi, g.naturalVersion)
  })()
}
