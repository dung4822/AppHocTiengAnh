// File này chạy trong một PROCESS RIÊNG (Electron utilityProcess), không phải main process.
// Nhờ vậy việc chạy model Kokoro (nặng CPU) không làm đơ giao diện.
// Model chỉ được khởi tạo MỘT LẦN, sau đó dùng lại cho mọi câu.
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { FromWorker, ToWorker } from './ttsMessages'

// Kiểu tối thiểu của đối tượng KokoroTTS mà mình dùng
interface KokoroLike {
  generate(text: string, opts: { voice: string }): Promise<{ audio: Float32Array; sampling_rate: number }>
}

let tts: KokoroLike | null = null

function send(msg: FromWorker): void {
  process.parentPort.postMessage(msg)
}

async function init(cacheDir: string, modelId: string): Promise<void> {
  try {
    // Dùng import() động vì kokoro-js và transformers.js là ES module.
    // Quan trọng: phải lấy `env` từ CÙNG bản transformers mà kokoro-js dùng thì cacheDir mới có tác dụng.
    const { env } = await import('@huggingface/transformers')
    env.cacheDir = cacheDir
    const { KokoroTTS } = await import('kokoro-js')
    tts = (await KokoroTTS.from_pretrained(modelId, {
      dtype: 'q8',
      device: 'cpu',
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status === 'progress' && p.file) {
          send({ type: 'progress', file: p.file, loaded: p.loaded ?? 0, total: p.total ?? 0 })
        }
      }
    })) as unknown as KokoroLike
    send({ type: 'ready' })
  } catch (err) {
    send({ type: 'init-error', message: err instanceof Error ? err.message : String(err) })
  }
}

// Kokoro trả về mẫu âm thanh dạng số thực -1..1 → đổi sang số nguyên 16-bit → mã hóa mp3 bằng lamejs (thuần JS)
async function encodeMp3(samples: Float32Array, sampleRate: number, bitrate: number): Promise<Buffer> {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  const encoder = new Mp3Encoder(1, sampleRate, bitrate)
  const parts: Buffer[] = []
  const BLOCK = 1152 // kích thước khung chuẩn của mp3
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const chunk = encoder.encodeBuffer(pcm.subarray(i, i + BLOCK))
    if (chunk.length) parts.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength))
  }
  const end = encoder.flush()
  if (end.length) parts.push(Buffer.from(end.buffer, end.byteOffset, end.byteLength))
  return Buffer.concat(parts)
}

// Hàng đợi đơn giản: xử lý lần lượt từng câu (model không chạy song song được)
let queue: Promise<void> = Promise.resolve()

process.parentPort.on('message', (e) => {
  const msg = e.data as ToWorker
  if (msg.type === 'init') {
    void init(msg.cacheDir, msg.modelId)
    return
  }
  if (msg.type === 'synth') {
    queue = queue.then(async () => {
      try {
        if (!tts) throw new Error('Model giọng đọc chưa sẵn sàng')
        const audio = await tts.generate(msg.text, { voice: msg.voice })
        const mp3 = await encodeMp3(audio.audio, audio.sampling_rate, msg.bitrate)
        mkdirSync(dirname(msg.outPath), { recursive: true })
        writeFileSync(msg.outPath, mp3)
        send({ type: 'done', id: msg.id, bytes: mp3.length })
      } catch (err) {
        send({ type: 'synth-error', id: msg.id, message: err instanceof Error ? err.message : String(err) })
      }
    })
  }
})
