import type Database from 'better-sqlite3'
import grammarSeed from '../../../seed/grammar.json'
import cefrData from '../../../resources/cefr-en.json'

interface GrammarSeedItem {
  code: string
  name_vi: string
  name_en: string
  desc: string
}

// Nạp dữ liệu ban đầu. Dùng INSERT OR IGNORE theo code nên chạy lại nhiều lần không bị trùng,
// và nếu sau này thêm điểm ngữ pháp mới vào grammar.json thì nó sẽ được nạp thêm.
export function seedIfNeeded(db: Database.Database): void {
  const insertGrammar = db.prepare(`
    INSERT INTO grammar_points (code, name_vi, name_en, description_en, is_core, order_no)
    VALUES (@code, @name_vi, @name_en, @desc, @is_core, @order_no)
    ON CONFLICT(code) DO UPDATE SET name_vi = excluded.name_vi, name_en = excluded.name_en,
      description_en = excluded.description_en, is_core = excluded.is_core, order_no = excluded.order_no
  `)
  db.transaction(() => {
    const core = grammarSeed.core as GrammarSeedItem[]
    const ext = grammarSeed.extended as GrammarSeedItem[]
    core.forEach((g, i) => insertGrammar.run({ ...g, is_core: 1, order_no: i + 1 }))
    // Điểm mở rộng đánh số sau core
    ext.forEach((g, i) => insertGrammar.run({ ...g, is_core: 0, order_no: 100 + i + 1 }))
  })()

  const cefrCount = (db.prepare('SELECT COUNT(*) AS n FROM word_cefr').get() as { n: number }).n
  if (cefrCount === 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO word_cefr (word, level) VALUES (?, ?)')
    db.transaction(() => {
      for (const [word, level] of Object.entries(cefrData as Record<string, string>)) insert.run(word, level)
    })()
    console.log('[db] đã nạp danh sách CEFR')
  }
}
