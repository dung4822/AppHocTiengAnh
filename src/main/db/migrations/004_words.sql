-- Migration 004: trạng thái từng từ (kiểu LingQ) + từ hay quên (leech)
-- Xem thiết kế ở docs/THIET_KE_TU_VUNG.md

-- Mỗi TỪ GỐC (went → go) một dòng. Trạng thái "đang học" không lưu ở đây mà suy ra từ bảng vocab (có thẻ).
CREATE TABLE words (
  lemma          TEXT PRIMARY KEY,
  status         TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'known', 'ignored')),
  seen_count     INTEGER NOT NULL DEFAULT 0, -- số bài nghe (đã học xong) có từ này
  lookup_count   INTEGER NOT NULL DEFAULT 0, -- số lần bạn chủ động tra từ này
  last_seen_at   TEXT,
  last_lookup_at TEXT,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Từ hay quên: leech = 1 khi một thẻ bị quên ≥ 4 lần.
-- rescue_json: nội dung AI viết thêm (mẹo nhớ, phân biệt, câu mới); rescue_audio_json: audio các câu mới
ALTER TABLE vocab ADD COLUMN leech INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vocab ADD COLUMN rescue_json TEXT;
ALTER TABLE vocab ADD COLUMN rescue_audio_json TEXT;
