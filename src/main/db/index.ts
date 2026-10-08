import Database from 'better-sqlite3'
import { dbPath } from '../paths'
import { seedIfNeeded } from './seed'
// "?raw" là cú pháp của Vite: nhúng nội dung file SQL thành chuỗi lúc build
import m001 from './migrations/001_init.sql?raw'
import m002 from './migrations/002_review.sql?raw'
import m003 from './migrations/003_lesson_enrich.sql?raw'
import m004 from './migrations/004_words.sql?raw'
import m005 from './migrations/005_units_listening.sql?raw'

// Danh sách migration theo thứ tự. Thêm file mới thì thêm vào cuối mảng.
const MIGRATIONS: string[] = [m001, m002, m003, m004, m005]

let db: Database.Database | null = null

// Lấy kết nối DB dùng chung (giống một singleton DbContext trong C#).
// better-sqlite3 là API đồng bộ (synchronous) nên không cần await.
export function getDb(): Database.Database {
  if (!db) throw new Error('DB chưa được mở')
  return db
}

export function openDb(): Database.Database {
  db = new Database(dbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  seedIfNeeded(db)
  return db
}

// PRAGMA user_version lưu số migration đã chạy, chạy tiếp các migration còn thiếu.
function runMigrations(d: Database.Database): void {
  const current = d.pragma('user_version', { simple: true }) as number
  for (let i = current; i < MIGRATIONS.length; i++) {
    const run = d.transaction(() => {
      d.exec(MIGRATIONS[i])
      d.pragma(`user_version = ${i + 1}`)
    })
    run()
    console.log(`[db] đã chạy migration ${i + 1}`)
  }
}

export function closeDb(): void {
  db?.close()
  db = null
}
