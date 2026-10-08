import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

// Hook phát một danh sách file audio nối tiếp nhau (phát cả bài = phát lần lượt từng câu).
// Tốc độ dùng playbackRate của trình duyệt, không tạo lại audio.
// source: nơi nghe, để thống kê thời gian nghe (bài học / ôn tập / khác)
export function usePlayer(source: 'lesson' | 'review' | 'other' = 'other') {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const queueRef = useRef<{ urls: string[]; ids: number[]; pos: number } | null>(null)
  const timerRef = useRef<number | null>(null)
  const [rate, setRateState] = useState(1)
  const rateRef = useRef(1)
  const [playingId, setPlayingId] = useState<number | null>(null)
  // Số câu trong hàng đợi đang phát (1 = chỉ phát một câu, >1 = phát cả bài / một đoạn)
  const [queueLength, setQueueLength] = useState(0)
  const [error, setError] = useState<string | null>(null)

  if (!audioRef.current) audioRef.current = new Audio()

  const stop = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    queueRef.current = null
    audioRef.current?.pause()
    setPlayingId(null)
    setQueueLength(0)
  }, [])

  const playAt = useCallback(
    (pos: number) => {
      const q = queueRef.current
      const audio = audioRef.current!
      if (!q || pos >= q.urls.length) {
        queueRef.current = null
        setPlayingId(null)
        setQueueLength(0)
        return
      }
      q.pos = pos
      setPlayingId(q.ids[pos])
      audio.src = q.urls[pos]
      audio.defaultPlaybackRate = rateRef.current
      audio.playbackRate = rateRef.current
      audio.play().catch((e) => {
        setError('Không phát được audio: ' + String(e))
        stop()
      })
    },
    [stop]
  )

  // ===== Đo thời gian nghe THẬT: chỉ tính lúc audio đang phát (sự kiện playing → pause/ended) =====
  const playStartRef = useRef<number | null>(null)
  const pendingRef = useRef(0)
  useEffect(() => {
    const audio = audioRef.current!
    const onPlaying = (): void => {
      playStartRef.current = performance.now()
    }
    const onStop = (): void => {
      if (playStartRef.current !== null) {
        pendingRef.current += (performance.now() - playStartRef.current) / 1000
        playStartRef.current = null
      }
    }
    // Gửi về main định kỳ (mỗi 15 giây) và khi rời trang, để không mất nếu tắt app đột ngột
    const flush = (): void => {
      if (playStartRef.current !== null) {
        const now = performance.now()
        pendingRef.current += (now - playStartRef.current) / 1000
        playStartRef.current = now
      }
      if (pendingRef.current >= 1) {
        void api.addListeningTime(pendingRef.current, source)
        pendingRef.current = 0
      }
    }
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onStop)
    audio.addEventListener('ended', onStop)
    const timer = window.setInterval(flush, 15000)
    return () => {
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onStop)
      audio.removeEventListener('ended', onStop)
      window.clearInterval(timer)
      onStop()
      flush()
    }
  }, [source])

  useEffect(() => {
    const audio = audioRef.current!
    const onEnded = (): void => {
      const q = queueRef.current
      if (!q) return
      // Nghỉ ngắn giữa các câu cho tự nhiên
      timerRef.current = window.setTimeout(() => playAt(q.pos + 1), 350)
    }
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.pause()
    }
  }, [playAt])

  // items: danh sách { id, url } — id dùng để tô sáng câu đang phát
  // startId: bắt đầu từ câu có id này (mặc định câu đầu)
  const play = useCallback(
    (items: { id: number; url: string | null }[], startId?: number) => {
      stop()
      const valid = items.filter((i): i is { id: number; url: string } => !!i.url)
      if (valid.length === 0) {
        setError('Chưa có audio.')
        return
      }
      setError(null)
      queueRef.current = { urls: valid.map((v) => v.url), ids: valid.map((v) => v.id), pos: 0 }
      setQueueLength(valid.length)
      const start = startId === undefined ? 0 : Math.max(0, valid.findIndex((v) => v.id === startId))
      playAt(start)
    },
    [playAt, stop]
  )

  // Nhảy tới câu trước / sau trong hàng đợi đang phát
  const skip = useCallback(
    (delta: number) => {
      const q = queueRef.current
      if (!q) return
      if (timerRef.current) window.clearTimeout(timerRef.current)
      const next = Math.min(q.urls.length - 1, Math.max(0, q.pos + delta))
      playAt(next)
    },
    [playAt]
  )

  const setRate = useCallback((r: number) => {
    rateRef.current = r
    setRateState(r)
    if (audioRef.current) audioRef.current.playbackRate = r
  }, [])

  return { play, stop, skip, rate, setRate, playingId, queueLength, isPlaying: playingId !== null, error }
}

export type Player = ReturnType<typeof usePlayer>
