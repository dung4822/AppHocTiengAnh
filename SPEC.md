# SPEC — App desktop luyện nghe hiểu tiếng Anh (Electron + TypeScript)

> Gửi Claude Code: đây là toàn bộ yêu cầu. Hãy đọc hết file này trước khi làm gì khác.

---

## 0. Cách làm việc với mình (đọc trước)

1. **Lên kế hoạch trước, chưa code vội.** Đọc xong spec, đề xuất: cây thư mục, danh sách bảng DB, các bước làm. Chờ mình đồng ý rồi mới bắt đầu.
2. **Làm Giai đoạn 1 rồi đến Giai đoạn 2** (mục 9), lần lượt từng giai đoạn. Xong Giai đoạn 1 thì **dừng lại, báo mình chạy thử và kiểm tra** theo mục 10, mình đồng ý rồi mới sang Giai đoạn 2. Không tự thêm tính năng ngoài spec.
3. **Kiểm tra tài liệu API hiện tại, đừng đoán.** Trước khi viết code gọi API, đọc docs chính thức để xác nhận:
   - DeepSeek: base URL, tên model (hiện là `deepseek-flash`), cách bật JSON output, **cách tắt thinking mode** (model mặc định bật thinking).
   - `kokoro-js` (mục 3): cách khởi tạo trong Node, danh sách voice id, định dạng audio trả về.
4. **Code đơn giản, dễ đọc.** Mình là người mới với TypeScript (mình biết C# / ASP.NET Core), cần đọc hiểu được code. Không trừu tượng hóa quá mức. Comment bằng tiếng Việt ở chỗ có logic quan trọng (không comment những dòng hiển nhiên). Khi có khái niệm TS/Electron khác với C#, ghi chú ngắn so sánh với C# nếu giúp dễ hiểu.
5. **Viết `README.md` bằng tiếng Việt** gồm: cách cài và chạy, cách đóng gói ra file cài đặt, kiến trúc tổng quan (luồng dữ liệu đi qua những file nào, main process vs renderer, IPC), và đánh dấu rõ **phần nào là lõi cần hiểu kỹ** (logic chọn bài, prompt, DB, IPC) và **phần nào chỉ cần biết nó làm gì** (giao diện, cấu hình).
6. Môi trường: **Windows, laptop**, Node.js LTS.

---

## 1. Mục tiêu

App cá nhân, một người dùng, giúp mình (tiếng Anh khoảng B1, mục tiêu B2, TOEIC 700+) luyện **nghe hiểu ý** qua các bài nghe do AI tạo, đúng trình độ. Mỗi bài kèm câu hỏi hiểu ý và **đúng một điểm ngữ pháp**.

Nguyên tắc học (quan trọng, áp dụng cho mọi quyết định thiết kế):
- Nghe để **hiểu ý**, không soi từng từ. **Không có tính năng dictation / chép chính tả.**
- Bài nghe phải **vừa sức**: khoảng 90–95% từ đã biết, ít cụm mới.
- Ưu tiên **cụm từ thông dụng** (collocation, phrasal verb, câu nói sẵn), không dùng từ hiếm hay học thuật.
- Giải thích bằng **tiếng Việt đời thường**, không dùng thuật ngữ ngôn ngữ học.
- Ngữ pháp học theo **nghĩa** (người nói muốn nói gì), không học thuộc công thức.

---

## 2. Tech stack

App **desktop** chạy trên laptop, viết **toàn bộ bằng TypeScript**.

- **Electron** + **electron-vite** + **TypeScript**.
- **Giao diện:** React + CSS đơn giản (không cần UI framework nặng). Giao diện sạch, dễ đọc, có dark mode theo hệ thống.
- **Kiến trúc bắt buộc:**
  - Mọi thứ đụng tới DB, file, API key, gọi DeepSeek/TTS đều nằm ở **main process**.
  - Renderer (giao diện) **chỉ** gọi qua IPC, thông qua `preload` + `contextBridge` với API có kiểu rõ ràng. Bật `contextIsolation`, tắt `nodeIntegration`.
  - Tách code main thành các module rõ ràng: `db/`, `services/` (lesson, grading, lookup, tts, deepseek), `prompts/`, `ipc/`.
- **DB:** SQLite bằng `better-sqlite3`, một file trong thư mục dữ liệu của app (`app.getPath('userData')`). Viết migration bằng file SQL đơn giản, chạy tự động khi mở app.
- **Audio:** file mp3 trong `userData/audio/<lesson_id>/`. DB chỉ lưu đường dẫn. Phát audio trong renderer qua một custom protocol an toàn (không bật `webSecurity: false`).
- **Tần suất từ:** đóng gói sẵn một **danh sách tần suất từ tiếng Anh có giấy phép miễn phí**, ưu tiên dữ liệu văn nói/phụ đề (ví dụ SUBTLEX-US, hoặc bản export từ wordfreq). Kiểm tra giấy phép, ghi nguồn và giấy phép vào README. Chuyển thành giá trị kiểu Zipf (thang 1–7) để dùng thống nhất.
- **Lemma hóa** (đưa *went* về *go*, *meetings* về *meeting*) bằng một thư viện JS nhẹ, chọn thư viện phổ biến và còn được bảo trì.
- **CEFR:** nếu tìm được wordlist CEFR có giấy phép rõ ràng cho phép dùng cá nhân (ví dụ CEFR-J), thì import vào DB. Nếu không chắc về giấy phép thì **bỏ CEFR**, chỉ hiện mức tần suất.
- **Validate JSON** trả về từ LLM bằng `zod`.
- **Gọi DeepSeek:** DeepSeek tương thích định dạng OpenAI, nên dùng `fetch` thuần hoặc SDK `openai` trỏ base URL sang DeepSeek.
- **Chạy dev:** `npm run dev`. **Đóng gói:** `electron-builder` ra file cài đặt Windows.

---

## 3. Cấu hình

- API key được nhập trong **trang Cài đặt** của app, lưu local và mã hóa bằng `safeStorage` của Electron. **Không ghi key vào code, không commit.**
- Các cài đặt khác: `USER_LEVEL` (mặc định B1), model DeepSeek (mặc định `deepseek-flash`), giọng đọc A/B.

**TTS: chạy offline ngay trên máy bằng Kokoro** (miễn phí, không cần đăng ký tài khoản, không cần API key).
- Thư viện **`kokoro-js`** (model Kokoro-82M, giấy phép Apache 2.0), chạy trong Node với `device: "cpu"`, `dtype: "q8"`.
- **Lần đầu dùng** app tự tải model (khoảng vài chục tới ~100 MB) và lưu vào thư mục `userData` để các lần sau dùng offline. Hiện tiến trình tải cho người dùng thấy. Mất mạng lúc tải lần đầu thì báo lỗi rõ ràng và cho thử lại.
- **Không được làm đơ giao diện:** chạy TTS trong một process/thread riêng (`utilityProcess` của Electron hoặc `worker_threads`), khởi tạo model **một lần** rồi dùng lại cho mọi câu.
- `kokoro-js` trả về WAV. **Chuyển sang mp3** (dùng một encoder thuần JS như `lamejs`, không bắt cài ffmpeg) trước khi lưu, để audio nhiều bài không chiếm quá nhiều ổ đĩa.
- Giọng mặc định: giọng Mỹ, một nữ một nam (ví dụ `af_heart` / `am_michael`, Claude Code kiểm tra danh sách voice id thật). Có tùy chọn giọng Anh–Anh.
- Vẫn viết theo **interface `TtsProvider`** để sau này nếu muốn có thể thêm provider cloud mà không phải sửa code ở chỗ khác. Giai đoạn 1–2 chỉ cần Kokoro.

Hội thoại có 2 người nói (A/B) thì dùng **2 giọng khác nhau** (một nam, một nữ), chọn được trong Cài đặt. Người kể (N) dùng giọng A.

---

## 4. Database (gợi ý, có thể tinh chỉnh nhưng phải giải thích lý do)

- `settings(key, value)`
- `grammar_points(id, code, name_vi, name_en, is_core, order_no, times_taught, last_taught_at)`: nạp từ `seed/grammar.json` (mục 8).
- `lessons(id, created_at, topic, title, grammar_point_id, is_grammar_review, level, grammar_explanation_json, status)`
- `sentences(id, lesson_id, idx, speaker, text, audio_path)`
- `questions(id, lesson_id, idx, type, question, key_points_json, evidence_idxs_json)`
- `answers(id, question_id, user_answer, result, feedback_vi, natural_version, created_at)`. `result` ∈ `full | partial | none`.
- `vocab(id, text, text_normalized UNIQUE, kind, meaning_vi, source, first_lesson_id, context_sentence_id, context_vi, example_en, example_vi, example_audio_path, status, suspended, times_seen, last_seen_at, created_at)`.
  - `kind` ∈ `word | chunk`. `source` ∈ `lesson | lookup`. `status` ∈ `new | learning | known` (Giai đoạn 2 tính từ FSRS, xem mục 7b).
  - `context_sentence_id` trỏ tới câu trong bài chứa cụm đó, để **dùng lại audio sẵn có, không tạo audio mới**.
  - `suspended`: người dùng tạm ẩn thẻ không muốn học.
  - Mỗi từ/cụm chỉ có **một dòng** (trùng `text_normalized` thì cập nhật, không tạo thêm).
- `lesson_chunks(lesson_id, vocab_id, meaning_vi_in_context, is_review)`
- `lookup_cache(term_normalized PRIMARY KEY, result_json, created_at)`
- `api_usage(id, created_at, purpose, model, input_tokens, cached_tokens, output_tokens, est_cost_usd)`
- **Giai đoạn 2:** `review_cards(id, vocab_id, direction, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review)`. `direction` ∈ `listen | speak`. Mỗi vocab có 2 thẻ (mỗi chiều 1 thẻ). Tên cột theo đúng kiểu `Card` của thư viện `ts-fsrs`.
- **Giai đoạn 2:** `review_logs(id, card_id, rating, state, due, stability, difficulty, elapsed_days, scheduled_days, reviewed_at)`, lưu lịch sử để sau này có thể tối ưu tham số FSRS.

---

## 5. Luồng một bài học

### 5.1 Chọn nội dung bài (logic local, không gọi AI)
- **Điểm ngữ pháp:** lấy điểm **core** có `order_no` nhỏ nhất mà chưa dạy. Cứ mỗi bài thứ 4 thì làm **bài ôn**: chọn điểm đã dạy mà lâu chưa gặp nhất. Điểm *mở rộng* chỉ được chọn khi đã dạy hết core, hoặc tối đa 1 trong 5 bài.
- **Cụm ôn:** tối đa 5 cụm trong `vocab` (không `suspended`).
  - Giai đoạn 1: ưu tiên cụm có `last_seen_at` cũ nhất.
  - Giai đoạn 2: ưu tiên cụm có thẻ **sắp tới hạn** hoặc **hay quên** (`lapses` cao). Bài nghe là một lần ôn tự nhiên trong ngữ cảnh mới.
- **Số cụm mới:** 3–5.
- **Chủ đề:** mình chọn, hoặc random từ danh sách: đời sống hằng ngày, công việc lập trình viên junior, phỏng vấn xin việc, tình huống văn phòng kiểu TOEIC (họp, khách hàng, email, lịch hẹn, giao hàng), du lịch, sức khỏe, mua sắm. Tránh lặp lại tiêu đề của 10 bài gần nhất.

### 5.2 Tạo bài: gọi DeepSeek đúng 1 lần (prompt A, mục 6)
Kết quả trả về được validate bằng zod. Nếu JSON lỗi thì retry 1 lần.

### 5.3 Kiểm tra độ khó (local)
Tách từ trong script, lemma hóa, rồi tra danh sách tần suất. Một từ bị coi là **lạ** nếu thỏa cả ba: tần suất thấp hơn ngưỡng của level (đặt ngưỡng trong config), không có trong `vocab` với status `known`/`learning`, và không thuộc cụm mới của bài.
- Nếu tỉ lệ từ quen < 90%: gọi lại DeepSeek **tối đa 1 lần**, gửi kèm danh sách từ lạ, yêu cầu viết lại các câu chứa chúng bằng từ dễ hơn.

### 5.4 Tạo audio
Tạo audio bằng Kokoro cho **từng câu**, lưu thành mp3 riêng. Hiện tiến trình cho người dùng thấy (ví dụ "Đang tạo audio 12/40 câu").

### 5.5 Học (giao diện, mục 7)
Nghe (ẩn script) → trả lời câu hỏi → chấm (prompt B, **một lần gọi cho tất cả câu hỏi**) → mở script, nghe lại từng câu, tra từ → xem thẻ ngữ pháp.

Khi xong bài: cập nhật `times_seen` / `last_seen_at` cho các cụm trong bài, và `times_taught` / `last_taught_at` cho điểm ngữ pháp.

### 5.5b Lưu trữ (bắt buộc)
- **Mọi bài học được lưu vĩnh viễn**: script, câu hỏi, câu trả lời và kết quả chấm, giải thích ngữ pháp, **toàn bộ audio mp3**. Không bao giờ tự xóa, không bao giờ tạo lại audio cho bài cũ.
- Từ danh sách bài, mở lại bài cũ bất cứ lúc nào để **nghe lại** (cả bài hoặc từng câu, có script) hoặc **làm lại câu hỏi** (lưu thêm lượt trả lời mới, không ghi đè lượt cũ).
- **Mọi cụm DeepSeek trả về trong bài (cả cụm mới và cụm ôn) tự động được lưu thành thẻ** trong `vocab` ngay khi tạo bài xong, không cần bấm lưu. Mỗi thẻ gồm: cụm, nghĩa theo ngữ cảnh, câu chứa cụm (kèm audio của câu đó) và bản dịch câu.
- Ghi tổng dung lượng audio trong trang Cài đặt. README hướng dẫn **sao lưu**: chỉ cần copy thư mục `userData` (chỉ rõ đường dẫn trên Windows).
- Mỗi lần ghi DB quan trọng (tạo bài + tạo thẻ) dùng **transaction**: lỗi giữa chừng thì không để lại dữ liệu nửa vời.

### 5.6 Tra từ (prompt C)
- Kiểm tra `lookup_cache` trước. Có rồi thì trả về luôn, **không gọi API**.
- Cụm nằm trong danh sách cụm của bài đã có sẵn nghĩa theo ngữ cảnh, **không cần gọi API**.
- Nút **"Lưu thành thẻ"**: lưu vào `vocab` với `source=lookup`, lấy nghĩa phổ biến nhất và câu ví dụ đầu tiên từ kết quả tra. Gọi TTS **một lần** cho câu ví dụ, lưu thành `example_audio_path` để làm thẻ nghe. Nếu đang tra từ trong script của một bài thì lấy luôn câu trong bài làm ngữ cảnh (dùng audio sẵn có, không gọi TTS).
- Kết quả hiển thị kèm **mức tần suất** lấy từ danh sách tần suất đóng gói sẵn, đổi thành nhãn dễ hiểu (ví dụ: "Rất phổ biến", "Phổ biến", "Ít gặp", "Hiếm"), cộng thêm CEFR nếu có. **AI không được tự đoán tần suất.**

---

## 6. Prompt cho DeepSeek (đây là "bộ não" của app, làm thật kỹ)

**Quy tắc chung:**
- Đặt prompt trong `src/main/prompts/*.ts`, mỗi prompt một file, dễ đọc dễ sửa.
- **Phần system prompt cố định nằm đầu, dữ liệu thay đổi nằm cuối**, để tận dụng cache prefix của DeepSeek (input trùng prefix rẻ hơn rất nhiều).
- Dùng JSON output mode và **tắt thinking mode**.
- Đặt `max_tokens` vừa đủ cho từng loại. Temperature: tạo bài ~0.8, chấm bài ~0.2, tra từ ~0.3.
- Phản hồi cho người học phải **đủ ý, thân thiện, cụ thể**, nhưng không dài dòng.

Các prompt dưới đây là bản nháp. Bạn được phép cải thiện cách viết, nhưng **phải giữ nguyên các quy tắc**.

### Prompt A: Tạo bài
System (tiếng Anh, cố định):
```
You write listening lessons for a Vietnamese adult learning English (current level given below).
Goal: natural listening comprehension, NOT vocabulary drilling.

SCRIPT RULES
- Natural spoken American English: contractions, everyday phrasing, light natural fillers (rare).
- Dialogue between A and B (or a monologue if the topic suits it). 250–380 words (~2–3 min).
- Each sentence ≤ 20 words. One sentence per item.
- Vocabulary: stay mostly within the ~3000 most common English words for the given level.
- Include exactly the requested number of NEW chunks: high-frequency collocations, phrasal verbs
  or fixed expressions useful in daily life or work. Never rare, literary or academic words.
- Naturally reuse EACH review chunk once. Do not highlight it.
- Use the target grammar point naturally 2–3 times. Never force it, never mention it in the script.
- The script must have a clear point (a problem, a decision, a change of mind) so inference questions are possible.

QUESTIONS (simple English, ≤ 15 words each)
- 4 questions: 1 main_idea, 1 detail, 1 inference, 1 grammar_meaning
  (asks what the speaker MEANS by a sentence using the target grammar, e.g. "Did she call him?").
- Optionally a 5th: opinion (no right answer; key_points = []).
- For each: key_points = 1–3 short phrases a correct answer must contain (meaning, not wording);
  evidence = indices of the sentences containing the answer.

GRAMMAR EXPLANATION (Vietnamese, plain everyday language, NO linguistic jargon)
- form: short pattern; when: when people use it; meaning: what the speaker wants to express;
  vs_vietnamese: how Vietnamese says it / common mistake of Vietnamese learners;
  examples: 2 sentences copied from the script, each with a Vietnamese translation.

CHUNKS: list every NEW chunk and every review chunk exactly as used in the script,
with a short Vietnamese meaning IN THIS CONTEXT, the index of the sentence containing it,
and a natural Vietnamese translation of that whole sentence.

Return ONLY JSON matching the schema.
```
User (dữ liệu thay đổi): level, topic, grammar point (tên + mô tả ngắn), có phải bài ôn ngữ pháp không, số cụm mới, danh sách cụm ôn, tiêu đề 10 bài gần nhất (để tránh trùng).

Schema:
```json
{
  "title": "string",
  "sentences": [{"speaker": "A|B|N", "text": "string"}],
  "questions": [{"type": "main_idea|detail|inference|grammar_meaning|opinion",
                 "question": "string", "key_points": ["string"], "evidence": [0]}],
  "grammar": {"form": "", "when": "", "meaning": "", "vs_vietnamese": "",
              "examples": [{"en": "", "vi": ""}]},
  "chunks": [{"text": "string", "meaning_vi": "string", "sentence_idx": 0,
              "sentence_vi": "string", "is_review": false}]
}
```

### Prompt B: Chấm câu trả lời (gửi tất cả câu hỏi trong 1 lần gọi)
**Không gửi script.** Chỉ gửi: câu hỏi, key_points, câu trả lời của người học. (Bằng chứng trong script đã được lưu sẵn trong DB, app tự hiển thị.)

System:
```
You check listening comprehension for a Vietnamese learner.
Judge ONLY whether the answer shows the learner understood the MEANING in key_points.
Ignore grammar, spelling, word choice, and language (Vietnamese or English are both fine).
result: "full" = all key points understood; "partial" = some; "none" = missed or wrong.
For opinion questions: "full" if the answer is relevant to the content.
feedback_vi: 1–3 sentences in friendly, plain Vietnamese. Say specifically what was understood
and what was missed (describe the missed idea, don't just say "wrong").
natural_version: if the answer is in English and could sound more natural, give ONE natural way
a speaker would say it (keep the learner's idea). Otherwise null.
Return ONLY JSON: {"results":[{"idx":0,"result":"","feedback_vi":"","natural_version":null}]}
```

### Prompt C: Tra từ / cụm (không kèm ngữ cảnh, để cache dùng lại được)
System:
```
Explain an English word or phrase to a Vietnamese learner at about B1.
Plain everyday Vietnamese, no academic or grammar jargon.
- meanings: at most 3, ORDERED from most common to least common in everyday English.
  Skip rare/technical meanings. Each: short meaning_vi, one simple natural example (en) + vi.
- collocations: up to 4 common combinations with this word (short vi gloss each).
- note_vi: optional ONE short tip (common mistake of Vietnamese learners, or tone/register). Else null.
Return ONLY JSON:
{"term":"","meanings":[{"meaning_vi":"","example_en":"","example_vi":""}],
 "collocations":[{"text":"","vi":""}],"note_vi":null}
```

---

## 7. Giao diện (đơn giản, rõ ràng)

**Trang chủ**
- Nút "Tạo bài mới" (có ô chọn chủ đề hoặc random).
- Danh sách các bài đã học.
- Tiến độ ngữ pháp: đã học x/y điểm core.
- Ô **tra từ nhanh** luôn có sẵn.

**Trang bài học**, chia các bước rõ ràng:
1. **Nghe:** nút phát cả bài (phát nối các câu), tốc độ 0.75 / 0.9 / 1.0 / 1.1 (dùng `playbackRate`, không tạo lại audio). Script bị ẩn.
2. **Trả lời:** mỗi câu hỏi một ô nhập, ghi chú "Trả lời tiếng Việt hoặc tiếng Anh đều được". Có nút nghe lại cả bài.
3. **Kết quả:** mỗi câu hiện mức đúng (màu + chữ), nhận xét, cách nói tự nhiên (nếu có), và nút **"Nghe đoạn chứa đáp án"** để phát các câu bằng chứng.
4. **Script:** hiện toàn bộ script. Bấm vào câu để phát câu đó. Bôi đen hoặc bấm vào từ để mở **panel tra từ** bên cạnh (có nút "Lưu"). Các cụm của bài được tô nhẹ.
5. **Ngữ pháp:** thẻ giải thích ngữ pháp của bài.

**Trang từ vựng (dạng thẻ):** hiển thị các từ/cụm dưới dạng **lưới thẻ**. Mỗi thẻ có: cụm, nghĩa, câu ngữ cảnh, nút nghe, mức tần suất. Có ô tìm kiếm, bộ lọc (mới / đang học / đã thuộc / tạm ẩn, nguồn bài học / tra từ). Bấm vào thẻ thì mở chi tiết: giải thích đầy đủ (dùng `lookup_cache`, chưa có thì tra), bài học gốc (bấm để mở bài), nút tạm ẩn / xóa.

---

## 7b. Ôn tập ngắt quãng (Giai đoạn 2)

- Dùng thư viện **`ts-fsrs`** (thuật toán FSRS mà Anki đang dùng). **Không tự viết công thức lịch ôn.**
- Mỗi từ/cụm có **2 thẻ**:
  - **Thẻ nghe:** tự phát audio câu ngữ cảnh, **không hiện chữ**. Người học nhớ nghĩa → bấm "Hiện đáp án" → hiện câu (tô đậm cụm), nghĩa của cụm, bản dịch câu. Có nút nghe lại.
  - **Thẻ nói:** hiện nghĩa tiếng Việt của cụm và bản dịch câu → người học **nói to** câu tiếng Anh → bấm "Hiện đáp án" → hiện câu tiếng Anh và tự phát audio để so.
- 4 nút chấm **Quên / Khó / Được / Dễ**, mỗi nút hiện khoảng thời gian tới lần ôn tiếp theo (lấy từ `ts-fsrs`). Có phím tắt 1–4 và phím cách để hiện đáp án.
- **Giới hạn mỗi ngày** (chỉnh được trong Cài đặt): thẻ mới 10/ngày, thẻ ôn tối đa 100/ngày. Thẻ nghe của một từ được giới thiệu trước, thẻ nói của từ đó chỉ mở **sau khi thẻ nghe đã được ôn ít nhất 1 lần** (nhận biết trước, dùng sau).
- **Thứ tự trong phiên ôn:** thẻ tới hạn trước, thẻ mới sau. Không cho 2 thẻ của cùng một từ đứng liền nhau.
- **Cập nhật `vocab.status`:** chưa ôn lần nào là `new`; thẻ nghe có `stability` ≥ 21 ngày **và** thẻ nói ≥ 21 ngày thì là `known`; còn lại là `learning`. Bước kiểm tra độ khó (5.3) và chọn cụm ôn (5.1) dùng status này.
- Trang chủ hiện **số thẻ cần ôn hôm nay** và nút "Ôn tập". Kết thúc phiên ôn thì hiện tóm tắt ngắn (số thẻ, tỉ lệ nhớ).
- Ôn tập **không gọi API**, chạy offline hoàn toàn.

**Trang cài đặt:** nhập API key DeepSeek, level, chọn 2 giọng (có nút nghe thử), **chi phí API tháng này** (tổng hợp từ `api_usage`).

Lần đầu mở app chưa có API key thì tự đưa người dùng tới trang Cài đặt.

Lỗi API (mất mạng, hết tiền, JSON hỏng) thì hiện thông báo tiếng Việt dễ hiểu. **Không làm crash app.**

---

## 8. Danh sách ngữ pháp (seed `seed/grammar.json`, theo đúng thứ tự)

**Core:**
1. Hiện tại đơn và hiện tại tiếp diễn
2. Quá khứ đơn và quá khứ tiếp diễn
3. Hiện tại hoàn thành và quá khứ đơn
4. Hiện tại hoàn thành tiếp diễn
5. Quá khứ hoàn thành
6. Tương lai: will / be going to / hiện tại tiếp diễn cho kế hoạch
7. used to / would (thói quen quá khứ) / be used to
8. can / could / be able to
9. must / have to / don't have to / should
10. Phỏng đoán hiện tại: must be / might be / can't be
11. should have / could have / must have / might have
12. Câu điều kiện loại 0 và 1
13. Câu điều kiện loại 2
14. Câu điều kiện loại 3
15. wish / if only
16. Bị động (hiện tại, quá khứ)
17. Bị động với modal và thì hoàn thành
18. Mệnh đề quan hệ who / which / that / where
19. Mệnh đề quan hệ không xác định (có dấu phẩy)
20. V-ing và to V sau động từ
21. want / ask / tell someone to do
22. Câu tường thuật (trần thuật)
23. Câu tường thuật (câu hỏi, lời đề nghị)
24. So sánh hơn, so sánh nhất, as...as
25. too / enough / so / such
26. Câu hỏi gián tiếp (Do you know where...?)
27. Câu hỏi đuôi
28. Phrasal verb tách được / không tách được
29. although / even though / despite / however
30. so that / in order to / so...that
31. Danh từ đếm được / không đếm được và lượng từ
32. have / get something done
33. make / let / help someone do
34. Tính từ đuôi -ed và -ing

**Mở rộng** (ít dùng):
- Câu điều kiện hỗn hợp
- would rather / had better
- unless / as long as / provided that
- be supposed to
- It's time + quá khứ
- Câu chẻ (What I need is...)
- Mệnh đề phân từ
- Tương lai tiếp diễn / tương lai hoàn thành
- so do I / neither do I
- Đảo ngữ cơ bản (Never have I...)

---

## 9. Phạm vi

**Giai đoạn 1:** toàn bộ mục 1–8, **trừ** mục 7b và các phần ghi "Giai đoạn 2". Lưu trữ (5.5b) và trang thẻ từ vựng thuộc Giai đoạn 1.

**Giai đoạn 2:** mục 7b, các bảng `review_cards` / `review_logs`, và logic Giai đoạn 2 ở 5.1. Khi bật Giai đoạn 2, tạo thẻ FSRS cho **toàn bộ vocab đã có** từ Giai đoạn 1 (migration).

**KHÔNG làm (để sau):**
- Ghi âm, shadowing, luyện nói (giai đoạn 3).
- Đăng nhập, nhiều người dùng, đồng bộ online, tự động cập nhật app.
- Dictation.

---

## 10. Tiêu chí hoàn thành

**Giai đoạn 1**

- [ ] `npm run dev` chạy được; `electron-builder` đóng gói ra file cài đặt Windows dùng được.
- [ ] Renderer không truy cập trực tiếp Node/DB/API key (chỉ qua IPC).
- [ ] Tạo được bài mới hoàn chỉnh: script + câu hỏi + ngữ pháp + audio từng câu với 2 giọng.
- [ ] Bước kiểm tra độ khó hoạt động (log ra tỉ lệ từ quen).
- [ ] Chấm câu trả lời theo ý, phản hồi bằng tiếng Việt, có nút nghe đoạn chứa đáp án.
- [ ] Tra từ hoạt động. Lần tra thứ 2 cùng một từ **không gọi API**.
- [ ] Tắt app, mở lại: dữ liệu vẫn còn.
- [ ] Trang cài đặt hiện chi phí API tháng này.
- [ ] README tiếng Việt đầy đủ như mục 0.
- [ ] Bài cũ mở lại được, nghe lại được, làm lại câu hỏi được; audio không bị tạo lại.
- [ ] Tạo bài xong thì mọi cụm tự thành thẻ trong trang từ vựng, có câu ngữ cảnh và audio.
- [ ] Tra từ → "Lưu thành thẻ" hoạt động; lưu trùng không tạo thẻ thứ hai.

**Giai đoạn 2**
- [ ] Phiên ôn chạy được với cả thẻ nghe và thẻ nói, offline.
- [ ] Lịch ôn đúng theo `ts-fsrs`; nút chấm hiện khoảng thời gian tới lần ôn sau.
- [ ] Giới hạn thẻ mới / ngày hoạt động; thẻ nói chỉ mở sau khi thẻ nghe đã ôn.
- [ ] Vocab từ Giai đoạn 1 có đủ thẻ sau migration.
- [ ] Bài nghe mới ưu tiên lồng các cụm sắp tới hạn / hay quên.
- [ ] `vocab.status` cập nhật đúng và được dùng trong bước kiểm tra độ khó.
