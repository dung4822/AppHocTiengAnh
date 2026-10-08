import { safeStorage } from 'electron'
import { getDb } from '../db'
import type { AppSettings, Level } from '@shared/types'
import { UserError } from '../errors'
import {
  DEFAULT_DESIRED_RETENTION,
  DEFAULT_LEVEL,
  DEFAULT_MODEL,
  DEFAULT_NEW_PER_DAY,
  DEFAULT_REVIEWS_PER_DAY,
  DEFAULT_VOICE_A,
  DEFAULT_VOICE_B,
  VOICES
} from '../config'

const LEVELS: Level[] = ['A2', 'B1', 'B2', 'C1']

function getValue(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

// Đọc số từ settings, ngoài khoảng [min, max] thì dùng mặc định
function getNumber(key: string, def: number, min: number, max: number): number {
  const n = Number(getValue(key))
  return getValue(key) !== null && Number.isFinite(n) && n >= min && n <= max ? n : def
}

function setValue(key: string, value: string): void {
  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value)
}

export function getSettings(): AppSettings {
  const level = getValue('USER_LEVEL') as Level | null
  return {
    hasApiKey: getValue('api_key_enc') !== null,
    level: level && LEVELS.includes(level) ? level : DEFAULT_LEVEL,
    model: getValue('model') || DEFAULT_MODEL,
    voiceA: getValue('voice_a') || DEFAULT_VOICE_A,
    voiceB: getValue('voice_b') || DEFAULT_VOICE_B,
    newPerDay: getNumber('new_per_day', DEFAULT_NEW_PER_DAY, 0, 9999),
    reviewsPerDay: getNumber('reviews_per_day', DEFAULT_REVIEWS_PER_DAY, 0, 9999),
    desiredRetention: getNumber('desired_retention', DEFAULT_DESIRED_RETENTION, 0.8, 0.97)
  }
}

export function saveSettings(s: Partial<Omit<AppSettings, 'hasApiKey'>> & { apiKey?: string }): AppSettings {
  if (s.apiKey !== undefined && s.apiKey.trim() !== '') {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Máy không hỗ trợ mã hóa an toàn để lưu API key.')
    // safeStorage mã hóa bằng DPAPI của Windows (chỉ tài khoản Windows này giải mã được)
    const encrypted = safeStorage.encryptString(s.apiKey.trim())
    setValue('api_key_enc', encrypted.toString('base64'))
  }
  if (s.level && LEVELS.includes(s.level)) setValue('USER_LEVEL', s.level)
  if (s.model && s.model.trim()) setValue('model', s.model.trim())
  if (s.voiceA && VOICES.some((v) => v.id === s.voiceA)) setValue('voice_a', s.voiceA)
  if (s.voiceB && VOICES.some((v) => v.id === s.voiceB)) setValue('voice_b', s.voiceB)
  if (s.newPerDay !== undefined && s.newPerDay >= 0) setValue('new_per_day', String(Math.round(s.newPerDay)))
  if (s.reviewsPerDay !== undefined && s.reviewsPerDay >= 0) setValue('reviews_per_day', String(Math.round(s.reviewsPerDay)))
  if (s.desiredRetention !== undefined && s.desiredRetention >= 0.8 && s.desiredRetention <= 0.97) {
    setValue('desired_retention', String(s.desiredRetention))
  }
  return getSettings()
}

// Chỉ dùng trong main process — key KHÔNG bao giờ được gửi sang renderer.
export function getApiKey(): string | null {
  const enc = getValue('api_key_enc')
  if (!enc) return null
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'))
  } catch {
    // Khóa giải mã nằm trong file "Local State" của thư mục dữ liệu; chuyển thư mục / đổi máy / đổi tài khoản Windows thì mất
    throw new UserError('Không đọc được API key đã lưu (có thể do chuyển thư mục dữ liệu hoặc đổi máy). Vào Cài đặt nhập lại key nhé.')
  }
}
