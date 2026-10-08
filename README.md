# 🎧 Luyện Nghe — app luyện nghe hiểu tiếng Anh cho người Việt

App máy tính (Windows) giúp bạn **luyện nghe hiểu ý** tiếng Anh bằng những bài nghe **vừa đúng trình độ của bạn**.
Mỗi bài do AI viết riêng cho bạn, được đọc bằng giọng đọc tự nhiên chạy ngay trên máy, kèm câu hỏi hiểu ý,
một điểm ngữ pháp, tra từ theo ngữ cảnh và thẻ ôn từ vựng kiểu Anki.

- [App giải quyết vấn đề gì?](#-app-giải-quyết-vấn-đề-gì)
- [Cần chuẩn bị gì?](#-cần-chuẩn-bị-gì)
- [Cách 1 — Cài bằng file cài đặt (dễ nhất)](#-cách-1--cài-bằng-file-cài-đặt-dễ-nhất)
- [Cách 2 — Chạy từ mã nguồn](#-cách-2--chạy-từ-mã-nguồn)
- [Lần đầu mở app](#-lần-đầu-mở-app)
- [Một buổi học diễn ra thế nào](#-một-buổi-học-diễn-ra-thế-nào)
- [Phương pháp và cơ sở khoa học](#-phương-pháp-và-cơ-sở-khoa-học)
- [Dữ liệu, sao lưu và quyền riêng tư](#-dữ-liệu-sao-lưu-và-quyền-riêng-tư)
- [Gặp lỗi thì làm gì?](#-gặp-lỗi-thì-làm-gì)
- [Nguồn dữ liệu và giấy phép](#-nguồn-dữ-liệu-và-giấy-phép)
- [Dành cho lập trình viên](#-dành-cho-lập-trình-viên)

---

## 🎯 App giải quyết vấn đề gì?

Rất nhiều người học tiếng Anh ở Việt Nam bị **"kẹt" ở trình độ B1**: đọc hiểu được, nhưng nghe người bản xứ nói thì không theo kịp.
Nguyên nhân thường gặp:

| Vấn đề | Vì sao khó |
|---|---|
| **Tài liệu nghe không vừa sức** | Podcast, phim, YouTube thường quá khó (quá nhiều từ lạ → chỉ nghe được "chữ được chữ mất"), còn bài trong giáo trình thì quá dễ hoặc quá ít. |
| **Học từ vựng rời rạc** | Học thuộc danh sách từ đơn lẻ, không có câu, không có âm thanh → gặp trong bài nghe vẫn không nhận ra. |
| **Học xong là quên** | Không có lịch ôn lại, từ mới học tuần trước tuần sau đã quên. |
| **Ngữ pháp học thuộc công thức** | Biết công thức nhưng khi nghe không hiểu *người nói muốn nói gì*. |
| **Luyện nghe kiểu chép chính tả** | Soi từng chữ làm mất thói quen nghe để nắm ý — kỹ năng quan trọng nhất khi nghe thật. |

**Luyện Nghe** giải quyết bằng cách:

1. **Tạo bài nghe vô hạn, đúng trình độ.** AI (DeepSeek) viết hội thoại 2–3 phút theo chủ đề bạn chọn. App tự **đếm xem bạn biết bao nhiêu % từ** trong bài; nếu dưới 90% thì nhờ AI viết lại câu khó cho dễ hơn.
2. **Nghe để hiểu ý, không chép chính tả.** Bạn nghe khi script bị ẩn, trả lời câu hỏi (tiếng Việt hay tiếng Anh đều được), AI chấm theo **ý** chứ không bắt lỗi chính tả.
3. **Học cụm từ trong ngữ cảnh.** Mỗi bài có 3–5 cụm từ thông dụng (phrasal verb, collocation, câu nói sẵn). Các cụm này **tự động thành thẻ ôn**, kèm đúng câu và audio trong bài.
4. **Ôn đúng lúc sắp quên.** Lịch ôn dùng thuật toán **FSRS** (giống Anki). Từ sắp quên còn được **lồng lại vào bài nghe mới**, để bạn gặp lại nó trong ngữ cảnh khác.
5. **Ngữ pháp theo nghĩa.** Mỗi bài dạy **đúng một** điểm ngữ pháp (34 điểm từ B1 lên B2), giải thích bằng tiếng Việt đời thường: *người nói muốn diễn đạt điều gì*, khác tiếng Việt chỗ nào.

App phù hợp nhất với người **khoảng A2–B2**, muốn lên B2 / TOEIC 600–800+.

---

## 🧰 Cần chuẩn bị gì?

| Thứ cần có | Ghi chú |
|---|---|
| **Máy tính Windows 10 hoặc 11, 64-bit** | Hiện app chỉ có bản cho Windows. RAM nên từ 8 GB (tối thiểu 4 GB). |
| **Ổ đĩa trống khoảng 1 GB** | App ~500 MB + giọng đọc ~90 MB + audio các bài học (mỗi bài khoảng 1 MB). |
| **Kết nối Internet** | Cần khi tạo bài mới, chấm bài, tra từ mới, và lần đầu tải giọng đọc. **Ôn tập và nghe lại bài cũ chạy được khi mất mạng.** |
| **Tài khoản DeepSeek + API key** | AI dùng để viết bài. Phải **nạp tiền trước** (vài USD dùng được rất lâu, xem bảng chi phí bên dưới). |
| Loa hoặc tai nghe | 🙂 |

### Lấy API key DeepSeek (làm 1 lần)

1. Vào [platform.deepseek.com](https://platform.deepseek.com) → đăng ký / đăng nhập.
2. Vào mục **Top up** (nạp tiền) và nạp một ít (ví dụ 2 USD).
3. Vào mục **API keys** → **Create new API key** → copy chuỗi bắt đầu bằng `sk-...`.
4. Giữ key này kín đáo (ai có key là dùng được tiền của bạn). Bạn sẽ dán nó vào app ở bước sau.

### Chi phí ước tính

| Việc | Khoảng tiền |
|---|---|
| Tạo 1 bài nghe đầy đủ (bài + giải thích ngữ pháp + chú thích từng câu) | ~0,025 USD |
| Chấm câu trả lời của 1 bài | ~0,0005 USD |
| Tra 1 từ mới (từ đã tra rồi thì **miễn phí**) | ~0,0004 USD |
| Giọng đọc, ôn tập, nghe lại bài cũ | **Miễn phí** (chạy trên máy) |

→ Với **2 USD** bạn tạo được khoảng **70–80 bài**. Trang **Cài đặt** trong app hiện chi phí đã dùng trong tháng.

---

## 📦 Cách 1 — Cài bằng file cài đặt (dễ nhất)

Không cần cài thêm gì, phù hợp với người không rành máy tính.

1. Vào trang [**Releases**](https://github.com/dung4822/AppHocTiengAnh/releases/latest) của dự án.
2. Ở mục **Assets**, tải file **`LuyenNghe-Setup-x.y.z.exe`** (khoảng 155 MB).
3. Mở file vừa tải.
   - Windows có thể hiện màn hình xanh **"Windows protected your PC"** vì app chưa mua chữ ký số.
     Bấm **More info** (Thông tin thêm) → **Run anyway** (Vẫn chạy).
4. Chọn thư mục cài đặt (có thể chọn ổ D: cho đỡ đầy ổ C:) → **Install**.
5. Mở app **Luyen Nghe** từ màn hình Desktop hoặc menu Start, rồi làm tiếp phần [Lần đầu mở app](#-lần-đầu-mở-app).

> Nếu trang Releases chưa có file cài đặt, hãy dùng **Cách 2** bên dưới.

**Gỡ cài đặt:** Settings → Apps → tìm **Luyen Nghe** → Uninstall. Dữ liệu học của bạn vẫn được giữ lại (xem [mục dữ liệu](#-dữ-liệu-sao-lưu-và-quyền-riêng-tư)).

---

## 💻 Cách 2 — Chạy từ mã nguồn

Dành cho người muốn xem / sửa code, hoặc khi chưa có file cài đặt.

### Bước 1. Cài phần mềm cần thiết

| Phần mềm | Phiên bản | Tải ở đâu |
|---|---|---|
| **Node.js** | **24 LTS** (tối thiểu 22.12). ⚠️ Node 20 trở xuống **không chạy được**. | [nodejs.org](https://nodejs.org) → bản **LTS** → cài với tùy chọn mặc định |
| **Git** (không bắt buộc) | bản mới nhất | [git-scm.com](https://git-scm.com/download/win). Không muốn cài Git thì tải code dạng ZIP (xem bước 2). |

**Không cần** cài Visual Studio, Python hay ffmpeg.

Kiểm tra đã cài đúng chưa: mở **PowerShell** (bấm phím Windows, gõ `PowerShell`, Enter) và chạy:

```bash
node -v
```

Kết quả phải từ `v22.12.0` trở lên (ví dụ `v24.11.0`). Nếu máy đang có Node cũ hơn, cứ tải bản LTS ở nodejs.org cài đè lên, rồi **đóng PowerShell, mở lại** và kiểm tra lại.

### Bước 2. Tải mã nguồn

**Có Git:**

```bash
git clone https://github.com/dung4822/AppHocTiengAnh.git
```

```bash
cd AppHocTiengAnh
```

**Không có Git:** trên trang GitHub của dự án bấm nút xanh **Code** → **Download ZIP** → giải nén → mở thư mục vừa giải nén,
bấm vào thanh địa chỉ của File Explorer, gõ `powershell` rồi Enter để mở PowerShell ngay tại thư mục đó.

### Bước 3. Cài thư viện (chỉ làm 1 lần, mất vài phút)

```bash
npm install
```

Lệnh này tải các thư viện cần thiết (~1 GB) vào thư mục `node_modules`. Cần có mạng.
Khi chạy xong sẽ hiện dòng `added ... packages`. Các dòng cảnh báo `vulnerabilities` / `npm fund` là bình thường, không ảnh hưởng gì.

### Bước 4. Chạy app

```bash
npm run dev
```

Lần chạy đầu tiên sẽ hiện `Downloading Electron binary...` và mất thêm 1–2 phút để tải phần chạy của app (~100 MB), các lần sau mở ngay.
Cửa sổ app sẽ hiện lên. Muốn tắt app thì đóng cửa sổ, hoặc bấm `Ctrl + C` trong PowerShell.
Lần sau chỉ cần mở PowerShell trong thư mục dự án và chạy lại `npm run dev`.

> ✅ **Không cần cài hay tạo database.** Lần đầu mở, app tự tạo file SQLite, tự tạo bảng và tự nạp sẵn danh sách ngữ pháp, từ vựng CEFR.
> Cũng không cần file `.env` hay cấu hình gì thêm — API key nhập ngay trong app.

### (Tùy chọn) Tự đóng gói ra file cài đặt

```bash
npm run dist
```

File cài đặt sẽ nằm trong thư mục `dist\` (ví dụ `dist\LuyenNghe-Setup-1.0.0.exe`). Cài như **Cách 1**.

---

## 🚀 Lần đầu mở app

1. App tự mở trang **Cài đặt**. Dán **API key DeepSeek** (`sk-...`) vào ô API key → **Lưu và bắt đầu**.
   Key được mã hóa và chỉ lưu trên máy bạn.
2. Chọn **trình độ** của bạn (A2 / B1 / B2 / C1). Không chắc thì để **B1**.
3. (Tùy chọn) Chọn 2 giọng đọc cho người nói A và B — có giọng Mỹ và giọng Anh, bấm **Nghe thử** để nghe.
4. Về **Trang chủ** → chọn chủ đề (hoặc để ngẫu nhiên, hoặc tự gõ chủ đề như *"hỏi đường ở sân bay"*) → **Tạo bài mới**.
5. **Lần đầu tạo bài sẽ lâu hơn (~3 phút)** vì app tải giọng đọc (~90 MB). Các lần sau khoảng 1–2 phút và giọng đọc chạy offline.

---

## 📖 Một buổi học diễn ra thế nào

Trang chủ gợi ý thứ tự: **1 · Ôn tập** → **2 · Học tiếp bài dở** → **3 · Tạo bài mới**.

**Mỗi bài nghe gồm 5 bước:**

| Bước | Bạn làm gì | Mẹo |
|---|---|---|
| **1. Nghe hiểu ý** | Nghe cả bài 1–2 lần, **script bị ẩn**. Chỉnh tốc độ 0.75× – 1.1×. | Đoán ý từ ngữ cảnh, đừng dừng lại ở từ không hiểu. |
| **2. Trả lời** | 4–5 câu hỏi: ý chính, chi tiết, suy luận, ý nghĩa ngữ pháp, ý kiến của bạn. | Trả lời tiếng Việt hay tiếng Anh đều được. |
| **3. Kết quả** | AI chấm theo ý, nhận xét bằng tiếng Việt, gợi ý cách nói tự nhiên hơn. Nút **Nghe đoạn chứa đáp án**. | Câu sai → nghe lại đoạn chứa đáp án trước khi xem script. |
| **4. Script** | Đọc script, bấm câu để nghe lại, **rê chuột vào từ** để xem nghĩa đúng trong câu và bản dịch. Từ **xanh** = từ mới ít gặp, từ **vàng** = từ đang học. | Bấm **+ Học từ này** để thêm thẻ ôn. |
| **5. Ngữ pháp** | Bài ngữ pháp ngắn: câu hỏi mở đầu → ví dụ lấy từ bài → kiểm tra nhanh → giải thích → lỗi hay gặp → mẹo nghe. | Bấm **Hoàn thành bài** khi xong — các từ bạn không tra sẽ được tính là "đã biết". |

**Ôn tập** (không cần mạng): mỗi từ có 2 thẻ.
- **Thẻ nghe:** nghe câu (không hiện chữ) → nhớ nghĩa → hiện đáp án.
- **Thẻ nói:** thấy nghĩa tiếng Việt → **nói to** câu tiếng Anh → hiện đáp án và nghe để so.
- Tự chấm: **1 Quên · 2 Khó · 3 Được · 4 Dễ**. Phím **cách** = hiện đáp án, **R** = nghe lại, **Ctrl+Z** = hoàn tác.

Các trang khác: **Từ vựng** (lưới thẻ, tìm kiếm, lọc, tạm ẩn / xóa), **Cài đặt** (key, trình độ, giọng, số thẻ mới mỗi ngày, mức nhớ mong muốn, chi phí, thư mục dữ liệu).

---

## 🔬 Phương pháp và cơ sở khoa học

Mỗi tính năng của app dựa trên một kết quả nghiên cứu về học ngôn ngữ và trí nhớ:

| Nguyên lý | Nghiên cứu | App áp dụng thế nào |
|---|---|---|
| **Đầu vào dễ hiểu** — tiến bộ nhanh nhất khi nghe/đọc thứ *hơi khó hơn* trình độ một chút ("i+1") | Krashen (1985) | AI viết bài theo trình độ bạn chọn; mỗi bài chỉ 3–5 cụm mới. |
| **Độ phủ từ vựng** — cần biết khoảng **95%** từ trong bài nghe để hiểu tốt | van Zeeland & Schmitt (2013); Nation (2006) | Sau khi AI viết bài, app tự đếm % từ bạn đã biết (dựa trên tần suất từ + danh sách từ của chính bạn). Dưới 90% → AI viết lại câu khó. |
| **Nghe theo quy trình** — nghe ý chính trước, chi tiết sau, rồi mới xem script | Vandergrift & Goh (2012) | 5 bước: nghe khi ẩn script → trả lời → xem đáp án → script → ngữ pháp. **Không có chép chính tả.** |
| **Học theo cụm từ** — người bản xứ nói bằng các cụm có sẵn, không ghép từng từ | Lewis (1993); Martinez & Schmitt (2012) | Ưu tiên phrasal verb, collocation, câu nói sẵn; tra từ nhận ra cả cụm bị tách ("pick **it** up"). |
| **Ngữ pháp theo nghĩa** — chú ý tới hình thức ngay trong lúc hiểu nghĩa hiệu quả hơn học công thức rời | Long (1991) — *focus on form* | Mỗi bài đúng 1 điểm ngữ pháp, dùng tự nhiên 2–3 lần trong bài; câu hỏi riêng hỏi *người nói muốn nói gì*. Cứ 4 bài có 1 bài ôn ngữ pháp cũ. |
| **Bốn mạch cân bằng** — đầu vào có nghĩa, học có chủ đích, đầu ra, luyện trôi chảy | Nation (2007) | Nghe hiểu (đầu vào) + ngữ pháp / tra từ (học có chủ đích) + thẻ nói (đầu ra). |
| **Ôn giãn cách** — ôn rải ra theo thời gian nhớ lâu hơn ôn dồn | Cepeda và cộng sự (2006) | Lịch ôn tự động bằng thuật toán FSRS. |
| **Nhớ lại chủ động** — tự nhớ lại hiệu quả hơn đọc lại | Karpicke & Roediger (2008) | Thẻ nghe / thẻ nói bắt bạn nhớ trước rồi mới hiện đáp án. |
| **Thuật toán FSRS** — mô hình trí nhớ dự đoán xác suất bạn còn nhớ một thẻ | Ye, Su & Cao (2022) | Dùng thư viện `ts-fsrs` (FSRS-6, cùng thuật toán Anki đang dùng). |
| **Khó khăn có lợi** — ôn lúc *sắp quên* giúp nhớ lâu nhất | Bjork (1994) | Từ có xác suất còn nhớ 70–92% được ưu tiên lồng vào bài nghe mới. |
| **Gặp lại nhiều lần** — học từ qua nghe tăng theo số lần gặp | Uchihara, Webb & Yanagisawa (2019) | App đếm số lần bạn gặp mỗi từ, ưu tiên từ mới gặp ít lần. Từ quên ≥ 4 lần được AI viết mẹo nhớ + 3 câu mới. |

Ý tưởng giao diện học từ các app phổ biến: **Anki** (lịch ôn, thẻ hay quên), **LingQ** (tô màu từ theo trạng thái, "không tra = đã biết"),
**Language Reactor** (rê chuột xem nghĩa theo ngữ cảnh), **British Council LearnEnglish** (cách trình bày bài ngữ pháp).
Chi tiết thiết kế phần từ vựng: [docs/THIET_KE_TU_VUNG.md](docs/THIET_KE_TU_VUNG.md).

### Tài liệu tham khảo

- Bjork, R. A. (1994). Memory and metamemory considerations in the training of human beings. In J. Metcalfe & A. Shimamura (Eds.), *Metacognition: Knowing about knowing*. MIT Press.
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin, 132*(3), 354–380.
- Karpicke, J. D., & Roediger, H. L. (2008). The critical importance of retrieval for learning. *Science, 319*(5865), 966–968.
- Krashen, S. (1985). *The Input Hypothesis: Issues and Implications*. Longman.
- Lewis, M. (1993). *The Lexical Approach*. Language Teaching Publications.
- Long, M. H. (1991). Focus on form: A design feature in language teaching methodology. In K. de Bot, R. Ginsberg & C. Kramsch (Eds.), *Foreign Language Research in Cross-Cultural Perspective*. John Benjamins.
- Martinez, R., & Schmitt, N. (2012). A phrasal expressions list. *Applied Linguistics, 33*(3), 299–320.
- Nation, I. S. P. (2006). How large a vocabulary is needed for reading and listening? *Canadian Modern Language Review, 63*(1), 59–82.
- Nation, I. S. P. (2007). The four strands. *Innovation in Language Learning and Teaching, 1*(1), 2–13.
- Uchihara, T., Webb, S., & Yanagisawa, A. (2019). The effects of repetition on incidental vocabulary learning: A meta-analysis of correlational studies. *Language Learning, 69*(3), 559–599.
- van Zeeland, H., & Schmitt, N. (2013). Lexical coverage in L1 and L2 listening comprehension: The same or different from reading comprehension? *Applied Linguistics, 34*(4), 457–479.
- Vandergrift, L., & Goh, C. C. M. (2012). *Teaching and Learning Second Language Listening: Metacognition in Action*. Routledge.
- Ye, J., Su, J., & Cao, Y. (2022). A stochastic shortest path algorithm for optimizing spaced repetition scheduling. *Proceedings of KDD '22*, 4381–4390.

---

## 💾 Dữ liệu, sao lưu và quyền riêng tư

- **Mọi dữ liệu nằm trên máy bạn**, không có tài khoản, không đồng bộ lên mạng. Thứ duy nhất gửi ra ngoài là nội dung gửi cho DeepSeek để viết bài / chấm bài / tra từ.
- Thư mục dữ liệu mặc định: `%APPDATA%\Luyen Nghe` (gõ dòng này vào thanh địa chỉ File Explorer rồi Enter). Bên trong:
  - `app.db` — bài học, câu trả lời, thẻ từ vựng, lịch ôn, cài đặt.
  - `audio\` — file mp3 của các bài.
  - `models\` — giọng đọc đã tải (xóa được, app sẽ tự tải lại).
- **Ổ C: sắp đầy?** Vào **Cài đặt → Chuyển dữ liệu sang ổ khác...**, chọn thư mục (ví dụ trên ổ D:). App tự chép dữ liệu sang và khởi động lại.
- **Sao lưu:** tắt app, copy **cả thư mục dữ liệu** sang chỗ khác. Khôi phục: chép đè lại. Trang Cài đặt có nút **Mở thư mục dữ liệu**.
- **API key** được mã hóa bằng cơ chế bảo vệ của Windows, chỉ giải mã được trên đúng máy và tài khoản Windows đó.
  Chuyển sang máy khác thì nhập lại key.

---

## 🛠 Gặp lỗi thì làm gì?

| Hiện tượng | Cách xử lý |
|---|---|
| `npm install` báo `EBADENGINE` / `Unsupported engine` (hoặc lỗi `Visual Studio`, `node-gyp`, `better-sqlite3`) | Node quá cũ. Chạy `node -v`; nếu dưới v22.12 thì cài lại Node.js bản **LTS** mới nhất, **mở PowerShell mới** rồi chạy lại `npm install`. |
| `'npm' is not recognized...` | Chưa cài Node.js hoặc chưa mở lại PowerShell sau khi cài. |
| Windows chặn file cài đặt ("Windows protected your PC") | Bấm **More info → Run anyway**. App chưa có chữ ký số nên Windows cảnh báo. |
| Tạo bài báo lỗi về **API key / số dư / 401 / 402** | Kiểm tra lại key trong **Cài đặt** và số dư trên platform.deepseek.com. |
| Tải giọng đọc thất bại | Kiểm tra mạng rồi bấm thử lại. Chỉ cần tải thành công 1 lần. |
| Bài hiện **"Thiếu audio"** | Mở bài, bấm **Tạo nốt audio** (chỉ tạo phần còn thiếu). |
| Bài quá khó / quá dễ | Đổi **trình độ** trong Cài đặt. |

Vẫn không được? Hãy tạo [Issue](https://github.com/dung4822/AppHocTiengAnh/issues) kèm ảnh chụp lỗi.

---

## 📚 Nguồn dữ liệu và giấy phép

| Dữ liệu | Nguồn | Giấy phép |
|---|---|---|
| Tần suất từ (~98 000 từ, thang Zipf) | [wordfreq](https://github.com/rspeer/wordfreq) 3.1.1 — Robyn Speer (gộp nhiều nguồn, có phụ đề phim SUBTLEX, OpenSubtitles) | Code Apache-2.0, dữ liệu **CC-BY-SA 4.0** |
| Trình độ CEFR A1–B2 | [CEFR-J Wordlist 1.5](https://github.com/openlanguageprofiles/olp-en-cefrj) — Tono Laboratory, Tokyo University of Foreign Studies | Miễn phí cho nghiên cứu và thương mại, yêu cầu trích dẫn |
| Trình độ CEFR C1–C2 | Octanove Vocabulary Profile 1.0 (cùng repo trên) | CC-BY-SA 4.0 |
| Giọng đọc | [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) qua thư viện `kokoro-js` | Apache-2.0 |
| Lịch ôn | [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (FSRS-6) | MIT |
| AI viết bài | [DeepSeek API](https://api-docs.deepseek.com) | Theo điều khoản của DeepSeek |

Trích dẫn CEFR-J: *The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies. Retrieved from http://www.cefr-j.org/download.html*.

---

## 👩‍💻 Dành cho lập trình viên

Viết bằng **Electron + TypeScript + React**, SQLite (`better-sqlite3`), Tailwind CSS.

| Lệnh | Làm gì |
|---|---|
| `npm run dev` | Chạy app ở chế độ phát triển (tự tải lại khi sửa code) |
| `npm run typecheck` | Kiểm tra kiểu TypeScript |
| `npm run build` | Build code ra thư mục `out/` |
| `npm run dist` | Build + đóng gói file cài đặt Windows vào `dist/` |

Kiến trúc, luồng tạo bài, database, prompt và các file lõi cần đọc: **[docs/KIEN_TRUC.md](docs/KIEN_TRUC.md)**.
Đặc tả ban đầu của dự án: [SPEC.md](SPEC.md).
