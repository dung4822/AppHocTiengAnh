import { existsSync, rmSync } from 'node:fs'
import { getDb } from '../db'
import type { VocabFilter, VocabItem, VocabStatus } from '@shared/types'
import { audioUrl, toAbsoluteAudioPath } from './audioUrl'
import { cefrOf, frequencyLabel, termZipf } from './wordInfo'

interface VocabRow {
  id: number
  text: string
  kind: 'word' | 'chunk'
  meaning_vi: string
  source: 'lesson' | 'lookup'
  status: VocabStatus
  suspended: number
  context_en: string | null
  context_vi: string | null
  context_audio: string | null
  example_en: string | null
  example_vi: string | null
  example_audio_path: string | null
  first_lesson_id: number | null
  first_lesson_title: string | null
  leech: number
  rescue_json: string | null
  unit_id: number | null
  times_seen: number
  created_at: string
}

export function listVocab(filter: VocabFilter): VocabItem[] {
  const where: string[] = []
  const params: (string | number)[] = []
  if (filter.search && filter.search.trim()) {
    where.push('(v.text LIKE ? OR v.meaning_vi LIKE ?)')
    const s = `%${filter.search.trim()}%`
    params.push(s, s)
  }
  if (filter.status === 'suspended') where.push('v.suspended = 1')
  else if (filter.status === 'leech') where.push('v.leech = 1 AND v.suspended = 0')
  else if (filter.status && filter.status !== 'all') {
    where.push('v.status = ? AND v.suspended = 0')
    params.push(filter.status)
  }
  if (filter.source && filter.source !== 'all') {
    where.push('v.source = ?')
    params.push(filter.source)
  }

  // LEFT JOIN để lấy câu ngữ cảnh (kèm audio có sẵn của câu đó) và tên bài gốc
  const rows = getDb()
    .prepare(
      `SELECT v.*, s.text AS context_en, s.audio_path AS context_audio, l.title AS first_lesson_title
       FROM vocab v
       LEFT JOIN sentences s ON s.id = v.context_sentence_id
       LEFT JOIN lessons l ON l.id = v.first_lesson_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY v.id DESC`
    )
    .all(...params) as VocabRow[]

  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    kind: r.kind,
    meaningVi: r.meaning_vi,
    source: r.source,
    status: r.status,
    suspended: r.suspended === 1,
    contextEn: r.context_en,
    contextVi: r.context_vi,
    contextAudioUrl: audioUrl(r.context_audio),
    exampleEn: r.example_en,
    exampleVi: r.example_vi,
    exampleAudioUrl: audioUrl(r.example_audio_path),
    firstLessonId: r.first_lesson_id,
    firstLessonTitle: r.first_lesson_title,
    leech: r.leech === 1,
    rescue: r.rescue_json ? JSON.parse(r.rescue_json) : null,
    sameUnit:
      r.unit_id === null
        ? []
        : (
            getDb().prepare('SELECT text FROM vocab WHERE unit_id = ? AND id != ?').all(r.unit_id, r.id) as { text: string }[]
          ).map((x) => x.text),
    frequencyLabel: frequencyLabel(termZipf(r.text)),
    cefr: cefrOf(r.text),
    timesSeen: r.times_seen,
    createdAt: r.created_at
  }))
}

export function setVocabSuspended(id: number, suspended: boolean): void {
  getDb().prepare('UPDATE vocab SET suspended = ? WHERE id = ?').run(suspended ? 1 : 0, id)
}

// Xóa thẻ: chỉ xóa audio riêng của thẻ (câu ví dụ). Audio câu trong bài học thì GIỮ NGUYÊN.
export function deleteVocab(id: number): void {
  const db = getDb()
  const row = db.prepare('SELECT example_audio_path, rescue_audio_json FROM vocab WHERE id = ?').get(id) as
    | { example_audio_path: string | null; rescue_audio_json: string | null }
    | undefined
  db.prepare('DELETE FROM vocab WHERE id = ?').run(id)
  // Audio riêng của thẻ: câu ví dụ lúc tra từ + các câu mới của từ hay quên
  const files = [row?.example_audio_path, ...((row?.rescue_audio_json ? JSON.parse(row.rescue_audio_json) : []) as string[])]
  for (const rel of files) {
    if (!rel) continue
    const abs = toAbsoluteAudioPath(rel)
    if (existsSync(abs)) rmSync(abs)
  }
}
