# Thiết kế phần từ vựng — "gặp lại đúng lúc, đúng chỗ"

Tài liệu này đúc kết từ các app học từ phổ biến và nghiên cứu về trí nhớ, để quyết định **app cho bạn gặp lại từ nào, khi nào, bằng cách nào**.

## 1. Học được gì từ các app

| App | Ý tưởng lấy về |
|---|---|
| **Anki** | Lập lịch bằng thuật toán (FSRS). Thẻ quên quá nhiều lần = **leech**: mặc định 8 lần thì đánh dấu và tạm ẩn — tức là *cách học thẻ đó đang sai, cần đổi cách*, không phải ôn thêm. |
| **LingQ** | Mỗi từ có **trạng thái**: Mới → Nhận ra → Quen → Đã học, cộng **Đã biết** và **Bỏ qua**. Từ chưa biết được **tô màu ngay trong bài**. Lật sang trang mới thì các từ chưa tra coi như **đã biết** → danh sách từ đã biết lớn dần rất nhanh mà không tốn công. |
| **Language Reactor** | Rê chuột thấy nghĩa theo ngữ cảnh, nhận ra **cụm từ** chứ không chỉ từ đơn (app đã làm ở bản trước). |
| **Migaku / i+1** | Câu tốt nhất để học là câu mà bạn chỉ **chưa biết đúng 1 thứ** → cần biết chính xác bạn đã biết từ nào. |

## 2. Khoa học về trí nhớ áp dụng vào app

1. **Hiệu ứng giãn cách + nhớ lại chủ động** (spacing, retrieval practice): tự nhớ lại sau một khoảng thời gian tốt hơn đọc lại nhiều lần → thẻ ôn FSRS (đã có).
2. **Khó khăn có lợi** (Bjork — desirable difficulties): ôn lúc **sắp quên** hiệu quả nhất. FSRS ước lượng được *xác suất còn nhớ* R của từng thẻ → app chọn từ có R khoảng **70–92%** để lồng vào bài nghe mới.
3. **Gặp lại nhiều lần trong ngữ cảnh**: học từ qua nghe tăng dần theo số lần gặp, hiệu quả tăng tới khoảng **20 lần gặp** (Uchihara, Webb & Yanagisawa, 2019) → app **đếm số lần bạn gặp mỗi từ** và ưu tiên từ mới gặp ít lần.
4. **Đa dạng ngữ cảnh** (encoding variability): gặp một từ trong nhiều câu khác nhau giúp hiểu từ chứ không thuộc vẹt một câu → thẻ khó có thêm câu mới, ôn xoay vòng.
5. **Độ phủ từ vựng**: nghe hiểu ổn khi biết khoảng **95% từ** trong bài (van Zeeland & Schmitt, 2013) → kiểm tra độ khó dựa trên **từ bạn thật sự biết**, không chỉ dựa vào tần suất chung.
6. **Quên là tín hiệu**: khi bạn phải **tra lại** một từ đã học → đó là dấu hiệu sắp quên → đưa thẻ lên ôn sớm (không cần đợi tới hạn).

## 3. Thiết kế

### A. Trạng thái từng từ (kiểu LingQ)
- Mỗi **từ gốc** (went → go) có trạng thái: **Mới** · **Đang học** (đã có thẻ) · **Đã biết** · **Bỏ qua** (tên riêng, từ không cần học).
- Trong script: từ **Đang học** tô vàng (càng đậm = càng yếu), từ **Mới** mà ít gặp tô xanh nhạt. Từ đã biết không tô → mắt chỉ dừng ở chỗ cần chú ý.
- Popup có nút: **Học từ này** (tạo thẻ với *nghĩa đúng trong câu* + câu + audio của bài) · **Đã biết** · **Bỏ qua**.
- Bấm **Hoàn thành bài** → các từ ít gặp mà bạn **không tra, không lưu** được đánh dấu **Đã biết** (giống LingQ lật trang). Có thể bỏ chọn.
- Kiểm tra độ khó của bài mới: từ lạ = ít gặp **và** chưa biết; ngoài ra **từ bạn đã tra từ 2 lần trở lên** cũng bị coi là lạ dù phổ biến (cá nhân hóa).
- App đếm cho mỗi từ: số lần gặp trong bài nghe, số lần tra.

### C. Từ hay quên (leech)
- Một từ thành **"từ hay quên"** khi một thẻ của nó bị quên **≥ 4 lần** (Anki dùng 8; app để 4 vì bạn ôn ít thẻ hơn và cần phát hiện sớm).
- Khi đó AI viết **"cứu trợ"** cho từ: vì sao dễ quên, phân biệt với từ dễ nhầm, **mẹo nhớ**, và **3 câu mới** (có audio).
- Lúc ôn: thẻ có nhãn "Từ hay quên", sau khi hiện đáp án có mẹo nhớ; thẻ nghe **xoay vòng** giữa câu gốc và câu mới.
- Từ hay quên được **ưu tiên lồng vào bài nghe tiếp theo**. Khi thẻ đã vững (độ ổn định ≥ 21 ngày) thì gỡ nhãn.

### Thuật toán "gặp lại" — 3 kênh
1. **Thẻ ôn (FSRS)**: nhớ lại chủ động, lịch như Anki (đã có).
2. **Bài nghe mới**: mỗi bài lồng tối đa 5 cụm đã học, chọn theo điểm:
   - xác suất còn nhớ R trong vùng 70–92% (sắp quên): **+3**; R < 70%: +2
   - từ hay quên: **+3**
   - gặp trong bài nghe ít lần (< 6): tới +2
   - vừa gặp trong 2 ngày gần đây: **−3** (giãn cách)
3. **Tra lại = sắp quên**: tra một từ đang học → thẻ được đưa lên ôn ngay (giữ nguyên trí nhớ FSRS, chỉ dời ngày tới hạn); tra một từ đã đánh dấu "Đã biết" → trở về "Mới".

### Đếm vốn từ không trùng ("đơn vị nghĩa")
Bạn học "runs out" rồi gặp "run out of", hay "on it" rồi "get on it" — đó vẫn là **một** thứ bạn biết. Ngược lại "run" và "run out"
nghĩa khác hẳn → **hai** thứ. App đếm theo đơn vị nghĩa:
1. **Chuẩn hóa (miễn phí, chạy trên máy)**: đưa về dạng gốc, bỏ đại từ/mạo từ/từ nhấn (it, you, the, really...) nhưng giữ giới từ
   vì chúng đổi nghĩa cụm động từ. Trùng khóa → cùng đơn vị.
2. **Hỏi AI (chỉ khi cần)**: mục mới có chung từ mang nghĩa (hoặc nằm gọn trong) một đơn vị đã có → hỏi AI theo nhóm "có cùng nghĩa không",
   dựa trên nghĩa tiếng Việt trong ngữ cảnh. Không chung từ nào → chắc chắn là đơn vị mới.
3. **Đếm**: mỗi đơn vị lấy thẻ nhớ tốt nhất. *Đang nhớ* = xác suất còn nhớ ≥ 80% (FSRS), *nhớ chắc* = độ ổn định ≥ 21 ngày.
   Các thẻ cùng đơn vị vẫn được giữ để ôn (nhiều ngữ cảnh giúp nhớ lâu), chỉ là không đếm trùng.

### Thời gian nghe
Chỉ tính lúc audio đang phát (không tính lúc mở app mà không nghe), cộng dồn theo ngày (mốc 4 giờ sáng), có chuỗi ngày liên tiếp.

### Để sau (đã bàn, chưa làm)
- **B. Thẻ nhiều ngữ cảnh** cho mọi từ (hiện chỉ áp dụng cho từ hay quên).
- **D. Thẻ nói có AI chấm** câu bạn tự đặt.
- Bài kiểm tra ước lượng vốn từ ban đầu.

## Nguồn
- [LingQ — trạng thái của LingQ](https://lingq-support.groovehq.com/help/can-you-explain-a-lingqs-status)
- [Anki forum — leech threshold](https://forums.ankiweb.net/t/questions-about-the-leech-tag-and-suspended-cards/18531)
- [Uchihara, Webb & Yanagisawa (2019) — số lần gặp và học từ ngẫu nhiên](https://www.cambridge.org/core/product/E38E3468FD2090B1FA3051051DE8E70C)
- [Độ phủ từ vựng cần cho nghe hiểu (van Zeeland & Schmitt)](https://www.cambridge.org/core/journals/language-teaching/article/how-much-vocabulary-is-needed-to-use-english-replication-of-van-zeeland-schmitt-2012-nation-2006-and-cobb-2007/1D217A56A2E0056E67802A6A8360FDDE)
- [British Council LearnEnglish — mẫu trang ngữ pháp](https://learnenglish.britishcouncil.org/grammar/b1-b2-grammar/present-perfect-simple-continuous)
