import { useEffect, useState } from 'react'
import { Loader2, Volume2 } from 'lucide-react'
import { api, call } from '../api'

// Nút loa nhỏ: đọc một câu tiếng Anh bằng giọng offline (Kokoro).
// Lần đầu mất ~1 giây để tạo mp3, các lần sau phát ngay (main giữ file trong audio/say).
// Dùng chung MỘT thẻ <audio> cho cả app → bấm loa khác thì câu cũ tự dừng.
const audio = new Audio()
const listeners = new Set<() => void>()
let playingText: string | null = null

function setPlaying(text: string | null): void {
  playingText = text
  listeners.forEach((l) => l())
}
audio.addEventListener('ended', () => setPlaying(null))
// Sự kiện pause đến trễ: khi chuyển sang câu khác thì lúc đó audio đã phát tiếp → không xóa trạng thái
audio.addEventListener('pause', () => audio.paused && setPlaying(null))

export async function speak(text: string): Promise<void> {
  const url = await call(api.sayText(text))
  audio.pause()
  audio.src = url
  setPlaying(text)
  await audio.play()
}

// Tạo sẵn audio ở nền (không phát) → lúc bấm loa phát ngay
export function prefetchSpeech(texts: string[]): void {
  void (async () => {
    for (const t of texts) await api.sayText(t).catch(() => {})
  })()
}

// idleBg: màu nền lúc chưa phát (đặt trên nền surface2 thì dùng bg-surface để nút nổi lên)
export default function SpeakButton({
  text,
  size = 15,
  className = '',
  idleBg = 'bg-surface2'
}: {
  text: string
  size?: number
  className?: string
  idleBg?: string
}) {
  const [loading, setLoading] = useState(false)
  const [playing, setPlayingState] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const l = (): void => setPlayingState(playingText === text)
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }, [text])

  const onClick = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation()
    if (playing) {
      audio.pause()
      return
    }
    setLoading(true)
    setError(null)
    try {
      await speak(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? 'Dừng đọc' : 'Nghe câu này'}
      title={error ?? (playing ? 'Dừng' : 'Nghe')}
      className={
        'inline-flex h-7 w-7 flex-none items-center justify-center rounded-full border-0 transition-colors ' +
        (error ? 'bg-err-soft text-err' : playing ? 'bg-accent text-white' : `${idleBg} text-fg2 hover:bg-accent-soft hover:text-accent-text`) +
        ' ' +
        className
      }
    >
      {loading ? <Loader2 size={size - 1} className="animate-spin" /> : <Volume2 size={size} strokeWidth={2} />}
    </button>
  )
}
