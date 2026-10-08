import { app } from 'electron'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { UserError } from './errors'

// Cho phép đặt thư mục dữ liệu (DB, audio, model) ở nơi khác ổ C, ví dụ ổ D.
// Cách làm: một file nhỏ "data-location.json" nằm ở thư mục mặc định (%APPDATA%\Luyen Nghe)
// ghi đường dẫn thư mục dữ liệu thật. Khi app khởi động, nếu có file này thì đổi userData sang đó.

// Ghi lại thư mục mặc định TRƯỚC khi bị đổi
const defaultUserData = app.getPath('userData')
const pointerFile = join(defaultUserData, 'data-location.json')

// Tên thư mục con được tạo bên trong thư mục người dùng chọn
export const DATA_FOLDER_NAME = 'LuyenNgheData'

// Các file/thư mục dữ liệu của app cần chuyển (cache của Chromium thì không cần).
// "Local State" chứa khóa mà safeStorage dùng để mã hóa API key → thiếu file này thì key đã lưu không giải mã được.
const DATA_ITEMS = ['app.db', 'app.db-wal', 'app.db-shm', 'audio', 'models', 'Local State']

// Gọi ở đầu main/index.ts, trước khi app sẵn sàng
export function applyDataDirOverride(): void {
  try {
    if (!existsSync(pointerFile)) return
    const { dataDir } = JSON.parse(readFileSync(pointerFile, 'utf8')) as { dataDir?: string }
    if (dataDir) {
      mkdirSync(dataDir, { recursive: true })
      app.setPath('userData', dataDir)
    }
  } catch (err) {
    // File hỏng hoặc ổ đĩa không có → dùng thư mục mặc định, không để app crash
    console.error('[data] không đọc được data-location.json, dùng thư mục mặc định', err)
  }
}

// Copy dữ liệu sang thư mục mới. Hàm `beforeCopy` dùng để đóng DB và tắt TTS trước khi copy.
// Trả về đường dẫn thư mục mới; người gọi sẽ khởi động lại app.
export function moveDataDir(parentDir: string, beforeCopy: () => void): string {
  const from = resolve(app.getPath('userData'))
  const to = resolve(join(parentDir, DATA_FOLDER_NAME))
  if (to.toLowerCase() === from.toLowerCase()) throw new UserError('Dữ liệu đang nằm ở thư mục này rồi.')
  if (existsSync(join(to, 'app.db'))) {
    throw new UserError(`Thư mục ${to} đã có dữ liệu của app khác. Hãy chọn nơi khác hoặc xóa thư mục đó trước.`)
  }

  beforeCopy()
  mkdirSync(to, { recursive: true })
  for (const item of DATA_ITEMS) {
    const src = join(from, item)
    if (existsSync(src)) cpSync(src, join(to, item), { recursive: true })
  }
  // Copy xong mới ghi file trỏ và xóa bản cũ → lỗi giữa chừng thì dữ liệu cũ vẫn còn nguyên
  writeFileSync(pointerFile, JSON.stringify({ dataDir: to }, null, 2), 'utf8')
  for (const item of DATA_ITEMS) {
    if (item === 'Local State') continue // Chromium đang dùng file này, để nguyên
    const src = join(from, item)
    if (existsSync(src)) rmSync(src, { recursive: true, force: true })
  }
  return to
}
