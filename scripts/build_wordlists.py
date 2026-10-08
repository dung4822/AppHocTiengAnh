# Script chạy MỘT LẦN (bởi người phát triển) để tạo dữ liệu đóng gói sẵn trong resources/.
# App không cần Python khi chạy. Cách chạy lại:
#   pip install wordfreq
#   python scripts/build_wordlists.py <cefrj.csv> <octanove.csv>
import csv, json, re, sys
from wordfreq import top_n_list, zipf_frequency

# 1) Tần suất từ (wordfreq, dữ liệu gộp nhiều nguồn trong đó có phụ đề phim SUBTLEX/OpenSubtitles)
freq = {}
for w in top_n_list('en', 100000):
    if re.fullmatch(r"[a-z][a-z'\-]*", w):
        freq[w] = round(zipf_frequency(w, 'en'), 2)
with open('resources/wordfreq-en.json', 'w', encoding='utf-8') as f:
    json.dump(freq, f, separators=(',', ':'))
print('freq words:', len(freq))

# 2) CEFR (CEFR-J A1–B2 + Octanove C1–C2): lấy mức thấp nhất nếu một từ có nhiều nghĩa/từ loại
order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
cefr = {}
for path in sys.argv[1:3]:
    with open(path, encoding='utf-8-sig') as f:
        for row in csv.DictReader(f):
            level = row['CEFR'].strip().upper()
            if level not in order:
                continue
            for w in row['headword'].split('/'):
                w = w.strip().lower()
                if not w:
                    continue
                if w not in cefr or order.index(level) < order.index(cefr[w]):
                    cefr[w] = level
with open('resources/cefr-en.json', 'w', encoding='utf-8') as f:
    json.dump(cefr, f, separators=(',', ':'), ensure_ascii=False)
print('cefr words:', len(cefr))
