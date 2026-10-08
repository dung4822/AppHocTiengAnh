-- Migration 002 (Giai đoạn 2): ôn tập ngắt quãng FSRS
-- Tên cột theo đúng kiểu Card / ReviewLog của thư viện ts-fsrs.
-- Thời gian (due, last_review, reviewed_at) lưu dạng số mili-giây (epoch) để so sánh chính xác.

CREATE TABLE review_cards (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  vocab_id       INTEGER NOT NULL REFERENCES vocab(id) ON DELETE CASCADE,
  direction      TEXT NOT NULL CHECK (direction IN ('listen', 'speak')),
  due            INTEGER NOT NULL,
  stability      REAL NOT NULL DEFAULT 0,
  difficulty     REAL NOT NULL DEFAULT 0,
  elapsed_days   INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  learning_steps INTEGER NOT NULL DEFAULT 0, -- ts-fsrs v5 cần cột này cho các bước học (1m, 10m)
  reps           INTEGER NOT NULL DEFAULT 0,
  lapses         INTEGER NOT NULL DEFAULT 0,
  state          INTEGER NOT NULL DEFAULT 0, -- 0 New, 1 Learning, 2 Review, 3 Relearning
  last_review    INTEGER,
  UNIQUE (vocab_id, direction)
);

-- Lịch sử ôn: lưu đủ thông tin để hoàn tác (rollback) và sau này tối ưu tham số FSRS
CREATE TABLE review_logs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id           INTEGER NOT NULL REFERENCES review_cards(id) ON DELETE CASCADE,
  rating            INTEGER NOT NULL, -- 1 Quên, 2 Khó, 3 Được, 4 Dễ
  state             INTEGER NOT NULL, -- trạng thái của thẻ TRƯỚC khi ôn
  due               INTEGER NOT NULL,
  stability         REAL NOT NULL,
  difficulty        REAL NOT NULL,
  elapsed_days      INTEGER NOT NULL,
  last_elapsed_days INTEGER NOT NULL DEFAULT 0,
  scheduled_days    INTEGER NOT NULL,
  learning_steps    INTEGER NOT NULL DEFAULT 0,
  reviewed_at       INTEGER NOT NULL
);

CREATE INDEX idx_review_cards_due ON review_cards(state, due);
CREATE INDEX idx_review_logs_card ON review_logs(card_id);
CREATE INDEX idx_review_logs_time ON review_logs(reviewed_at);

-- Mỗi từ/cụm mới thêm vào vocab tự động có 2 thẻ: nghe và nói
CREATE TRIGGER trg_vocab_cards AFTER INSERT ON vocab
BEGIN
  INSERT INTO review_cards (vocab_id, direction, due) VALUES
    (NEW.id, 'listen', CAST(strftime('%s', 'now') AS INTEGER) * 1000),
    (NEW.id, 'speak',  CAST(strftime('%s', 'now') AS INTEGER) * 1000);
END;

-- Tạo thẻ cho toàn bộ vocab đã có từ Giai đoạn 1
INSERT INTO review_cards (vocab_id, direction, due)
SELECT id, 'listen', CAST(strftime('%s', 'now') AS INTEGER) * 1000 FROM vocab;
INSERT INTO review_cards (vocab_id, direction, due)
SELECT id, 'speak', CAST(strftime('%s', 'now') AS INTEGER) * 1000 FROM vocab;
