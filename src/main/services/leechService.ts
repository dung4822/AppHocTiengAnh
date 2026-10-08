import { join } from 'node:path'
import { getDb } from '../db'
import { vocabAudioDir } from '../paths'
import { KNOWN_STABILITY_DAYS, LEECH_LAPSES } from '../config'
import type { LeechRescue } from '@shared/types'
import { callJson } from './deepseek'
import { getSettings } from './settingsService'
import { tts } from './tts/kokoroProvider'
import { toRelativeAudioPath } from './audioUrl'
import { RESCUE_SYSTEM, buildRescueUserMessage, rescueSchema } from '../prompts/rescuePrompt'

// =====================================================================
// TỪ HAY QUÊN (leech) — docs/THIET_KE_TU_VUNG.md, mục C
// =====================================================================

// Gọi sau mỗi lần chấm thẻ. Trả về true nếu từ VỪA trở thành "từ hay quên".
export function updateLeechFlag(vocabId: number): boolean {
  const db = getDb()
  const v = db.prepare('SELECT leech FROM vocab WHERE id = ?').get(vocabId) as { leech: number } | undefined
  if (!v) return false
  const stats = db
    .prepare(
      `SELECT MAX(lapses) AS lapses,
              MIN(CASE WHEN direction = 'listen' THEN stability END) AS listen_stability
       FROM review_cards WHERE vocab_id = ?`
    )
    .get(vocabId) as { lapses: number; listen_stability: number | null }

  if (!v.leech && stats.lapses >= LEECH_LAPSES) {
    db.prepare('UPDATE vocab SET leech = 1 WHERE id = ?').run(vocabId)
    return true
  }
  // Đã vượt qua: thẻ nghe đã vững (≥ 21 ngày) → gỡ nhãn (nội dung cứu trợ vẫn giữ để xem lại)
  if (v.leech && (stats.listen_stability ?? 0) >= KNOWN_STABILITY_DAYS) {
    db.prepare('UPDATE vocab SET leech = 0 WHERE id = ?').run(vocabId)
  }
  return false
}

const generating = new Set<number>()

// AI viết nội dung cứu trợ + tạo audio cho các câu mới. Chạy nền, lỗi thì lần sau thử lại.
export async function generateRescue(vocabId: number): Promise<void> {
  if (generating.has(vocabId)) return
  generating.add(vocabId)
  try {
    const db = getDb()
    const v = db
      .prepare(
        `SELECT v.text, v.meaning_vi, v.rescue_json, s.text AS sentence,
                (SELECT MAX(lapses) FROM review_cards WHERE vocab_id = v.id) AS lapses
         FROM vocab v LEFT JOIN sentences s ON s.id = v.context_sentence_id WHERE v.id = ?`
      )
      .get(vocabId) as { text: string; meaning_vi: string; rescue_json: string | null; sentence: string | null; lapses: number } | undefined
    if (!v || v.rescue_json) return

    const rescue: LeechRescue = await callJson(
      {
        purpose: 'rescue',
        system: RESCUE_SYSTEM,
        user: buildRescueUserMessage({ level: getSettings().level, term: v.text, meaningVi: v.meaning_vi, sentence: v.sentence, lapses: v.lapses }),
        temperature: 0.7,
        maxTokens: 1500
      },
      rescueSchema
    )
    db.prepare('UPDATE vocab SET rescue_json = ? WHERE id = ?').run(JSON.stringify(rescue), vocabId)

    // Audio cho các câu ví dụ mới (để thẻ nghe xoay vòng câu)
    const paths: string[] = []
    const voice = getSettings().voiceA
    for (let i = 0; i < rescue.examples.length; i++) {
      const out = join(vocabAudioDir(), `${vocabId}_r${i}.mp3`)
      await tts.synthesizeToFile(rescue.examples[i].en, voice, out)
      paths.push(toRelativeAudioPath(out))
    }
    db.prepare('UPDATE vocab SET rescue_audio_json = ? WHERE id = ?').run(JSON.stringify(paths), vocabId)
    console.log(`[leech] đã tạo nội dung cứu trợ cho "${v.text}"`)
  } catch (err) {
    console.warn('[leech] chưa tạo được nội dung cứu trợ', err)
  } finally {
    generating.delete(vocabId)
  }
}

// Từ hay quên mà chưa có nội dung cứu trợ (ví dụ lần trước mất mạng) → tạo bù
export function retryMissingRescues(): void {
  const rows = getDb().prepare('SELECT id FROM vocab WHERE leech = 1 AND (rescue_json IS NULL OR rescue_audio_json IS NULL)').all() as {
    id: number
  }[]
  for (const r of rows) {
    if (generating.has(r.id)) continue
    // Có nội dung nhưng thiếu audio → xóa nội dung để tạo lại cả hai cho đồng bộ
    getDb().prepare('UPDATE vocab SET rescue_json = NULL WHERE id = ? AND rescue_audio_json IS NULL').run(r.id)
    void generateRescue(r.id)
  }
}
