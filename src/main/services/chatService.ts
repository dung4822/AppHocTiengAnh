import { createHash } from 'node:crypto'
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { getDb } from '../db'
import { UserError } from '../errors'
import { sayAudioDir, vocabAudioDir } from '../paths'
import type { ChatExpression, ChatReply, ChatTurn, SaveExpressionInput, SaveVocabResult } from '@shared/types'
import { callJson } from './deepseek'
import { getSettings } from './settingsService'
import { normalizeTerm } from './wordInfo'
import { tts } from './tts/kokoroProvider'
import { audioUrl, toRelativeAudioPath } from './audioUrl'
import { cacheKey, findSavedVocab } from './lookupService'
import { clusterPendingVocab } from './unitService'
import { CHAT_SYSTEM, buildChatUserMessage, chatSchema } from '../prompts/chatPrompt'

// =====================================================================
// TRỢ LÝ CHAT NỔI: hỏi "ý này tiếng Anh nói sao?", tra từ, hỏi đáp ngắn.
// Audio: đọc bằng Kokoro offline NGAY trong chat (bấm loa), file được giữ lại để khi lưu thẻ dùng luôn.
// =====================================================================

const HISTORY_TURNS = 6 // số lượt gần nhất gửi kèm (để hỏi tiếp "cái thứ 2 khác gì?")

// Gõ 1–4 từ tiếng Anh (không dấu tiếng Việt, không dấu hỏi) = tra từ → không cần gọi AI để đoán ý
function looksLikeLookup(msg: string): boolean {
  return /^[a-zA-Z][a-zA-Z' -]{0,40}$/.test(msg) && msg.trim().split(/\s+/).length <= 4
}

export async function askChat(message: string, history: ChatTurn[]): Promise<ChatReply> {
  const msg = message.trim().slice(0, 500)
  if (!msg) throw new UserError('Bạn hãy gõ câu hỏi nhé.')
  if (looksLikeLookup(msg)) return { kind: 'lookup', term: msg }

  const recent = history.slice(-HISTORY_TURNS).map((h) => ({ role: h.role, text: h.text.slice(0, 400) }))
  const data = await callJson(
    {
      purpose: 'chat',
      system: CHAT_SYSTEM,
      user: buildChatUserMessage(getSettings().level, recent, msg),
      temperature: 0.4,
      maxTokens: 900,
      timeoutMs: 60_000
    },
    chatSchema
  )

  switch (data.type) {
    case 'lookup':
      return { kind: 'lookup', term: data.term.trim() }
    case 'answer':
      return { kind: 'answer', answerVi: data.answer_vi.trim() }
    case 'express': {
      const expressions: ChatExpression[] = data.expressions.map((e) => ({
        text: e.text.trim(),
        meaningVi: e.meaning_vi.trim(),
        usageVi: e.usage_vi.trim(),
        examples: e.examples.slice(0, 2).map((x) => ({ en: x.en.trim(), vi: x.vi.trim() })),
        savedVocabId: findSavedVocab(e.text)
      }))
      return { kind: 'express', expressions, avoidVi: data.avoid_vi?.trim() || null }
    }
  }
}

// ----- Đọc một câu bằng Kokoro (offline, miễn phí), có cache theo nội dung + giọng -----
const inFlight = new Map<string, Promise<string>>()

function sayPath(text: string, voice: string): string {
  const hash = createHash('sha1').update(`${voice}\n${text}`).digest('hex').slice(0, 20)
  return join(sayAudioDir(), `${hash}.mp3`)
}

async function ensureSayFile(text: string): Promise<string> {
  const clean = text.trim().slice(0, 300)
  if (!clean) throw new UserError('Không có gì để đọc.')
  const out = sayPath(clean, getSettings().voiceA)
  if (existsSync(out)) return out
  // Bấm loa nhiều lần / tải trước cùng lúc → chỉ tạo một lần
  let p = inFlight.get(out)
  if (!p) {
    p = tts
      .synthesizeToFile(clean, getSettings().voiceA, out)
      .then(() => out)
      .finally(() => inFlight.delete(out))
    inFlight.set(out, p)
  }
  return p
}

export async function sayText(text: string): Promise<string> {
  return audioUrl(toRelativeAudioPath(await ensureSayFile(text)))!
}

// ----- Lưu một cách diễn đạt thành thẻ (thẻ nghe + thẻ nói như mọi thẻ khác) -----
export async function saveExpression(input: SaveExpressionInput): Promise<SaveVocabResult> {
  const db = getDb()
  const text = input.text.trim()
  const norm = normalizeTerm(text)
  if (!norm) throw new UserError('Cách diễn đạt không hợp lệ.')
  const existing = findSavedVocab(text)
  if (existing) return { vocabId: existing, alreadyExisted: true }

  const examples = input.examples.filter((e) => e.en.trim())
  const chosen = examples[Math.min(Math.max(0, input.exampleIdx), examples.length - 1)] ?? null
  const kind = norm.includes(' ') ? 'chunk' : 'word'

  const vocabId = db.transaction((): number => {
    const id = Number(
      db
        .prepare(
          `INSERT INTO vocab (text, text_normalized, kind, meaning_vi, source, example_en, example_vi)
           VALUES (?, ?, ?, ?, 'lookup', ?, ?)`
        )
        .run(text, norm, kind, input.meaningVi, chosen?.en ?? null, chosen?.vi ?? null).lastInsertRowid
    )
    // Ghi sẵn vào cache tra từ → mở thẻ ở trang Từ vựng thấy đủ ví dụ + cách dùng, không tốn thêm API
    db.prepare('INSERT OR IGNORE INTO lookup_cache (term_normalized, result_json) VALUES (?, ?)').run(
      cacheKey(text),
      JSON.stringify({
        term: text,
        meanings: examples.slice(0, 3).map((e) => ({ meaning_vi: input.meaningVi, example_en: e.en, example_vi: e.vi })),
        collocations: [],
        note_vi: input.usageVi || null
      })
    )
    return id
  })()

  void clusterPendingVocab()
  // Audio cho thẻ: thường đã có sẵn vì bạn bấm loa nghe trong chat → chỉ copy, không tạo lại
  if (chosen) {
    try {
      const out = join(vocabAudioDir(), `${vocabId}.mp3`)
      copyFileSync(await ensureSayFile(chosen.en), out)
      db.prepare('UPDATE vocab SET example_audio_path = ? WHERE id = ?').run(toRelativeAudioPath(out), vocabId)
    } catch (err) {
      console.warn('[chat] không tạo được audio câu ví dụ', err) // thẻ vẫn được lưu, chỉ thiếu audio
    }
  }
  return { vocabId, alreadyExisted: false }
}
