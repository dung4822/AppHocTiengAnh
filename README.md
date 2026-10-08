# Luyện Nghe — app desktop luyện nghe hiểu tiếng Anh

App cá nhân (Electron + TypeScript) tạo bài nghe bằng AI (DeepSeek) đúng trình độ, đọc bằng giọng Kokoro chạy **offline** trên máy, kèm câu hỏi hiểu ý, đúng một điểm ngữ pháp mỗi bài, tra từ và thẻ từ vựng.

> Trạng thái: **Giai đoạn 1** và **Giai đoạn 2** (ôn tập ngắt quãng FSRS) đã xong.

---

## 1. Cài đặt và chạy

### Yêu cầu
- Windows 10/11, 64-bit.
- **Node.js 22 trở lên** (khuyên dùng Node 24 LTS). Electron 42 và electron-builder mới không cài được với Node 20.
  - Máy đang dùng nvm-windows: bản Node 24 đã được đặt sẵn trong `%APPDATA%\nvm\v24.21.0`. Mở terminal **với quyền Administrator** và chạy `nvm use 24.21.0`.
- Không cần Visual Studio / Python: `better-sqlite3` dùng bản dựng sẵn cho Electron.

### Chạy khi phát triển
```bash
npm install
npm run dev
```
`npm install` tự chạy `electron-builder install-app-deps` để tải bản `better-sqlite3` đúng cho Electron.

> npm 11 chặn script cài đặt của thư viện nếu chưa được cho phép. Danh sách thư viện được phép đã ghi trong mục `allowScripts` của `package.json`. Nếu sau này npm báo thư viện mới cần chạy script, dùng `npm install-scripts approve <tên>`.

Lần đầu mở app: chưa có API key → app tự mở trang **Cài đặt**. Nhập key DeepSeek (lấy ở platform.deepseek.com) rồi bấm Lưu.
Lần đầu tạo audio: app tải model Kokoro (~92 MB, có hiện tiến trình) vào thư mục dữ liệu; các lần sau chạy offline.

### Các lệnh khác
| Lệnh | Làm gì |
|---|---|
| `npm run dev` | Chạy app ở chế độ phát triển (tự reload giao diện khi sửa code) |
| `npm run build` | Build code ra thư mục `out/` |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run dist` | Build + đóng gói file cài đặt Windows |

## 2. Đóng gói ra file cài đặt

```bash
npm run dist
```
File cài đặt nằm ở `dist/LuyenNghe-Setup-1.0.0.exe`. Cấu hình đóng gói ở `electron-builder.yml`
(các thư viện native như `better-sqlite3`, `onnxruntime-node` được để ngoài file `.asar` để chạy được).

## 3. Dữ liệu và sao lưu

Mọi dữ liệu nằm trong một thư mục (`app.getPath('userData')`):

```
C:\Users\<tên bạn>\AppData\Roaming\Luyen Nghe\
├── app.db          ← SQLite: bài học, câu hỏi, câu trả lời, thẻ từ vựng, chi phí API, cài đặt
├── audio\          ← mp3: audio\<id bài>\000.mp3..., audio\vocab\<id thẻ>.mp3
└── models\         ← model Kokoro đã tải (có thể xóa, app sẽ tải lại)
```

**Chuyển dữ liệu sang ổ khác** (cho đỡ đầy ổ C): trang Cài đặt → "Chuyển dữ liệu sang ổ khác...", chọn thư mục, app sẽ tạo thư mục con `LuyenNgheData`, copy dữ liệu sang, ghi đường dẫn mới vào file nhỏ `%APPDATA%\Luyen Nghe\data-location.json` rồi tự khởi động lại (code: `src/main/dataLocation.ts`).
Trên máy này dữ liệu đang ở **`D:\AppHocTiengAnh\LuyenNgheData`**, app cài ở `D:\AppHocTiengAnh\LuyenNghe-App` (cài lại vào ổ D: `LuyenNghe-Setup-1.0.0.exe /S /D=D:\AppHocTiengAnh\LuyenNghe-App`, hoặc chọn thư mục trong trình cài đặt).

**Sao lưu:** tắt app rồi copy cả thư mục dữ liệu (mặc định `Luyen Nghe`, hoặc `LuyenNgheData` nếu đã chuyển) (gõ `%APPDATA%\Luyen Nghe` vào thanh địa chỉ của File Explorer). Muốn khôi phục thì chép đè lại.
Trang Cài đặt có nút "Mở thư mục dữ liệu" và hiện tổng dung lượng audio.

API key được mã hóa bằng `safeStorage` trước khi lưu vào DB. Khóa giải mã nằm trong file `Local State` của thư mục dữ liệu (được bảo vệ bằng DPAPI của Windows), nên khi sao lưu hãy copy cả file đó; sang máy/tài khoản Windows khác thì phải nhập lại key.

## 4. Kiến trúc tổng quan

Electron có 2 loại process (gần giống backend + frontend trong ASP.NET Core):

- **Main process** (`src/main/`) = "backend": Node.js, được dùng DB, file, mạng, API key.
- **Renderer** (`src/renderer/`) = "frontend": React chạy trong cửa sổ. **Không** có quyền Node (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`).
- **Preload** (`src/preload/index.ts`) = cầu nối: dùng `contextBridge` đưa một object `window.api` có kiểu rõ ràng (`AppApi` trong `src/shared/types.ts`) sang renderer.
- **IPC** = cách hai bên nói chuyện: renderer gọi `window.api.xxx()` → `ipcRenderer.invoke('kênh')` → main xử lý trong `ipcMain.handle('kênh')`. Giống gọi một endpoint của Web API nội bộ. Mỗi kết quả là `IpcResult<T>` = `{ ok: true, data }` hoặc `{ ok: false, error }` (thông báo lỗi tiếng Việt), nên lỗi API không bao giờ làm crash app.
- **Process TTS riêng** (`utilityProcess`, file `ttsWorker.ts`): chạy model Kokoro để giao diện không bị đơ. Main gửi message `{type:'synth', text, voice, outPath}`, worker tạo mp3 rồi trả `{type:'done'}`.

### Cây thư mục

```
seed/grammar.json            Danh sách 34 điểm ngữ pháp core + 10 điểm mở rộng (theo thứ tự)
resources/                   Dữ liệu đóng gói sẵn: tần suất từ, CEFR (tạo bởi scripts/build_wordlists.py)
src/shared/types.ts          Kiểu dữ liệu dùng chung main ↔ renderer (DTO) và interface AppApi
src/preload/index.ts         window.api → ipcRenderer.invoke
src/main/
  index.ts                   Tạo cửa sổ, đăng ký protocol app-audio://, đăng ký IPC
  config.ts                  Hằng số chỉnh được: ngưỡng tần suất theo level, giá API, chủ đề, giọng đọc
  paths.ts                   Đường dẫn userData / audio / models
  errors.ts                  UserError: lỗi có thông báo tiếng Việt
  db/                        Mở SQLite, chạy migration (migrations/*.sql), seed dữ liệu
  ipc/handlers.ts            Danh sách tất cả kênh IPC
  prompts/                   4 prompt gửi DeepSeek (mỗi prompt một file) + schema zod
  services/
    lessonService.ts         Chọn nội dung bài, tạo bài, lưu DB, tạo audio, hoàn thành bài
    deepseek.ts              Gọi API, validate JSON, thử lại, ghi chi phí
    gradingService.ts        Chấm câu trả lời
    lookupService.ts         Tra từ (cache), lưu thành thẻ
    reviewService.ts         Ôn tập ngắt quãng FSRS (Giai đoạn 2)
    vocabService.ts          Danh sách / tạm ẩn / xóa thẻ
    wordInfo.ts              Tách từ, lemma, tần suất Zipf, CEFR, kiểm tra độ khó
    settingsService.ts       Cài đặt + API key mã hóa
    usageService.ts          Chi phí tháng này, dung lượng audio
    tts/                     TtsProvider (interface), KokoroProvider (main), ttsWorker (process riêng)
src/renderer/src/
  App.tsx                    Điều hướng giữa các trang
  pages/                     HomePage, LessonPage, ReviewPage, VocabPage, SettingsPage
  components/                LookupPanel, ScriptView, ProgressBox
  usePlayer.ts               Phát nối các câu, đổi tốc độ bằng playbackRate
```

### Luồng tạo một bài (đi qua những file nào)

```
HomePage "Tạo bài mới"
 → window.api.createLesson(topic)                     (preload)
 → ipc 'lessons:create'                               (ipc/handlers.ts)
 → lessonService.createLesson()
    1. selectGrammar() + selectReviewChunks()         chọn nội dung, KHÔNG gọi AI
    2. deepseek.callJson(prompt A, lessonSchema)      đúng 1 lần gọi (JSON lỗi → thử lại 1 lần)
    3. wordInfo.analyzeDifficulty()                   < 90% từ quen → prompt viết lại (tối đa 1 lần)
    4. saveLesson()                                   1 transaction: bài + câu + câu hỏi + thẻ từ vựng
    5. generateMissingAudio() → KokoroProvider → ttsWorker (mp3 từng câu)
 → các bước gửi tiến trình qua webContents.send('progress') → ProgressBox
```

Nếu tạo audio bị lỗi giữa chừng, nội dung bài vẫn được lưu (trạng thái "Thiếu audio"); mở bài sẽ có nút **"Tạo nốt audio"** (chỉ tạo câu còn thiếu, không tạo lại câu đã có).

### Database (SQLite, `src/main/db/migrations/001_init.sql`)

Theo gợi ý trong spec, có vài điểm tinh chỉnh:
- `grammar_points.description_en`: mô tả ngắn tiếng Anh của điểm ngữ pháp, gửi kèm prompt để AI hiểu đúng ý.
- `lessons.known_ratio`: lưu tỉ lệ từ quen sau bước kiểm tra độ khó (hiện ở đầu trang bài).
- `lessons.status`: `audio_pending` (chưa đủ audio) → `ready` → `done` (bấm "Hoàn thành bài").
- `lesson_chunks.sentence_idx`: câu chứa cụm, để tô màu cụm trong script.
- `word_cefr(word, level)`: danh sách CEFR nạp từ `resources/cefr-en.json`.
- `sentences.audio_path` / `vocab.example_audio_path` lưu đường dẫn **tương đối** so với thư mục `audio` (ví dụ `12/003.mp3`) để copy thư mục dữ liệu sang máy khác vẫn chạy.

Migration: `PRAGMA user_version` lưu số migration đã chạy. Muốn đổi DB: thêm file `002_xxx.sql`, import vào mảng `MIGRATIONS` trong `db/index.ts`.

### Audio
- Kokoro (`kokoro-js`, model `onnx-community/Kokoro-82M-v1.0-ONNX`, `dtype: "q8"`, `device: "cpu"`) trả về mẫu âm thanh 24 kHz → `@breezystack/lamejs` (encoder mp3 thuần JS, bản lamejs còn được bảo trì) → mp3 64 kbps mono (~20 KB/câu).
- File voice (`af_heart.bin`...) có sẵn trong package `kokoro-js`, chỉ model ONNX cần tải lần đầu.
- Renderer phát qua `app-audio://audio/<đường dẫn>`: protocol tự viết trong `main/index.ts`, chỉ cho đọc file `.mp3` bên trong thư mục audio (không cần tắt `webSecurity`).
- Giọng: A (và người kể N) = giọng A, B = giọng B, chọn trong Cài đặt (có giọng Mỹ và Anh–Anh, có nút nghe thử).

### Làm giàu bài học: ngữ pháp chi tiết + script kiểu Language Reactor — `src/main/services/enrichService.ts`

Sau khi lưu bài, app gọi thêm 2 loại prompt, **chạy song song với lúc tạo audio** (nên không làm chậm việc tạo bài):
- **Prompt G** (`prompts/grammarPrompt.ts`): bài ngữ pháp theo mẫu **British Council LearnEnglish** — câu hỏi mở đầu → ví dụ
  (lấy từ bài) → kiểm tra nhanh (trắc nghiệm) → giải thích ngắn có tiêu đề + bảng → lỗi hay gặp → mẹo nghe → kiểm tra lại;
  phần sâu hơn ẩn trong "Đọc thêm". Bản cũ (đoạn văn dài) tự được tạo lại khi mở bài.
- **Prompt N** (`prompts/annotatePrompt.ts`): chú thích script — dịch từng câu, nghĩa từng từ **theo ngữ cảnh**, và các cụm
  (cụm động từ kể cả bị tách như "picking it up", collocation, thành ngữ, câu nói cố định, cấu trúc). Script chia nhóm 10 câu,
  gọi song song.
- Kết quả lưu ở `lessons.grammar_deep_json` / `lessons.annotations_json` (migration `003`). Rê chuột trong script **không gọi API**.
- Bài cũ chưa có thì app tự tạo khi mở bài. Lỗi thì có nút "Thử lại"; bài vẫn dùng được với bản tóm tắt ngắn.
- Chi phí thực tế: khoảng $0.02 cho cả hai phần của một bài.

**Xóa bài** (nút "🗑 Xóa bài này" trên trang bài học): xóa script, câu hỏi, câu trả lời và toàn bộ audio của bài. Tùy chọn xóa luôn các
thẻ từ vựng **chỉ** có trong bài này; cụm xuất hiện ở bài khác được chuyển câu ngữ cảnh sang bài đó (vẫn có audio). Điểm ngữ pháp
của bài sẽ được dạy lại ở bài sau.

### Từ vựng thông minh — xem [docs/THIET_KE_TU_VUNG.md](docs/THIET_KE_TU_VUNG.md)

Thiết kế đúc kết từ Anki, LingQ, Language Reactor và nghiên cứu về trí nhớ (giãn cách, nhớ lại chủ động, "khó khăn có lợi",
đa dạng ngữ cảnh, độ phủ từ 95%). Code chính: `services/wordService.ts`, `services/leechService.ts`, `selectReviewChunks()`.
- **Trạng thái từng từ (kiểu LingQ)**: bảng `words` (migration `004`). Script tô xanh từ mới ít gặp, tô vàng từ đang học (đậm = còn yếu).
  Popup: "+ Học từ này" (lưu thẻ với nghĩa đúng trong câu, không gọi API) · "Đã biết" · "Bỏ qua". Hoàn thành bài → từ xanh không tra
  được đánh dấu "đã biết". Kiểm tra độ khó dùng danh sách này, và coi từ bạn đã tra ≥ 2 lần là từ lạ.
- **Tra lại = sắp quên**: tra một từ/cụm đang học → thẻ được đưa lên ôn ngay; tra từ "đã biết" → trở về "mới".
- **Từ hay quên (leech)**: thẻ quên ≥ 4 lần → nhãn "Từ hay quên", AI viết mẹo nhớ + phân biệt + 3 câu mới có audio; thẻ xoay vòng câu.
- **Đếm vốn từ theo "đơn vị nghĩa"** (`services/unitService.ts`, migration `005`): từ đơn và cụm cùng nghĩa chỉ tính 1.
  Bước 1 local: chuẩn hóa (dạng gốc, bỏ đại từ/mạo từ: "runs out" = "run out"). Bước 2 chỉ khi hai mục có chung từ mà khác khóa
  ("on it" / "get on it", "run" / "run out"): hỏi AI có cùng nghĩa không (prompt `unitPrompt.ts`, chạy nền theo nhóm, ~$0.0001/lần).
  Trang chủ hiện: số đơn vị nghĩa, "đang nhớ" (R ≥ 80% theo FSRS), "nhớ chắc" (ổn định ≥ 21 ngày); mỗi đơn vị lấy thẻ tốt nhất.
- **Thời gian nghe** (`services/listeningService.ts`): trình phát đo thời gian audio THẬT SỰ đang phát (bỏ khoảng nghỉ giữa câu),
  gửi về mỗi 15 giây; thống kê hôm nay, 7 ngày, tổng, chuỗi ngày liên tiếp (≥ 1 phút/ngày). Thu nhỏ cửa sổ vẫn nghe tiếp được.
- **Gặp lại trong bài nghe**: chọn cụm ôn theo điểm — xác suất còn nhớ R của FSRS trong vùng 70–92%, từ hay quên, số lần gặp ít,
  trừ điểm nếu vừa gặp trong 2 ngày.

### Ôn tập ngắt quãng (Giai đoạn 2) — `src/main/services/reviewService.ts`

Lịch ôn do thư viện **`ts-fsrs`** tính (thuật toán **FSRS-6**, cùng thuật toán Anki đang dùng). App không tự viết công thức, chỉ làm những việc Anki làm quanh thuật toán:

| Hành vi | Giống Anki ở chỗ |
|---|---|
| Mỗi từ có 2 thẻ: **nghe** (nghe câu, nhớ nghĩa) và **nói** (thấy nghĩa + câu tiếng Việt, nói to câu tiếng Anh) | Thẻ "anh em" (sibling) |
| Thẻ mới / thẻ quên đi qua **bước học** 1 phút → 10 phút (quên thẻ ôn: 10 phút) | Learning / relearning steps |
| Ưu tiên: thẻ đang học tới hạn → thẻ ôn tới hạn → thẻ mới → hết thì **học trước** thẻ đang học trong 20 phút tới | Thứ tự hàng đợi, "learn ahead limit" |
| **Ngày mới bắt đầu lúc 4 giờ sáng** | "Next day starts at" |
| Giới hạn **thẻ mới/ngày** (10) và **thẻ ôn/ngày** (100), chỉnh trong Cài đặt | Daily limits |
| **Mức nhớ mong muốn** 80–97% (mặc định 90%) | Desired retention |
| **Fuzz**: trộn ngẫu nhiên nhẹ khoảng cách để thẻ không dồn vào một ngày | Fuzz |
| Thẻ nói chỉ mở **từ ngày hôm sau** khi thẻ nghe đã ôn ≥ 1 lần; 2 thẻ của cùng một từ không đứng liền nhau | Bury siblings |
| **Hoàn tác** (Ctrl+Z) dùng `rollback` của ts-fsrs | Undo |
| Phím: cách = hiện đáp án (đã hiện thì = "Được"), 1–4 = Quên/Khó/Được/Dễ, R = nghe lại | Phím tắt |

- Bảng `review_cards` / `review_logs` (migration `002_review.sql`): tên cột theo kiểu `Card` / `ReviewLog` của ts-fsrs, thời gian lưu dạng mili-giây. Có thêm `learning_steps` (ts-fsrs v5 cần) và `last_elapsed_days` (để hoàn tác). Lịch sử đầy đủ để sau này tối ưu tham số FSRS.
- Thẻ được tạo tự động bằng **trigger** khi thêm từ vào `vocab`; migration tạo thẻ cho toàn bộ vocab từ Giai đoạn 1.
- `vocab.status`: chưa ôn = `new`; thẻ nghe **và** thẻ nói đều có stability ≥ 21 ngày = `known`; còn lại `learning`. Bước kiểm tra độ khó (5.3) coi từ `known`/`learning` là từ quen.
- Bài nghe mới ưu tiên lồng các cụm **sắp tới hạn** (3 ngày tới) hoặc **hay quên** (lapses cao) — `selectReviewChunks()` trong `lessonService.ts`.
- Ôn tập chạy **offline hoàn toàn**, không gọi API.

## 5. Phần nào cần hiểu kỹ, phần nào chỉ cần biết nó làm gì

### ⭐ Lõi — nên đọc kỹ
| File | Vì sao quan trọng |
|---|---|
| `src/main/services/lessonService.ts` | Logic chọn điểm ngữ pháp (bài thứ 4 là bài ôn, điểm mở rộng tối đa 1/5 bài), chọn cụm ôn, quy trình tạo bài, transaction lưu bài + thẻ |
| `src/main/prompts/*.ts` | "Bộ não" của app. System prompt cố định ở đầu, dữ liệu thay đổi ở user message cuối → tận dụng cache prefix của DeepSeek |
| `src/main/services/deepseek.ts` | Cách gọi API: JSON mode, tắt thinking, thử lại, xử lý lỗi, ghi chi phí |
| `src/main/services/wordInfo.ts` | Kiểm tra độ khó: tách từ + lemma (compromise), tần suất Zipf, ngưỡng theo level |
| `src/main/db/` + `migrations/001_init.sql` | Cấu trúc dữ liệu |
| `src/shared/types.ts`, `src/preload/index.ts`, `src/main/ipc/handlers.ts` | Hợp đồng IPC giữa giao diện và main |
| `src/main/services/lookupService.ts`, `gradingService.ts` | Tra từ có cache, lưu thẻ không trùng; chấm bài 1 lần gọi |
| `src/main/services/reviewService.ts` | Chọn thẻ ôn tiếp theo, giới hạn mỗi ngày, gọi ts-fsrs để chấm / hoàn tác |

### Chỉ cần biết nó làm gì
| File | Làm gì |
|---|---|
| `src/renderer/**` | Giao diện React + CSS (dark mode theo Windows) |
| `src/main/services/tts/*` | Chạy Kokoro trong process riêng, tạo mp3 |
| `src/main/index.ts` | Tạo cửa sổ, protocol audio |
| `electron.vite.config.ts`, `electron-builder.yml`, `tsconfig*.json` | Cấu hình build và đóng gói |
| `config.ts` | Các con số chỉnh được (ngưỡng tần suất, giá, chủ đề, giọng) |

### Một số khác biệt TypeScript/Electron so với C#
- `interface` / `type` chỉ tồn tại lúc biên dịch (không có reflection như C#). Vì vậy dữ liệu từ AI phải kiểm tra bằng **zod** lúc chạy (giống FluentValidation).
- `async/await` + `Promise<T>` ≈ `async/await` + `Task<T>`.
- `better-sqlite3` là API **đồng bộ** (không cần `await`), `db.transaction(fn)` ≈ `TransactionScope`.
- Kiểu union `'full' | 'partial' | 'none'` ≈ một enum nhỏ; `IpcResult<T>` ≈ kiểu `Result<T>`.

## 6. Ghi chú về API DeepSeek (đã kiểm tra docs tháng 10/2026)

- Base URL `https://api.deepseek.com`, endpoint `/chat/completions` (định dạng OpenAI), gọi bằng `fetch`.
- Model mặc định `deepseek-flash` (đổi được trong Cài đặt).
- JSON output: `response_format: { type: "json_object" }`, prompt có chữ "json" và ví dụ.
- Tắt thinking: `thinking: { type: "disabled" }` (model mặc định bật thinking; khi bật thì `temperature` không có tác dụng).
- Temperature: tạo bài 0.8, chấm 0.2, tra từ 0.3. Chi phí ước tính theo giá giờ cao điểm (`config.ts`), xem ở trang Cài đặt.
- Chi phí thực tế khi thử: tạo 1 bài ≈ $0.003, chấm ≈ $0.0005, tra 1 từ ≈ $0.0004.

## 7. Nguồn dữ liệu và giấy phép

| Dữ liệu | Nguồn | Giấy phép |
|---|---|---|
| Tần suất từ (`resources/wordfreq-en.json`, ~98 000 từ, thang Zipf) | [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1 của Robyn Speer — gộp nhiều nguồn trong đó có phụ đề phim (SUBTLEX, OpenSubtitles) | Code Apache-2.0, **dữ liệu CC-BY-SA 4.0** (ghi nguồn, chia sẻ cùng giấy phép) |
| CEFR A1–B2 | [CEFR-J Wordlist 1.5](https://github.com/openlanguageprofiles/olp-en-cefrj) — Tono Laboratory, Tokyo University of Foreign Studies | Dùng miễn phí cho nghiên cứu và thương mại, yêu cầu trích dẫn |
| CEFR C1–C2 | Octanove Vocabulary Profile 1.0 (cùng repo trên) | CC-BY-SA 4.0 |
| Giọng đọc | [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) qua `kokoro-js` | Apache-2.0 |

Trích dẫn CEFR-J: *The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from http://www.cefr-j.org/download.html*.

Tạo lại dữ liệu: `pip install wordfreq` rồi `python scripts/build_wordlists.py cefrj-vocabulary-profile-1.5.csv octanove-vocabulary-profile-c1c2-1.0.csv`.

Nhãn tần suất: Zipf ≥ 5 "Rất phổ biến", ≥ 4 "Phổ biến", ≥ 3 "Ít gặp", còn lại "Hiếm". Với cụm từ, lấy theo từ ít gặp nhất trong cụm. AI không được đoán tần suất.

## 8. Thư viện chính
Electron 42, electron-vite, React 19, better-sqlite3 12, zod 4, compromise 14 (lemma), kokoro-js, @huggingface/transformers, @breezystack/lamejs, electron-builder. ts-fsrs 5 (FSRS-6).
