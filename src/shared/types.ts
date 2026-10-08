// Các kiểu dữ liệu dùng chung giữa main process và renderer.
// (Giống như các DTO dùng chung trong một project C# "Shared".)

export type Level = 'A2' | 'B1' | 'B2' | 'C1'
export type AnswerResult = 'full' | 'partial' | 'none'
export type QuestionType = 'main_idea' | 'detail' | 'inference' | 'grammar_meaning' | 'opinion'
export type VocabStatus = 'new' | 'learning' | 'known'
export type LessonStatus = 'audio_pending' | 'ready' | 'done'

export interface AppSettings {
  hasApiKey: boolean
  level: Level
  model: string
  voiceA: string
  voiceB: string
  // Giai đoạn 2: ôn tập
  newPerDay: number
  reviewsPerDay: number
  desiredRetention: number // 0.80–0.97, mặc định 0.9 (giống "Desired retention" của Anki)
}

// ===== Giai đoạn 2: ôn tập ngắt quãng =====

export type CardDirection = 'listen' | 'speak'
export type ReviewRating = 1 | 2 | 3 | 4 // Quên / Khó / Được / Dễ

export interface ReviewCounts {
  newCount: number // thẻ mới còn được học hôm nay (đã trừ giới hạn)
  learningCount: number // thẻ đang trong bước học (1 phút / 10 phút) tới hạn
  reviewCount: number // thẻ ôn tới hạn hôm nay (đã trừ giới hạn)
}

export interface ReviewCardView {
  cardId: number
  vocabId: number
  direction: CardDirection
  state: 0 | 1 | 2 | 3 // 0 Mới, 1 Đang học, 2 Ôn, 3 Học lại
  text: string // cụm/từ
  meaningVi: string
  sentenceEn: string | null // câu ngữ cảnh (hoặc câu ví dụ)
  sentenceVi: string | null
  audioUrl: string | null
  isLeech: boolean
  rescue: LeechRescue | null
  // Khoảng thời gian tới lần ôn sau cho từng nút, ví dụ { 1: '1 phút', 3: '3 ngày' }
  intervals: Record<ReviewRating, string>
  counts: ReviewCounts
}

export interface AnswerReviewResult {
  logId: number
}

export interface VoiceInfo {
  id: string
  label: string
  gender: 'female' | 'male'
  accent: 'US' | 'UK'
}

export interface LessonListItem {
  id: number
  createdAt: string
  title: string
  topic: string
  grammarName: string
  isGrammarReview: boolean
  status: LessonStatus
}

export interface Sentence {
  id: number
  idx: number
  speaker: 'A' | 'B' | 'N'
  text: string
  // URL dạng app-audio://... để renderer phát được (null nếu chưa tạo audio)
  audioUrl: string | null
}

export interface AnswerRecord {
  id: number
  userAnswer: string
  result: AnswerResult
  feedbackVi: string
  naturalVersion: string | null
  createdAt: string
}

export interface Question {
  id: number
  idx: number
  type: QuestionType
  question: string
  keyPoints: string[]
  evidenceIdxs: number[]
  // Lượt trả lời gần nhất (null nếu chưa trả lời)
  lastAnswer: AnswerRecord | null
  attempts: number
}

export interface GrammarExplanation {
  form: string
  when: string
  meaning: string
  vs_vietnamese: string
  examples: { en: string; vi: string }[]
}

export interface LessonChunk {
  vocabId: number
  text: string
  meaningVi: string
  isReview: boolean
  sentenceIdx: number | null
}

// Bài ngữ pháp (prompt G v2, theo mẫu British Council LearnEnglish)
export interface GrammarQuiz {
  question: string
  options: string[]
  answer: number // vị trí đáp án đúng (từ 0)
  explain: string
}
export interface GrammarDeep {
  title_vi: string
  hook: string
  examples: { en: string; vi: string }[]
  test1: GrammarQuiz[]
  sections: { heading: string; body: string; bullets: string[]; examples: { en: string; vi: string }[] }[]
  table: { caption: string; headers: string[]; rows: string[][] } | null
  mistakes: { wrong: string; right: string; why: string }[]
  listening_tip: string
  test2: GrammarQuiz[]
  deep_dive: string
}

// Chú thích script kiểu Language Reactor (prompt N)
export interface WordNote {
  t: string // từ như trong câu
  base: string // dạng gốc
  vi: string // nghĩa trong câu này
  freq: string // nhãn tần suất (tính local)
}
export interface PhraseNote {
  text: string // đoạn chính xác trong câu, ví dụ "picking it up"
  base: string // dạng từ điển, ví dụ "pick sth up"
  vi: string
  kind: string // phrasal_verb | collocation | idiom | fixed_expression | pattern
  note: string | null
}
export interface SentenceNote {
  idx: number
  vi: string
  words: WordNote[]
  phrases: PhraseNote[]
}

// ===== Trạng thái từng từ (kiểu LingQ) =====
export type WordStatus = 'new' | 'learning' | 'known' | 'ignored'
export interface WordState {
  status: WordStatus
  // Cách tô trong script: new = từ mới ít gặp (xanh), weak/learning = đang học (vàng đậm/nhạt), none = không tô
  highlight: 'none' | 'new' | 'weak' | 'learning'
  lookups: number
}

// Nội dung AI viết thêm cho từ hay quên (leech)
export interface LeechRescue {
  why_hard: string
  explain: string
  confusables: { text: string; difference: string }[]
  memory_hook: string
  examples: { en: string; vi: string }[]
}

export interface LessonDetail {
  id: number
  createdAt: string
  title: string
  topic: string
  level: string
  status: LessonStatus
  grammarName: string
  isGrammarReview: boolean
  knownRatio: number | null
  grammar: GrammarExplanation
  grammarDeep: GrammarDeep | null // null = chưa tạo (bài cũ) → app tự tạo khi mở
  annotations: SentenceNote[] | null // null = chưa tạo
  // Trạng thái các từ trong bài, khóa = từ gốc viết thường (lấy từ chú thích, hoặc chính từ đó)
  wordStates: Record<string, WordState>
  newWordCount: number // số từ mới (tô xanh, chưa tra) sẽ được đánh dấu "đã biết" khi hoàn thành bài
  sentences: Sentence[]
  questions: Question[]
  chunks: LessonChunk[]
}

export interface GradeInput {
  questionId: number
  answer: string
}

export interface LookupMeaning {
  meaning_vi: string
  example_en: string
  example_vi: string
}

export interface LookupResult {
  term: string
  // 'lesson' = lấy từ danh sách cụm của bài (không gọi API), 'cache' = từ lookup_cache, 'api' = vừa gọi DeepSeek
  source: 'lesson' | 'cache' | 'api'
  meanings: LookupMeaning[]
  collocations: { text: string; vi: string }[]
  noteVi: string | null
  frequencyLabel: string
  zipf: number | null
  cefr: string | null
  savedVocabId: number | null
}

export interface LookupContext {
  lessonId?: number
  sentenceId?: number
  // true = chỉ xem lại (ví dụ mở thẻ ở trang Từ vựng), KHÔNG tính là "phải tra lại vì quên"
  passive?: boolean
}

export interface VocabItem {
  id: number
  text: string
  kind: 'word' | 'chunk'
  meaningVi: string
  source: 'lesson' | 'lookup'
  status: VocabStatus
  suspended: boolean
  contextEn: string | null
  contextVi: string | null
  contextAudioUrl: string | null
  exampleEn: string | null
  exampleVi: string | null
  exampleAudioUrl: string | null
  firstLessonId: number | null
  firstLessonTitle: string | null
  leech: boolean
  rescue: LeechRescue | null
  sameUnit: string[] // các thẻ khác được tính CÙNG một đơn vị nghĩa với thẻ này
  frequencyLabel: string
  cefr: string | null
  timesSeen: number
  createdAt: string
}

export interface VocabFilter {
  search?: string
  status?: VocabStatus | 'suspended' | 'leech' | 'all'
  source?: 'lesson' | 'lookup' | 'all'
}

export interface SaveVocabResult {
  vocabId: number
  alreadyExisted: boolean
}

// Vốn từ đếm theo "đơn vị nghĩa" (không đếm trùng từ/cụm cùng nghĩa)
export interface VocabCount {
  units: number // số đơn vị nghĩa đang học
  cards: number // số thẻ (một đơn vị có thể có nhiều thẻ)
  remembered: number // đơn vị bạn đang nhớ (xác suất còn nhớ ≥ 80% theo FSRS)
  solid: number // đơn vị nhớ chắc (độ ổn định ≥ 21 ngày)
}

export interface ListeningStats {
  todaySeconds: number
  totalSeconds: number
  last7: { day: string; seconds: number }[]
  streakDays: number // số ngày liên tiếp nghe ≥ 1 phút
  lessonSeconds: number
  reviewSeconds: number
}

export interface HomeStats {
  coreTaught: number
  coreTotal: number
  lessonCount: number
  vocabCount: number
  dueToday: number // số thẻ cần ôn hôm nay (mới + đang học + tới hạn)
  knownWords: number // số từ đã đánh dấu "đã biết"
  learningItems: number // số từ/cụm đang học (có thẻ)
  leechCount: number // số từ hay quên
  vocab: VocabCount
  listening: ListeningStats
}

export interface UsageSummary {
  month: string
  calls: number
  inputTokens: number
  cachedTokens: number
  outputTokens: number
  costUsd: number
}

export interface StorageInfo {
  audioBytes: number
  userDataPath: string
}

// Sự kiện tiến trình gửi từ main → renderer khi tạo bài / tạo audio / tải model
export interface ProgressEvent {
  stage: 'select' | 'generate' | 'check' | 'rewrite' | 'save' | 'model' | 'audio' | 'done' | 'error'
  message: string
  current?: number
  total?: number
}

// Kết quả trả về chung cho các lệnh IPC: hoặc thành công, hoặc lỗi có thông báo tiếng Việt.
// (Tương tự kiểu Result<T> hay dùng trong C#, thay cho việc ném exception qua IPC.)
export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

// API mà preload "bơm" vào window.api cho renderer dùng
export interface AppApi {
  getSettings(): Promise<IpcResult<AppSettings>>
  saveSettings(s: Partial<Omit<AppSettings, 'hasApiKey'>> & { apiKey?: string }): Promise<IpcResult<AppSettings>>
  listVoices(): Promise<IpcResult<VoiceInfo[]>>
  previewVoice(voiceId: string): Promise<IpcResult<string>>
  getUsage(): Promise<IpcResult<UsageSummary>>
  getStorageInfo(): Promise<IpcResult<StorageInfo>>
  openUserData(): Promise<IpcResult<void>>
  // Trả về thư mục mới (app sẽ tự khởi động lại), hoặc null nếu người dùng hủy
  moveUserData(): Promise<IpcResult<string | null>>

  getHomeStats(): Promise<IpcResult<HomeStats>>
  listTopics(): Promise<IpcResult<string[]>>
  listLessons(): Promise<IpcResult<LessonListItem[]>>
  createLesson(topic: string | null): Promise<IpcResult<number>>
  getLesson(id: number): Promise<IpcResult<LessonDetail>>
  resumeAudio(lessonId: number): Promise<IpcResult<void>>
  gradeAnswers(lessonId: number, answers: GradeInput[]): Promise<IpcResult<LessonDetail>>
  // markKnown = đánh dấu "đã biết" các từ mới ít gặp trong bài mà bạn không tra / không lưu (kiểu LingQ)
  finishLesson(lessonId: number, markKnown: boolean): Promise<IpcResult<void>>
  setWordStatus(term: string, status: 'new' | 'known' | 'ignored'): Promise<IpcResult<void>>
  // Lưu thẻ với NGHĨA ĐÚNG TRONG CÂU (lấy từ chú thích), không gọi API
  saveFromContext(input: { term: string; meaningVi: string; sentenceId: number }): Promise<IpcResult<SaveVocabResult>>
  // Tạo phần còn thiếu (ngữ pháp chi tiết / chú thích script) rồi trả về bài đã cập nhật
  enrichLesson(lessonId: number): Promise<IpcResult<LessonDetail>>
  // Xóa bài + toàn bộ audio. deleteVocab = xóa luôn các thẻ từ vựng CHỈ có trong bài này
  deleteLesson(lessonId: number, deleteVocab: boolean): Promise<IpcResult<void>>

  lookup(term: string, ctx?: LookupContext): Promise<IpcResult<LookupResult>>
  saveLookupAsCard(term: string, ctx?: LookupContext): Promise<IpcResult<SaveVocabResult>>

  listVocab(filter: VocabFilter): Promise<IpcResult<VocabItem[]>>
  setVocabSuspended(id: number, suspended: boolean): Promise<IpcResult<void>>
  deleteVocab(id: number): Promise<IpcResult<void>>

  // Giai đoạn 2
  getReviewCounts(): Promise<IpcResult<ReviewCounts>>
  // lastVocabId: từ vừa ôn, để không cho 2 thẻ của cùng một từ đứng liền nhau
  getNextReviewCard(lastVocabId: number | null): Promise<IpcResult<ReviewCardView | null>>
  answerReview(cardId: number, rating: ReviewRating): Promise<IpcResult<AnswerReviewResult>>
  undoReview(logId: number): Promise<IpcResult<void>>

  // Cộng thời gian nghe thật (giây) — giao diện đo khi audio đang phát
  addListeningTime(seconds: number, source: 'lesson' | 'review' | 'other'): Promise<IpcResult<void>>

  onProgress(cb: (e: ProgressEvent) => void): () => void
}
