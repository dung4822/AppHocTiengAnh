// Interface chung cho mọi nhà cung cấp giọng đọc (giống interface ITtsProvider trong C#).
// Hiện chỉ có Kokoro (offline). Sau này muốn thêm provider cloud thì viết class mới
// implement interface này, phần còn lại của app không phải sửa.

export interface TtsProgress {
  message: string
  percent?: number
}

export interface TtsProvider {
  // Chuẩn bị (ví dụ tải model lần đầu). Gọi nhiều lần cũng chỉ khởi tạo một lần.
  ensureReady(onProgress?: (p: TtsProgress) => void): Promise<void>
  // Đọc một câu và lưu thành file mp3 tại outPath
  synthesizeToFile(text: string, voice: string, outPath: string): Promise<void>
}
