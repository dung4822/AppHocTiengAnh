import { Play, SkipBack, SkipForward, Square } from 'lucide-react'
import type { Sentence } from '@shared/types'
import type { Player } from '../usePlayer'
import { SpeedSegmented } from './ui'

// Bộ điều khiển trình phát dùng chung cho 3 kiểu hiển thị (lớn · thanh gọn · thanh đáy)
export interface PlayerCtl {
  sentences: Sentence[]
  player: Player
  currentIdx: number // câu đang phát, hoặc câu sẽ phát khi bấm ▶
  playingAll: boolean // đang phát nhiều câu liên tiếp (cả bài)
  toggle: () => void
  prev: () => void
  next: () => void
  playFromIndex: (i: number) => void
}

const SPEAKER_NAME = { A: 'Người nói A', B: 'Người nói B', N: 'Người kể' }

function segColor(ctl: PlayerCtl, i: number): string {
  const s = ctl.sentences[i]
  if (!s.audioUrl) return 'var(--line)'
  if (ctl.player.isPlaying && i <= ctl.currentIdx) return 'var(--accent)'
  return 'var(--line2)'
}

// Dải chấm mỗi câu một chấm (bấm để phát từ câu đó)
function Dots({ ctl, gap = 5, base = 8, active = 14 }: { ctl: PlayerCtl; gap?: number; base?: number; active?: number }) {
  return (
    <div
      role="group"
      aria-label={`Tiến độ: câu ${ctl.currentIdx + 1} trên ${ctl.sentences.length}`}
      className="grid items-center"
      style={{ gridTemplateColumns: `repeat(${ctl.sentences.length}, minmax(0, 1fr))`, gap }}
    >
      {ctl.sentences.map((s, i) => (
        <button
          key={s.id}
          type="button"
          aria-label={`Phát từ câu ${i + 1}`}
          disabled={!s.audioUrl}
          onClick={() => ctl.playFromIndex(i)}
          className="flex h-4 items-center disabled:cursor-default"
        >
          <span
            className="block w-full rounded-full transition-[height,background-color]"
            style={{
              height: i === ctl.currentIdx && ctl.player.isPlaying ? active : base,
              background: i === ctl.currentIdx && !ctl.player.isPlaying ? 'var(--accent-soft)' : segColor(ctl, i)
            }}
          />
        </button>
      ))}
    </div>
  )
}

// ===== Trình phát lớn (bước 1 · Nghe) =====
export function BigPlayer({ ctl }: { ctl: PlayerCtl }) {
  const { player, sentences, currentIdx } = ctl
  const n = sentences.length
  const cur = sentences[currentIdx]
  const sp = cur?.speaker ?? 'A'
  const spCls = sp === 'A' ? 'bg-accent-soft text-accent-text' : sp === 'B' ? 'bg-teal-soft text-teal' : 'bg-surface2 text-fg2'
  const spDot = sp === 'A' ? 'var(--accent)' : sp === 'B' ? 'var(--teal)' : 'var(--text3)'
  const noAudio = sentences.every((s) => !s.audioUrl)

  return (
    <section aria-label="Trình phát" className="flex flex-col gap-6 rounded-[18px] border border-line bg-surface p-7 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] text-fg3">{player.isPlaying ? 'Đang phát câu' : 'Bắt đầu từ câu'}</span>
          <span className="text-[22px] font-bold tracking-[-0.02em]">{currentIdx + 1}</span>
          <span className="text-[13px] text-fg3">/ {n}</span>
        </div>
        {player.isPlaying && (
          <span className={`chip px-2.5 py-1 text-[13px] ${spCls}`}>
            <span
              className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] text-surface"
              style={{ background: spDot }}
            >
              {sp}
            </span>
            {SPEAKER_NAME[sp]}
          </span>
        )}
      </div>

      <Dots ctl={ctl} />

      <div className="flex items-center gap-3 font-mono text-xs text-fg3">
        <span>{currentIdx + 1}</span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface2">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${((currentIdx + (player.isPlaying ? 1 : 0)) / n) * 100}%` }} />
        </div>
        <span>{n} câu</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <button type="button" aria-label="Câu trước" onClick={ctl.prev} className="round-btn h-11 w-11 bg-transparent">
            <SkipBack size={18} fill="currentColor" strokeWidth={1.6} />
          </button>
          <button type="button" onClick={ctl.toggle} disabled={noAudio} className="btn btn-ink h-14 rounded-full pl-[18px] pr-6 text-[15px]">
            {player.isPlaying ? <Square size={18} fill="currentColor" strokeWidth={0} /> : <Play size={20} fill="currentColor" strokeWidth={0} />}
            {player.isPlaying ? 'Dừng' : currentIdx === 0 ? 'Phát cả bài' : 'Phát tiếp'}
          </button>
          <button type="button" aria-label="Câu sau" onClick={ctl.next} className="round-btn h-11 w-11 bg-transparent">
            <SkipForward size={18} fill="currentColor" strokeWidth={1.6} />
          </button>
        </div>
        <SpeedSegmented rate={player.rate} onChange={player.setRate} />
      </div>
      <span className="text-center text-xs text-fg3">
        {player.error ? <span className="text-err">{player.error}</span> : player.isPlaying && ctl.playingAll ? 'Đang phát cả bài — nghỉ ngắn giữa các câu' : 'Bấm vào một chấm để phát từ câu đó'}
      </span>
    </section>
  )
}

// ===== Thanh nghe lại gọn (bước 2 · Trả lời) =====
export function CompactPlayer({ ctl }: { ctl: PlayerCtl }) {
  const { player, sentences } = ctl
  return (
    <div className="card flex flex-wrap items-center gap-3.5 px-4 py-3">
      <button
        type="button"
        aria-label={player.isPlaying ? 'Dừng' : 'Phát cả bài'}
        onClick={ctl.toggle}
        className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ink text-onink"
      >
        {player.isPlaying ? <Square size={13} fill="currentColor" strokeWidth={0} /> : <Play size={14} fill="currentColor" strokeWidth={0} />}
      </button>
      <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
        <span className="text-xs text-fg3">
          {player.isPlaying ? `Đang phát câu ${ctl.currentIdx + 1}/${sentences.length}` : `Nghe lại · ${sentences.length} câu`}
        </span>
        <Dots ctl={ctl} gap={3} base={5} active={9} />
      </div>
      <SpeedSegmented rate={player.rate} onChange={player.setRate} small />
    </div>
  )
}

// ===== Thanh phát dính đáy trang (bước 4 · Script) =====
export function FooterPlayer({ ctl, children }: { ctl: PlayerCtl; children?: React.ReactNode }) {
  const { player, sentences } = ctl
  return (
    <footer aria-label="Trình phát" className="flex flex-none flex-wrap items-center gap-x-5 gap-y-4 border-t border-line bg-surface px-7 py-3">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Câu trước" onClick={ctl.prev} className="flex h-9 w-9 items-center justify-center rounded-full text-fg2 hover:bg-surface2">
          <SkipBack size={16} fill="currentColor" strokeWidth={1.6} />
        </button>
        <button
          type="button"
          aria-label={player.isPlaying ? 'Dừng' : 'Phát cả bài'}
          onClick={ctl.toggle}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-onink"
        >
          {player.isPlaying ? <Square size={16} fill="currentColor" strokeWidth={0} /> : <Play size={16} fill="currentColor" strokeWidth={0} />}
        </button>
        <button type="button" aria-label="Câu sau" onClick={ctl.next} className="flex h-9 w-9 items-center justify-center rounded-full text-fg2 hover:bg-surface2">
          <SkipForward size={16} fill="currentColor" strokeWidth={1.6} />
        </button>
      </div>
      <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
        <div className="flex justify-between text-xs text-fg3">
          <span>
            {player.isPlaying
              ? `Đang phát câu ${ctl.currentIdx + 1} / ${sentences.length}${ctl.playingAll ? ' · Phát cả bài' : ''}`
              : `${sentences.length} câu · bấm ▶ để phát cả bài`}
          </span>
          {player.error && <span className="text-err">{player.error}</span>}
        </div>
        <Dots ctl={ctl} gap={3} base={5} active={9} />
      </div>
      <SpeedSegmented rate={player.rate} onChange={player.setRate} small />
      {children}
    </footer>
  )
}
