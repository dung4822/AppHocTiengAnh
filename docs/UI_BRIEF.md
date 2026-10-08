# UI/UX BRIEF — App "Luyện Nghe" (desktop luyện nghe hiểu tiếng Anh)

> Tài liệu này mô tả **toàn bộ chức năng hiện có** của app để thiết kế lại giao diện.
> Chức năng và dữ liệu đã chạy ổn — chỉ cần **thiết kế lại giao diện + trải nghiệm**, không thêm/bớt chức năng.
> Hãy tạo mockup cho **mọi màn hình và mọi trạng thái** liệt kê ở mục 9 ("Danh sách ảnh cần vẽ").

---

## 1. Sản phẩm và người dùng

- **Là gì:** app desktop cá nhân (Windows, Electron) giúp người Việt trình độ B1 → B2 (mục tiêu TOEIC 700+) **luyện nghe hiểu ý** qua các bài nghe do AI viết đúng trình độ, đọc bằng giọng đọc offline. Mỗi bài kèm câu hỏi hiểu ý, đúng **một điểm ngữ pháp**, và các cụm từ thông dụng tự thành thẻ ôn tập kiểu Anki.
- **Người dùng:** 1 người (chủ app), lập trình viên, học buổi tối / lúc rảnh, ngồi máy tính (laptop). Thích cảm giác **chuyên nghiệp, tập trung, ít rối**.
- **Nguyên tắc học (phải thể hiện qua giao diện):**
  - Nghe để hiểu **ý**, không soi từng chữ → lúc nghe **script bị ẩn**.
  - Bài vừa sức (~95% từ đã biết), ưu tiên **cụm từ** thông dụng.
  - Giải thích bằng tiếng Việt đời thường.
  - Gặp lại từ đúng lúc sắp quên (thuật toán FSRS như Anki).
- **Ngôn ngữ giao diện:** tiếng Việt. Nội dung học (script, ví dụ) là tiếng Anh → cần typography đọc tiếng Anh dài thoải mái.

## 2. Ràng buộc nền tảng

- Cửa sổ desktop: mặc định **1200×820**, tối thiểu **900×600**, có thể phóng to toàn màn hình.
- **Light + Dark mode** theo hệ thống Windows (cần vẽ cả hai cho các màn chính).
- Có **phím tắt** (xem trang Ôn tập) → giao diện nên gợi ý phím.
- Âm thanh là trung tâm: luôn có trình phát (phát cả bài, phát từng câu, tốc độ 0.75 / 0.9 / 1.0 / 1.1).
- Một số tác vụ chạy lâu có tiến trình (tạo bài ~2–3 phút, tải model giọng đọc lần đầu ~92 MB) → cần thiết kế trạng thái chờ đẹp, không đơ.
- Thông báo lỗi bằng tiếng Việt dễ hiểu (mất mạng, hết tiền DeepSeek, key sai, AI trả dữ liệu lỗi) — không bao giờ crash.

## 3. Điều hướng (hiện tại)

Thanh trên cùng: logo "🎧 Luyện Nghe" + 4 mục: **Trang chủ · Ôn tập · Từ vựng · Cài đặt**.
Trang **Bài học** mở từ danh sách bài (không có trên thanh điều hướng).
Lần đầu mở app khi chưa có API key → tự vào **Cài đặt** với lời chào.

---

## 4. Các màn hình và chức năng

### 4.1 Trang chủ

| Khối | Nội dung / hành động |
|---|---|
| **Ôn tập hôm nay** | Số thẻ cần ôn hôm nay (mới + đang học + tới hạn). Nút **"Ôn tập"** (vô hiệu khi = 0). |
| **Tạo bài mới** | Dropdown chủ đề: "🎲 Chủ đề ngẫu nhiên" + 10 chủ đề (Đời sống hằng ngày, Công việc lập trình viên junior, Phỏng vấn xin việc, Văn phòng TOEIC: cuộc họp / khách hàng / email & lịch hẹn / giao hàng, Du lịch, Sức khỏe, Mua sắm). Ô "hoặc tự nhập chủ đề...". Nút **"Tạo bài mới"**. Khi đang tạo: hiển thị **tiến trình theo giai đoạn** (xem 5.1). Lỗi hiện dưới khối. |
| **Tra nhanh** | Ô nhập từ/cụm tiếng Anh + nút "Tra" → mở **panel tra từ** bên phải (xem 4.7). |
| **Chỉ số nhanh** | Tiến độ ngữ pháp: "x/34 điểm ngữ pháp core đã học" + thanh tiến độ · Số bài nghe · Thời gian nghe hôm nay. |
| **Thời gian nghe** | Hôm nay · Chuỗi ngày liên tiếp (≥1 phút/ngày) · Tổng cộng · **Biểu đồ cột 7 ngày** · Tách "Bài nghe x phút · Ôn tập y phút". Chỉ tính lúc audio đang phát. Dưới 1 phút hiện "19 giây". |
| **Vốn từ đã học** | Số **đơn vị nghĩa** (từ/cụm cùng nghĩa chỉ tính 1) · **Đang nhớ** (khả năng nhớ ≥ 80%) · **Nhớ chắc** (nhớ ≥ 3 tuần) · "N thẻ → M đơn vị" · số **từ đã biết sẵn** · số **từ hay quên**. |
| **Các bài đã tạo** | Danh sách (mới nhất trên cùng). Mỗi dòng: tiêu đề bài, ngày giờ · chủ đề · điểm ngữ pháp (+ "(ôn)" nếu là bài ôn), **nhãn trạng thái**: "Thiếu audio" (cam) / "Chưa học xong" (xanh) / "Đã học" (xanh lá). Bấm → mở bài. Trạng thái rỗng: "Chưa có bài nào...". |

### 4.2 Trang Bài học (trọng tâm của app)

**Đầu trang:** "← Trang chủ" · tiêu đề bài · dòng phụ: ngày giờ · chủ đề · Level B1 · Ngữ pháp: … (bài ôn) · "98% từ quen" · nút **"🗑 Xóa bài này"**.

**Các banner có thể xuất hiện:**
- **Xác nhận xóa bài:** cảnh báo xóa vĩnh viễn script, câu hỏi, câu trả lời, toàn bộ audio; checkbox "Xóa luôn các thẻ từ vựng chỉ có trong bài này" (mặc định bật); nút "Xóa vĩnh viễn" (đỏ) / "Hủy".
- **Đang bổ sung nội dung:** "⏳ AI đang viết giải thích ngữ pháp và chú thích từng từ trong script (10–60 giây)..." — bài cũ tự bổ sung khi mở; lỗi → thông báo + nút "Thử lại".
- **Thiếu audio:** "Bài này chưa có đủ audio..." + nút "Tạo nốt audio" + thanh tiến trình "Đang tạo audio 12/33 câu".

**Thanh 5 bước** (bấm qua lại tự do): **1. Nghe · 2. Trả lời · 3. Kết quả · 4. Script · 5. Ngữ pháp**. Bài đã chấm rồi thì mở thẳng bước 3.

**Trình phát (dùng ở bước 1, 2, 4):** "▶ Phát cả bài" / "⏹ Dừng" · Tốc độ 0.75x / 0.9x / 1x / 1.1x. Phát cả bài = phát nối từng câu, nghỉ ngắn giữa câu. Câu đang phát được tô sáng (ở bước 4).

**Bước 1 — Nghe:** hướng dẫn ngắn ("tập trung hiểu ý, script đang ẩn, nghe 1–2 lần"); trình phát; **dải chấm tiến độ** (mỗi câu một chấm, chấm sáng = đang phát); nút "Sang bước trả lời →".

**Bước 2 — Trả lời:** ghi chú "Trả lời tiếng Việt hoặc tiếng Anh đều được"; trình phát (nghe lại); 4–5 câu hỏi, mỗi câu có **nhãn loại** (Ý chính / Chi tiết / Suy luận / Ý nghĩa ngữ pháp / Ý kiến của bạn) + ô nhập nhiều dòng; nút "Nộp bài để chấm" (đang chấm: "AI đang chấm...").

**Bước 3 — Kết quả:** mỗi câu hỏi một khối, viền màu theo kết quả:
- Nhãn **Đúng** (xanh lá) / **Đúng một phần** (cam) / **Chưa đúng** (đỏ)
- "Bạn trả lời: …" (hoặc "(bỏ trống)")
- Nhận xét của AI bằng tiếng Việt (1–3 câu)
- "💬 Cách nói tự nhiên: …" (nếu trả lời tiếng Anh)
- "Đã làm N lần (hiện lượt mới nhất)" nếu làm lại
- Nút **"🔊 Nghe đoạn chứa đáp án"** (phát các câu chứa đáp án)
- Cuối: "↻ Làm lại câu hỏi" (lưu lượt mới, không ghi đè) · "Xem script →"

**Bước 4 — Script (kiểu Language Reactor + LingQ):**
- Hướng dẫn ngắn + chú giải màu.
- Checkbox **"Hiện bản dịch tiếng Việt từng câu"** (bản dịch hiện dưới mỗi câu).
- Mỗi dòng: nhãn người nói **A / B / N** (màu khác nhau) · nút ▶ · câu. Bấm vào câu = nghe câu đó.
- **Màu của từ trong câu:**
  - Xanh nhạt = **từ mới** ít gặp (chưa biết)
  - Vàng đậm = đang học, còn yếu · Vàng nhạt = đang học, đã khá
  - Nền vàng = **cụm của bài** (đã thành thẻ, tự lưu)
  - Gạch chân chấm = **cụm từ khác đáng để ý** (cụm động từ, thành ngữ, collocation...)
  - Tên riêng, từ đã biết: không tô
- **Rê chuột vào một từ → popup** (thành phần quan trọng nhất cần thiết kế đẹp):
  - (0..n) **Khối cụm từ** chứa từ đó (nền khác màu): loại cụm (Cụm của bài / Cụm động từ / Cụm hay đi với nhau / Thành ngữ / Câu nói cố định / Cấu trúc) · dạng gốc ("pick sth up") + đoạn trong câu ("picking it up") · nghĩa trong câu · 💡 mẹo dùng (nếu có) · nút **"+ Học cụm này"** · "Tra kỹ".
  - **Khối từ:** nhãn trạng thái (TỪ MỚI / ĐANG HỌC / ĐÃ BIẾT / ĐÃ BỎ QUA) · từ → dạng gốc ("thought → think") · nghĩa trong câu · mức tần suất ("Rất phổ biến / Phổ biến / Ít gặp / Hiếm") · nút **"+ Học từ này"**, **"✓ Đã biết"**, **"Bỏ qua"** (tên riêng), **"Đánh dấu chưa biết"** (nếu đã biết), **"Tra kỹ"**.
  - Chân popup: **bản dịch cả câu**.
  - Popup tự hiện ở trên hoặc dưới từ tùy vị trí; rê chuột vào popup thì không biến mất.
- Bấm vào từ → mở **panel tra từ** bên phải. Bôi đen một đoạn → tra cả đoạn.
- Toast nhỏ phía dưới: "Đã thêm 'appreciate' vào thẻ học ✓", "'nervous': đã biết ✓"...
- Cuối: danh sách **"Các cụm trong bài (đã tự động lưu thành thẻ)"**: cụm — nghĩa (nhãn "ôn" nếu là cụm ôn) · nút "Xem ngữ pháp →".

**Bước 5 — Ngữ pháp (mẫu British Council LearnEnglish):**
1. Tiêu đề điểm ngữ pháp + **câu hỏi mở đầu** ("Bạn có biết khác nhau giữa … và … không?")
2. **"Xem các ví dụ"**: 3–4 câu (EN + dịch VN), câu nào có trong bài thì có nút ▶ nghe lại
3. **Quiz 1 "Thử trước khi đọc giải thích"**: 3 câu trắc nghiệm, bấm đáp án → đúng (xanh) / sai (đỏ) + giải thích 1 câu, điểm "Đúng x/y", "Làm lại"
4. **Giải thích**: 3–5 mục, mỗi mục: tiêu đề nhỏ, 1–2 câu, gạch đầu dòng, ví dụ
5. **Bảng** tóm tắt (so sánh 2 dạng hoặc bảng cách nói khẳng định/phủ định/câu hỏi)
6. **Lỗi hay gặp**: ✗ câu sai (gạch ngang) / ✓ câu đúng / vì sao
7. **🎧 Mẹo nghe** (hộp nổi bật)
8. **Quiz 2 "Kiểm tra lại"**: 4 câu
9. **"Đọc thêm — hiểu sâu hơn"** (thu gọn mặc định)
10. Hoàn thành: checkbox **"Đánh dấu N từ mới (tô xanh) mà bạn không tra là 'đã biết'"** + nút **"✓ Hoàn thành bài"**; đã xong thì hiện "✓ Bạn đã hoàn thành bài này".
- Khi chưa có bản chi tiết: hiện bản tóm tắt ngắn (Cấu trúc / Khi nào dùng / Người nói muốn nói gì / So với tiếng Việt / Ví dụ) + "đang viết giải thích chi tiết...".

### 4.3 Trang Ôn tập (kiểu Anki, thuật toán FSRS)

- **Thanh trên:** "← Trang chủ" · bộ đếm **Mới · Đang học · Tới hạn** (3 màu xanh dương / đỏ / xanh lá, như Anki) · "↶ Hoàn tác (Ctrl+Z)".
- **Thẻ ôn** (căn giữa, tập trung): dòng nhỏ "🎧 Thẻ nghe" hoặc "🗣️ Thẻ nói" · trạng thái (Thẻ mới / Đang học / Ôn tập / Học lại) · nhãn **"Từ hay quên"** (nếu có).
  - **Mặt trước thẻ nghe:** tự phát audio câu, **không hiện chữ**; "Nghe câu và nhớ nghĩa của cụm trong câu"; nút lớn "🔊 Nghe lại (R)".
  - **Mặt trước thẻ nói:** "Nói to câu tiếng Anh có dùng cụm mang nghĩa:" · **nghĩa tiếng Việt (chữ lớn)** · bản dịch câu trong ngoặc kép.
  - Nút lớn **"Hiện đáp án (phím cách)"**.
  - **Mặt sau:** cụm (chữ lớn) · nghĩa · câu tiếng Anh với cụm được tô · bản dịch · "🔊 Nghe lại (R)" (thẻ nói tự phát audio để so).
  - **Hộp "từ hay quên"** (nếu có): "💡 Mẹo nhớ: …" + mở rộng "Vì sao hay quên từ này?" (lý do, giải thích, ↔ từ dễ nhầm + khác biệt).
  - **4 nút chấm:** **Quên** (đỏ) · **Khó** (cam) · **Được** (xanh lá) · **Dễ** (xanh dương) — mỗi nút ghi **khoảng thời gian tới lần ôn sau** ("1 phút", "6 phút", "10 phút", "5 ngày", "1,5 tháng") và phím 1–4.
- **Phím tắt:** Space = hiện đáp án (đã hiện thì = "Được"), 1–4 = chấm, R = nghe lại, Ctrl+Z = hoàn tác.
- **Màn kết thúc phiên:** "🎉 Xong phiên ôn hôm nay!" · "Bạn đã ôn N thẻ, nhớ được X% (a/b)" · ghi chú thẻ đang học sẽ quay lại sau ít phút · "↶ Hoàn tác thẻ vừa chấm" · "Về trang chủ". Trạng thái rỗng: "Hiện không có thẻ nào cần ôn."

### 4.4 Trang Từ vựng

- Tiêu đề "Thẻ từ vựng (N)".
- **Bộ lọc:** ô tìm (từ hoặc nghĩa) · trạng thái (Tất cả / Mới / Đang học / Đã thuộc / **Từ hay quên** / Tạm ẩn) · nguồn (Mọi nguồn / Từ bài học / Từ tra từ).
- **Lưới thẻ:** mỗi thẻ: cụm (đậm) · nút 🔊 nghe câu · nghĩa · câu ngữ cảnh (cụm in đậm) + bản dịch · nhãn: mức tần suất, CEFR (A1–C2), trạng thái (Mới/Đang học/Đã thuộc/Tạm ẩn), "Hay quên". Thẻ tạm ẩn mờ đi; thẻ đang chọn có viền.
- **Bấm thẻ → panel chi tiết bên phải:** "Bài gốc: <tên bài>" (bấm để mở bài) · nguồn · "Đã gặp trong N bài" · **"Cùng nghĩa với (chỉ tính 1 từ): …"** · hộp **từ hay quên** (mẹo nhớ, lý do, giải thích, từ dễ nhầm, 3 câu ví dụ mới) · nút "Tạm ẩn / Bỏ tạm ẩn" · "Xóa" (đỏ, hỏi xác nhận) · bên dưới là **panel tra từ đầy đủ** của cụm.
- Trạng thái rỗng: "Chưa có thẻ nào. Tạo bài nghe hoặc tra từ rồi bấm 'Lưu thành thẻ'."

### 4.5 Trang Cài đặt

| Mục | Nội dung |
|---|---|
| (Lần đầu) | Banner chào: "Chào bạn! Để bắt đầu, hãy nhập API key DeepSeek..." |
| **DeepSeek** | API key (ô mật khẩu; nếu đã lưu: "đã lưu, mã hóa trên máy — nhập key mới để thay") · Model (mặc định `deepseek-flash`) · Trình độ (A2 / B1 / B2 / C1) |
| **Giọng đọc** (Kokoro, offline) | Giọng A (và người kể) · Giọng B — dropdown 11 giọng Mỹ/Anh, nam/nữ, mỗi cái có nút "🔊 Nghe thử" · ghi chú tải model ~90 MB lần đầu + thanh tiến trình tải |
| **Ôn tập** | Thẻ mới mỗi ngày (10) · Thẻ ôn tối đa mỗi ngày (100) · **Mức nhớ mong muốn** (thanh trượt 80–97%, mặc định 90%) + giải thích |
| Nút | **"Lưu cài đặt"** + thông báo "Đã lưu cài đặt ✓" / lỗi |
| **Chi phí API tháng này** | "≈ $0.0421" · số lần gọi · token vào (cache) · token ra · ghi chú ước tính |
| **Dữ liệu** | Dung lượng audio · đường dẫn thư mục dữ liệu · ghi chú sao lưu · nút "Mở thư mục dữ liệu" · "Chuyển dữ liệu sang ổ khác..." (chọn thư mục → xác nhận → app tự khởi động lại) |
| Nguồn dữ liệu | wordfreq, CEFR-J, Octanove, Kokoro (chữ nhỏ) |

### 4.6 Tạo bài — các giai đoạn tiến trình (hiển thị khi bấm "Tạo bài mới")
1. "Đang chọn nội dung bài..." 2. "AI đang viết bài nghe (30–60 giây)..." 3. "Đang kiểm tra độ khó của bài..." 4. (nếu khó) "Bài hơi khó (85% từ quen), AI đang viết lại cho dễ hơn..." 5. "Đang lưu bài học..." 6. "Đang chuẩn bị giọng đọc..." / "Đang tải model giọng đọc (lần đầu): 45/92 MB" (có %) 7. "Đang tạo audio 12/33 câu" (có %) 8. "Đang hoàn thiện giải thích ngữ pháp và chú thích script..." 9. "Đã tạo xong bài!" → tự mở bài. Lỗi ở bất kỳ bước → thông báo đỏ; bài đã lưu dở thì xuất hiện trong danh sách với nhãn "Thiếu audio".
Tổng thời gian ~2–3 phút → nên có màn/overlay chờ hấp dẫn, có thể làm việc khác.

### 4.7 Panel tra từ (dùng ở Trang chủ, Bài học, Từ vựng)
Panel bên phải, có nút ✕:
- Từ/cụm (dạng gốc) · nhãn: **mức tần suất** (tính local) · **CEFR** (nếu có) · nguồn ("Nghĩa trong bài này" / "Đã tra trước đây (không tốn API)" / "Vừa tra bằng AI").
- **Tối đa 3 nghĩa** xếp từ phổ biến → ít phổ biến, mỗi nghĩa: nghĩa VN (đậm) + 1 câu ví dụ EN + dịch. (Nếu từ là cụm của bài: nghĩa đầu tiên có nhãn "nghĩa trong bài".)
- **"Hay đi với"**: tối đa 4 collocation + nghĩa ngắn.
- 💡 Ghi chú (lỗi hay gặp / sắc thái) nếu có.
- Nút **"Lưu thành thẻ"** hoặc "✓ Đã có trong thẻ từ vựng"; thông báo "Từ này đã có trong thẻ rồi (không tạo thêm)".
- Trạng thái: "Đang tra..." / lỗi.

---

## 5. Hành vi chạy ngầm (ảnh hưởng trải nghiệm, nên có chỗ thể hiện)

1. **Bài cũ tự bổ sung** giải thích ngữ pháp + chú thích script khi mở (10–60 giây).
2. **Từ hay quên:** thẻ bị quên ≥ 4 lần → nhãn "Từ hay quên", AI tự viết mẹo nhớ + 3 câu mới có audio (chạy nền); thẻ nghe xoay vòng giữa câu gốc và câu mới.
3. **Tra lại = sắp quên:** tra một từ đang học → thẻ được đưa lên ôn ngay; tra từ "đã biết" → trở về "mới".
4. **Gộp đơn vị nghĩa:** thẻ mới được tự xếp nhóm "cùng nghĩa" (chạy nền).
5. **Bài nghe mới tự lồng 5 cụm cũ** sắp quên / hay quên vào nội dung.
6. **Chọn ngữ pháp tự động:** lần lượt 34 điểm core; cứ bài thứ 4 là bài ôn.
7. **Đo thời gian nghe** khi audio phát; thu nhỏ cửa sổ vẫn nghe được.

## 6. Dữ liệu hiển thị (tham khảo khi vẽ)

- **Bài học:** tiêu đề, chủ đề, ngày giờ, level, điểm ngữ pháp, là bài ôn?, % từ quen, trạng thái, 25–40 câu (người nói A/B/N + audio), 4–5 câu hỏi, các cụm của bài.
- **Thẻ từ vựng:** cụm, nghĩa, câu ngữ cảnh + dịch + audio, nguồn, trạng thái, tạm ẩn, hay quên, số lần gặp, bài gốc, tần suất, CEFR, cùng nghĩa với.
- **Thẻ ôn:** 2 chiều/từ (nghe, nói), trạng thái FSRS, khoảng ôn kế tiếp.
- **Từ (kiểu LingQ):** mới / đang học / đã biết / bỏ qua, số lần gặp, số lần tra.
- **Thống kê:** thời gian nghe (ngày/7 ngày/tổng/chuỗi), vốn từ (đơn vị/đang nhớ/nhớ chắc), tiến độ ngữ pháp, chi phí API.

## 7. Vấn đề UX hiện tại (người dùng phản hồi: "giao diện xấu, trải nghiệm chưa hợp lý")

- Giao diện mới ở mức chức năng: các khối thẻ trắng xếp chồng, thiếu phân cấp thị giác, thiếu điểm nhấn, chưa có cảm giác "sản phẩm".
- Trang chủ dồn quá nhiều khối ngang nhau; chưa rõ **việc chính hôm nay** (ôn thẻ? học bài mới? học tiếp bài dở?).
- Trang bài học dài, 5 bước là các tab ngang đơn giản; chưa có cảm giác **tiến trình một buổi học** (đã qua bước nào, còn bước nào), chưa có điểm "hoàn thành" rõ ràng.
- Trình phát audio đơn sơ (không thanh tiến độ, không biết đang ở câu nào khi script ẩn).
- Popup từ và panel tra từ cần đẹp, gọn, dễ đọc; màu tô từ cần hài hòa và có chú giải rõ.
- Trang ôn tập cần tập trung tối đa (kiểu Anki/Duolingo), nút chấm rõ ràng.
- Tiến trình tạo bài (2–3 phút) chỉ là một dòng chữ → nên có trải nghiệm chờ tốt.
- Thiếu biểu tượng/icon thống nhất (đang dùng emoji), font/kích thước chữ chưa tối ưu cho đọc tiếng Anh.

## 8. Mong muốn cho thiết kế mới

- Phong cách: **hiện đại, tối giản, chuyên nghiệp**, tập trung vào việc học (tham khảo cảm giác của Linear, Notion, Duolingo, Anki mới, Language Reactor, LingQ).
- Có hệ thống màu trạng thái nhất quán: mới (xanh dương), đang học (vàng), đã biết (xanh lá), hay quên (cam/đỏ), lỗi (đỏ).
- Dark mode đẹp ngang light mode.
- Có thể đề xuất **thay đổi điều hướng / bố cục** (ví dụ sidebar trái, trang chủ dạng "Hôm nay"), miễn là giữ đủ chức năng ở mục 4.

---

## 9. Danh sách ảnh cần vẽ (light mode; các màn có dấu ★ vẽ thêm dark mode)

1. ★ Trang chủ — người dùng đã có dữ liệu (có thẻ cần ôn, có bài dở, thống kê)
2. Trang chủ — lần đầu, chưa có bài nào (trạng thái rỗng)
3. Trang chủ — đang tạo bài mới (tiến trình nhiều giai đoạn, kèm tải model lần đầu)
4. Trang chủ — panel tra nhanh đang mở
5. ★ Bài học — Bước 1 Nghe (script ẩn, trình phát, tiến độ câu)
6. Bài học — Bước 2 Trả lời
7. Bài học — Bước 3 Kết quả (đủ 3 loại kết quả: đúng / một phần / chưa đúng)
8. ★ Bài học — Bước 4 Script, có **popup rê chuột** (từ nằm trong một cụm động từ) + tô màu từ + bật bản dịch
9. Bài học — Bước 4 Script, có **panel tra từ** mở bên phải
10. ★ Bài học — Bước 5 Ngữ pháp (ví dụ, quiz đã trả lời 1 câu đúng 1 câu sai, giải thích, bảng, lỗi hay gặp, mẹo nghe)
11. Bài học — Bước 5 cuối trang: hoàn thành bài (checkbox đánh dấu từ đã biết)
12. Bài học — các banner: xác nhận xóa bài · đang bổ sung nội dung · thiếu audio
13. ★ Ôn tập — thẻ nghe mặt trước (không chữ)
14. Ôn tập — thẻ nói mặt trước
15. ★ Ôn tập — mặt sau có 4 nút chấm + hộp "từ hay quên"
16. Ôn tập — màn kết thúc phiên
17. ★ Từ vựng — lưới thẻ + bộ lọc
18. Từ vựng — panel chi tiết thẻ (có "cùng nghĩa với" + hộp từ hay quên)
19. Cài đặt — đầy đủ các mục
20. Cài đặt — lần đầu (banner chào, chưa có key)
21. Trạng thái lỗi mẫu (mất mạng khi tạo bài; hết tiền DeepSeek) + toast thông báo
22. Bộ component: nút, chip, nhãn trạng thái, thẻ, popup từ, panel tra từ, trình phát audio, thanh tiến trình, ô nhập, checkbox, slider, bảng, quiz

> Khi gửi lại ảnh: đặt tên ảnh theo số thứ tự ở trên (ví dụ `08-script-popup.png`) để mình làm đúng từng màn.
