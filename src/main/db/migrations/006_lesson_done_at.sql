-- Migration 006: ghi lại lúc học xong bài, để trang "Thành quả" đếm số bài theo ngày
ALTER TABLE lessons ADD COLUMN done_at TEXT;

-- Bài đã xong từ trước: lấy lần trả lời câu hỏi cuối cùng, không có thì lấy lúc tạo bài
UPDATE lessons SET done_at = COALESCE(
  (SELECT MAX(a.created_at) FROM answers a JOIN questions q ON q.id = a.question_id WHERE q.lesson_id = lessons.id),
  created_at
)
WHERE status = 'done';
