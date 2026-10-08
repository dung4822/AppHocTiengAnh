// Các message trao đổi giữa main process và process TTS riêng (utilityProcess).
// Dùng "discriminated union": trường `type` cho biết message thuộc loại nào
// (giống pattern matching theo kiểu record trong C#).

export type ToWorker =
  | { type: 'init'; cacheDir: string; modelId: string }
  | { type: 'synth'; id: number; text: string; voice: string; outPath: string; bitrate: number }

export type FromWorker =
  | { type: 'progress'; file: string; loaded: number; total: number }
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  | { type: 'done'; id: number; bytes: number }
  | { type: 'synth-error'; id: number; message: string }
