-- Migration 001: các bảng của Giai đoạn 1

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- description_en: mô tả ngắn bằng tiếng Anh, gửi kèm prompt để AI hiểu đúng điểm ngữ pháp
CREATE TABLE grammar_points (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT NOT NULL UNIQUE,
  name_vi        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  description_en TEXT NOT NULL DEFAULT '',
  is_core        INTEGER NOT NULL,
  order_no       INTEGER NOT NULL,
  times_taught   INTEGER NOT NULL DEFAULT 0,
  last_taught_at TEXT
);

-- status: audio_pending (đã lưu nội dung, audio chưa xong) | ready | done (đã học xong)
-- known_ratio: tỉ lệ từ quen sau bước kiểm tra độ khó (0..1)
CREATE TABLE lessons (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  topic                    TEXT NOT NULL,
  title                    TEXT NOT NULL,
  grammar_point_id         INTEGER NOT NULL REFERENCES grammar_points(id),
  is_grammar_review        INTEGER NOT NULL DEFAULT 0,
  level                    TEXT NOT NULL,
  grammar_explanation_json TEXT NOT NULL,
  known_ratio              REAL,
  status                   TEXT NOT NULL DEFAULT 'audio_pending'
);

CREATE TABLE sentences (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  idx        INTEGER NOT NULL,
  speaker    TEXT NOT NULL,
  text       TEXT NOT NULL,
  audio_path TEXT,
  UNIQUE (lesson_id, idx)
);

CREATE TABLE questions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id          INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  idx                INTEGER NOT NULL,
  type               TEXT NOT NULL,
  question           TEXT NOT NULL,
  key_points_json    TEXT NOT NULL,
  evidence_idxs_json TEXT NOT NULL
);

-- Mỗi lần trả lời là một dòng mới (làm lại không ghi đè lượt cũ)
CREATE TABLE answers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id     INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_answer     TEXT NOT NULL,
  result          TEXT NOT NULL CHECK (result IN ('full', 'partial', 'none')),
  feedback_vi     TEXT NOT NULL,
  natural_version TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE vocab (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  text                TEXT NOT NULL,
  text_normalized     TEXT NOT NULL UNIQUE,
  kind                TEXT NOT NULL CHECK (kind IN ('word', 'chunk')),
  meaning_vi          TEXT NOT NULL,
  source              TEXT NOT NULL CHECK (source IN ('lesson', 'lookup')),
  first_lesson_id     INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  context_sentence_id INTEGER REFERENCES sentences(id) ON DELETE SET NULL,
  context_vi          TEXT,
  example_en          TEXT,
  example_vi          TEXT,
  example_audio_path  TEXT,
  status              TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'known')),
  suspended           INTEGER NOT NULL DEFAULT 0,
  times_seen          INTEGER NOT NULL DEFAULT 0,
  last_seen_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE lesson_chunks (
  lesson_id             INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  vocab_id              INTEGER NOT NULL REFERENCES vocab(id) ON DELETE CASCADE,
  meaning_vi_in_context TEXT NOT NULL,
  is_review             INTEGER NOT NULL DEFAULT 0,
  sentence_idx          INTEGER,
  PRIMARY KEY (lesson_id, vocab_id)
);

CREATE TABLE lookup_cache (
  term_normalized TEXT PRIMARY KEY,
  result_json     TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE api_usage (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  purpose       TEXT NOT NULL,
  model         TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL,
  cached_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  est_cost_usd  REAL NOT NULL
);

-- Danh sách CEFR (CEFR-J + Octanove), nạp từ resources/cefr-en.json
CREATE TABLE word_cefr (
  word  TEXT PRIMARY KEY,
  level TEXT NOT NULL
);

CREATE INDEX idx_sentences_lesson ON sentences(lesson_id);
CREATE INDEX idx_questions_lesson ON questions(lesson_id);
CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_api_usage_created ON api_usage(created_at);
