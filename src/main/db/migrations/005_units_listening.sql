-- Migration 005: đơn vị nghĩa (đếm vốn từ không trùng) + thời gian nghe

-- Một "đơn vị nghĩa" = một ý nghĩa từ vựng. Nhiều thẻ có thể chung một đơn vị:
--   "runs out" / "run out", "appreciate" / "really appreciate it", "on it" / "get on it"...
-- Còn "run" và "run out" khác nghĩa → 2 đơn vị.
CREATE TABLE vocab_units (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  head       TEXT NOT NULL,          -- dạng đại diện (thẻ đầu tiên của đơn vị)
  meaning_vi TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- unit_id NULL = chưa xếp nhóm (app xếp ở nền); canonical = dạng chuẩn hóa dùng để gộp nhanh không cần AI
ALTER TABLE vocab ADD COLUMN unit_id INTEGER REFERENCES vocab_units(id) ON DELETE SET NULL;
ALTER TABLE vocab ADD COLUMN canonical TEXT;
CREATE INDEX idx_vocab_unit ON vocab(unit_id);
CREATE INDEX idx_vocab_canonical ON vocab(canonical);

-- Thời gian nghe thật (audio đang phát), cộng dồn theo ngày và theo nơi nghe
CREATE TABLE listening_log (
  day     TEXT NOT NULL,  -- ngày theo giờ máy, mốc 4 giờ sáng như phần ôn tập (YYYY-MM-DD)
  source  TEXT NOT NULL,  -- lesson | review | other
  seconds REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (day, source)
);
