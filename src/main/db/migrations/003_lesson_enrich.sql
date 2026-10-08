-- Migration 003: nội dung "làm giàu" cho bài học, tạo bằng 2 lần gọi AI riêng sau khi tạo bài
-- grammar_deep_json: giải thích ngữ pháp chi tiết (nhiều phần, ví dụ, lỗi hay gặp, mẹo nghe, bài tập nhỏ)
-- annotations_json: chú thích script kiểu Language Reactor (dịch từng câu, nghĩa từng từ theo ngữ cảnh, các cụm từ)
ALTER TABLE lessons ADD COLUMN grammar_deep_json TEXT;
ALTER TABLE lessons ADD COLUMN annotations_json TEXT;
