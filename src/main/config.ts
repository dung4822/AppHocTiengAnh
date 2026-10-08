import type { Level, VoiceInfo } from '@shared/types'

// ===== Cấu hình chung của app (sửa ở đây nếu muốn tinh chỉnh) =====

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
export const DEFAULT_MODEL = 'deepseek-flash'
export const DEFAULT_LEVEL: Level = 'B1'

// Giá DeepSeek (USD / 1 triệu token) cho deepseek-flash, lấy theo giá giờ cao điểm để ước tính an toàn.
// Nguồn: https://api-docs.deepseek.com/quick_start/pricing (kiểm tra tháng 10/2026)
export const PRICE_PER_MILLION = {
  inputCacheHit: 0.006,
  inputCacheMiss: 0.3,
  output: 1.2
}

// Ngưỡng tần suất (thang Zipf 1–7) theo level: từ có Zipf THẤP HƠN ngưỡng bị coi là "ít gặp".
// Zipf 4 ≈ khoảng 3000–5000 từ thông dụng nhất; Zipf 3.5 ≈ khoảng 10 000 từ.
export const ZIPF_THRESHOLD: Record<Level, number> = {
  A2: 4.2,
  B1: 3.8,
  B2: 3.4,
  C1: 3.0
}

// Tỉ lệ từ quen tối thiểu; thấp hơn thì nhờ AI viết lại câu khó (tối đa 1 lần)
export const MIN_KNOWN_RATIO = 0.9

export const NEW_CHUNKS_MIN = 3
export const NEW_CHUNKS_MAX = 5
export const MAX_REVIEW_CHUNKS = 5

// Danh sách chủ đề để chọn hoặc random
export const TOPICS = [
  'Đời sống hằng ngày',
  'Công việc lập trình viên junior',
  'Phỏng vấn xin việc',
  'Văn phòng kiểu TOEIC: cuộc họp',
  'Văn phòng kiểu TOEIC: khách hàng',
  'Văn phòng kiểu TOEIC: email và lịch hẹn',
  'Văn phòng kiểu TOEIC: giao hàng',
  'Du lịch',
  'Sức khỏe',
  'Mua sắm'
]

// Tên chủ đề tiếng Anh gửi cho AI (cùng thứ tự với TOPICS)
export const TOPICS_EN: Record<string, string> = {
  'Đời sống hằng ngày': 'everyday life',
  'Công việc lập trình viên junior': 'the daily work of a junior software developer',
  'Phỏng vấn xin việc': 'a job interview',
  'Văn phòng kiểu TOEIC: cuộc họp': 'an office meeting (TOEIC style)',
  'Văn phòng kiểu TOEIC: khách hàng': 'dealing with a client or customer at work (TOEIC style)',
  'Văn phòng kiểu TOEIC: email và lịch hẹn': 'emails and scheduling appointments at work (TOEIC style)',
  'Văn phòng kiểu TOEIC: giao hàng': 'a delivery or shipping problem at work (TOEIC style)',
  'Du lịch': 'travel',
  'Sức khỏe': 'health',
  'Mua sắm': 'shopping'
}

// Voice id của Kokoro (đã kiểm tra trong README kokoro-js và thư mục node_modules/kokoro-js/voices)
export const VOICES: VoiceInfo[] = [
  { id: 'af_heart', label: 'Heart (nữ, Mỹ)', gender: 'female', accent: 'US' },
  { id: 'af_bella', label: 'Bella (nữ, Mỹ)', gender: 'female', accent: 'US' },
  { id: 'af_nicole', label: 'Nicole (nữ, Mỹ)', gender: 'female', accent: 'US' },
  { id: 'af_sarah', label: 'Sarah (nữ, Mỹ)', gender: 'female', accent: 'US' },
  { id: 'am_michael', label: 'Michael (nam, Mỹ)', gender: 'male', accent: 'US' },
  { id: 'am_fenrir', label: 'Fenrir (nam, Mỹ)', gender: 'male', accent: 'US' },
  { id: 'am_puck', label: 'Puck (nam, Mỹ)', gender: 'male', accent: 'US' },
  { id: 'bf_emma', label: 'Emma (nữ, Anh)', gender: 'female', accent: 'UK' },
  { id: 'bf_isabella', label: 'Isabella (nữ, Anh)', gender: 'female', accent: 'UK' },
  { id: 'bm_george', label: 'George (nam, Anh)', gender: 'male', accent: 'UK' },
  { id: 'bm_fable', label: 'Fable (nam, Anh)', gender: 'male', accent: 'UK' }
]
export const DEFAULT_VOICE_A = 'af_heart'
export const DEFAULT_VOICE_B = 'am_michael'

export const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'
export const MP3_BITRATE_KBPS = 64

// ===== Giai đoạn 2: ôn tập ngắt quãng (FSRS) =====
export const DEFAULT_NEW_PER_DAY = 10
export const DEFAULT_REVIEWS_PER_DAY = 100
export const DEFAULT_DESIRED_RETENTION = 0.9 // xác suất nhớ mong muốn khi tới hạn (như Anki)
// Ngày mới bắt đầu lúc 4 giờ sáng (giống Anki), để học khuya không bị tính sang ngày hôm sau
export const DAY_START_HOUR = 4
// Hết thẻ khác thì cho học trước các thẻ đang trong bước học sắp tới hạn (Anki: "Learn ahead limit")
export const LEARN_AHEAD_MINUTES = 20
// Bước học cho thẻ mới và thẻ bị quên (giống mặc định của Anki)
export const LEARNING_STEPS = ['1m', '10m'] as const
export const RELEARNING_STEPS = ['10m'] as const
// Thẻ được coi là "đã thuộc" khi độ ổn định (stability) ≥ số ngày này ở CẢ thẻ nghe và thẻ nói
export const KNOWN_STABILITY_DAYS = 21

// ===== Từ vựng thông minh (docs/THIET_KE_TU_VUNG.md) =====
// Một thẻ bị quên ≥ số lần này → "từ hay quên" (Anki mặc định 8; app để 4 để phát hiện sớm)
export const LEECH_LAPSES = 4
// Từ "mới" được tô xanh trong script nếu Zipf < ngưỡng level + khoảng này (từ rất phổ biến thì không tô cho đỡ rối)
export const NEW_WORD_ZIPF_MARGIN = 1.0
// Vùng "sắp quên" để lồng vào bài nghe mới (xác suất còn nhớ R theo FSRS)
export const RECALL_ZONE_MIN = 0.7
export const RECALL_ZONE_MAX = 0.92
// Tra một từ từ 2 lần trở lên → coi là từ lạ khi kiểm tra độ khó (dù phổ biến)
export const HARD_LOOKUP_COUNT = 2
