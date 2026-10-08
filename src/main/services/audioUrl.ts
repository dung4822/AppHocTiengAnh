import { join, relative, sep } from 'node:path'
import { audioRoot } from '../paths'

// DB chỉ lưu đường dẫn TƯƠNG ĐỐI so với thư mục audio (ví dụ "12/003.mp3"),
// nhờ vậy copy thư mục userData sang máy khác vẫn dùng được.

export const AUDIO_SCHEME = 'app-audio'

export function toRelativeAudioPath(absPath: string): string {
  return relative(audioRoot(), absPath).split(sep).join('/')
}

export function toAbsoluteAudioPath(relPath: string): string {
  return join(audioRoot(), ...relPath.split('/'))
}

// URL để renderer phát audio qua custom protocol (xem đăng ký protocol trong main/index.ts)
export function audioUrl(relPath: string | null | undefined): string | null {
  if (!relPath) return null
  return `${AUDIO_SCHEME}://audio/${relPath.split('/').map(encodeURIComponent).join('/')}`
}
