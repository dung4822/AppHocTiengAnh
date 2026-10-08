import { utilityProcess, type UtilityProcess } from 'electron'
import { join } from 'node:path'
import { UserError } from '../../errors'
import { modelCacheDir } from '../../paths'
import { KOKORO_MODEL_ID, MP3_BITRATE_KBPS } from '../../config'
import type { TtsProgress, TtsProvider } from './ttsProvider'
import type { FromWorker, ToWorker } from './ttsMessages'

// Phía main process: điều khiển process TTS riêng (ttsWorker.ts) qua message.
export class KokoroProvider implements TtsProvider {
  private child: UtilityProcess | null = null
  private readyPromise: Promise<void> | null = null
  private progressListener: ((p: TtsProgress) => void) | null = null
  private nextId = 1
  // Các yêu cầu đang chờ worker trả lời: id → hàm resolve/reject của Promise
  private pending = new Map<number, { resolve: () => void; reject: (e: Error) => void }>()
  private fileProgress = new Map<string, { loaded: number; total: number }>()
  private lastPercent = -1

  ensureReady(onProgress?: (p: TtsProgress) => void): Promise<void> {
    if (onProgress) this.progressListener = onProgress
    if (!this.readyPromise) {
      this.readyPromise = this.start().catch((err) => {
        // Khởi tạo lỗi (ví dụ mất mạng lúc tải model lần đầu) → lần sau gọi sẽ thử lại từ đầu
        this.readyPromise = null
        this.kill()
        throw err
      })
    }
    return this.readyPromise
  }

  private start(): Promise<void> {
    return new Promise((resolve, reject) => {
      // ttsWorker.js được electron-vite build ra cùng thư mục với index.js của main
      const child = utilityProcess.fork(join(__dirname, 'ttsWorker.js'), [], { serviceName: 'kokoro-tts' })
      this.child = child
      this.fileProgress.clear()
      this.lastPercent = -1

      child.on('message', (msg: FromWorker) => {
        switch (msg.type) {
          case 'progress':
            this.reportDownload(msg.file, msg.loaded, msg.total)
            break
          case 'ready':
            this.progressListener?.({ message: 'Model giọng đọc đã sẵn sàng', percent: 100 })
            resolve()
            break
          case 'init-error':
            reject(
              new UserError(
                'Không tải/khởi tạo được model giọng đọc (lần đầu cần Internet để tải khoảng 90 MB). ' +
                  'Kiểm tra mạng rồi bấm thử lại. Chi tiết: ' +
                  msg.message
              )
            )
            break
          case 'done':
            this.pending.get(msg.id)?.resolve()
            this.pending.delete(msg.id)
            break
          case 'synth-error':
            this.pending.get(msg.id)?.reject(new UserError('Lỗi khi tạo audio: ' + msg.message))
            this.pending.delete(msg.id)
            break
        }
      })

      child.on('exit', (code) => {
        // Process TTS bị tắt bất ngờ → báo lỗi cho mọi yêu cầu đang chờ, lần sau sẽ khởi động lại
        const err = new UserError(`Process giọng đọc bị dừng (mã ${code}). Thử lại nhé.`)
        for (const p of this.pending.values()) p.reject(err)
        this.pending.clear()
        this.child = null
        this.readyPromise = null
        reject(err)
      })

      this.send({ type: 'init', cacheDir: modelCacheDir(), modelId: KOKORO_MODEL_ID })
    })
  }

  // Gộp tiến trình tải của nhiều file model thành một phần trăm chung
  private reportDownload(file: string, loaded: number, total: number): void {
    this.fileProgress.set(file, { loaded, total })
    let l = 0
    let t = 0
    for (const v of this.fileProgress.values()) {
      l += v.loaded
      t += v.total
    }
    const percent = t > 0 ? Math.round((l / t) * 100) : 0
    // Chỉ báo khi phần trăm thay đổi, tránh gửi hàng nghìn sự kiện sang giao diện
    if (percent === this.lastPercent) return
    this.lastPercent = percent
    this.progressListener?.({
      message: `Đang tải model giọng đọc (lần đầu): ${(l / 1e6).toFixed(0)}/${(t / 1e6).toFixed(0)} MB`,
      percent
    })
  }

  async synthesizeToFile(text: string, voice: string, outPath: string): Promise<void> {
    await this.ensureReady()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.send({ type: 'synth', id, text, voice, outPath, bitrate: MP3_BITRATE_KBPS })
    })
  }

  private send(msg: ToWorker): void {
    this.child?.postMessage(msg)
  }

  kill(): void {
    this.child?.kill()
    this.child = null
  }
}

// Một instance dùng chung cho cả app
export const tts = new KokoroProvider()
