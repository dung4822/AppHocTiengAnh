import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'

// Tất cả dữ liệu của app nằm trong thư mục userData
// (Windows: C:\Users\<tên>\AppData\Roaming\Luyen Nghe). Sao lưu = copy cả thư mục này.
export function userDataDir(): string {
  return app.getPath('userData')
}

export function dbPath(): string {
  return join(userDataDir(), 'app.db')
}

export function audioRoot(): string {
  const dir = join(userDataDir(), 'audio')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function lessonAudioDir(lessonId: number): string {
  const dir = join(audioRoot(), String(lessonId))
  mkdirSync(dir, { recursive: true })
  return dir
}

// Audio câu ví dụ của thẻ lưu từ trang tra từ
export function vocabAudioDir(): string {
  const dir = join(audioRoot(), 'vocab')
  mkdirSync(dir, { recursive: true })
  return dir
}

// Audio nghe thử giọng (không phải dữ liệu bài học)
export function previewAudioDir(): string {
  const dir = join(audioRoot(), 'preview')
  mkdirSync(dir, { recursive: true })
  return dir
}

// Nơi lưu model Kokoro sau lần tải đầu tiên
export function modelCacheDir(): string {
  const dir = join(userDataDir(), 'models')
  mkdirSync(dir, { recursive: true })
  return dir
}
