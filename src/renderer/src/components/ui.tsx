// Các component nhỏ dùng chung: chip trạng thái, thanh tần suất, chọn tốc độ, thanh tiến độ, banner
import { Lightbulb } from 'lucide-react'
import type { LeechRescue } from '@shared/types'
import { freqLevel } from '../format'

export type Tone = 'blue' | 'learn' | 'known' | 'leech' | 'err' | 'accent' | 'teal' | 'neutral'

// Nền nhạt + chữ đậm màu (StatusChip trong handoff)
export const TONE_CLASS: Record<Tone, string> = {
  blue: 'bg-blue-soft text-blue',
  learn: 'bg-learn-soft text-learn',
  known: 'bg-known-soft text-known',
  leech: 'bg-leech-soft text-leech',
  err: 'bg-err-soft text-err',
  accent: 'bg-accent-soft text-accent-text',
  teal: 'bg-teal-soft text-teal',
  neutral: 'bg-surface2 text-fg3'
}

export function StatusChip({ tone, children, className = '' }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`chip ${TONE_CLASS[tone]} ${className}`}>{children}</span>
}

// 4 vạch cao dần 5/8/11/14px; vạch "tắt" màu line2
export function FreqMeter({ label, withText = true }: { label: string; withText?: boolean }) {
  const lvl = freqLevel(label)
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[5, 8, 11, 14].map((h, i) => (
          <span key={h} className="w-[3px] rounded-[2px]" style={{ height: h, background: i < lvl ? 'var(--text2)' : 'var(--line2)' }} />
        ))}
      </span>
      {withText && label}
    </span>
  )
}

export const RATES = [0.75, 0.9, 1, 1.1]

export function SpeedSegmented({ rate, onChange, small }: { rate: number; onChange: (r: number) => void; small?: boolean }) {
  return (
    <div role="group" aria-label="Tốc độ" className={'seg' + (small ? ' seg-sm' : '')}>
      {RATES.map((r) => (
        <button key={r} type="button" className="seg-btn" aria-pressed={rate === r} onClick={() => onChange(r)}>
          {r}×
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({ value, color = 'var(--accent)', track = 'var(--surface2)', height = 8 }: { value: number; color?: string; track?: string; height?: number }) {
  return (
    <div className="overflow-hidden rounded-full" style={{ height, background: track }}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  )
}

// Thanh chạy qua lại khi không biết % (ví dụ AI đang viết)
export function IndeterminateBar({ color = 'var(--accent)', track = 'var(--surface)' }: { color?: string; track?: string }) {
  return (
    <div className="h-1 overflow-hidden rounded-full" style={{ background: track }}>
      <div className="bar-indeterminate h-full rounded-full" style={{ background: color }} />
    </div>
  )
}

// Gợi ý phím tắt
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

// Nhãn người nói A / B / N
export function SpeakerBadge({ speaker, size = 26 }: { speaker: 'A' | 'B' | 'N'; size?: number }) {
  const cls = speaker === 'A' ? 'bg-accent-soft text-accent-text' : speaker === 'B' ? 'bg-teal-soft text-teal' : 'bg-surface2 text-fg2'
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full font-sans text-xs font-bold ${cls}`}
      style={{ width: size, height: size }}
    >
      {speaker}
    </span>
  )
}

// Ô "Mẹo nhớ" + "Vì sao hay quên" cho từ hay quên (LeechBox)
export function LeechBox({ rescue, open = false }: { rescue: LeechRescue; open?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-leech-soft px-[18px] py-4">
      <span className="flex items-start gap-2.5">
        <Lightbulb size={18} className="mt-0.5 flex-none text-leech" />
        <span>
          <strong className="text-leech">Mẹo nhớ:</strong> {rescue.memory_hook}
        </span>
      </span>
      <details open={open} className="pl-7">
        <summary className="cursor-pointer text-[13px] font-semibold text-fg2">Vì sao hay quên từ này?</summary>
        <div className="flex flex-col gap-1.5 pt-2 text-sm text-fg2">
          {rescue.why_hard && <span>{rescue.why_hard}</span>}
          {rescue.explain && <span>{rescue.explain}</span>}
          {rescue.confusables.map((c, i) => (
            <span key={i} className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-fg">{c.text}</span>
              <span className="text-fg3">↔</span>
              <span>{c.difference}</span>
            </span>
          ))}
        </div>
      </details>
    </div>
  )
}
