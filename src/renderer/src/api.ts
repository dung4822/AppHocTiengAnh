import type { IpcResult } from '@shared/types'
import { formatRelative } from './format'

// Mở "hộp" IpcResult: thành công thì trả dữ liệu, lỗi thì ném Error với thông báo tiếng Việt từ main.
export async function call<T>(p: Promise<IpcResult<T>>): Promise<T> {
  const r = await p
  if (!r.ok) throw new Error(r.error)
  return r.data
}

export const api = window.api

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function formatDate(sqliteUtc: string): string {
  return formatRelative(sqliteUtc)
}

// Ghi nhớ bước đang học của từng bài (chỉ lưu trên máy, để trang chủ hiện "Đang ở bước 4/5")
export function getLessonStep(id: number): { step: number; max: number } | null {
  try {
    const raw = localStorage.getItem(`lesson-step:${id}`)
    return raw ? (JSON.parse(raw) as { step: number; max: number }) : null
  } catch {
    return null
  }
}

export function saveLessonStep(id: number, step: number): void {
  try {
    const old = getLessonStep(id)
    localStorage.setItem(`lesson-step:${id}`, JSON.stringify({ step, max: Math.max(step, old?.max ?? 0) }))
  } catch {
    /* localStorage không dùng được thì bỏ qua */
  }
}

export function forgetLessonStep(id: number): void {
  try {
    localStorage.removeItem(`lesson-step:${id}`)
  } catch {
    /* bỏ qua */
  }
}
