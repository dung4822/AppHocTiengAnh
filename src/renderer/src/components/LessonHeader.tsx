import { Check, ChevronLeft, Trash2 } from 'lucide-react'
import type { LessonDetail } from '@shared/types'
import { formatRelative } from '../format'

export type Step = 1 | 2 | 3 | 4 | 5
export const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Nghe' },
  { n: 2, label: 'Trả lời' },
  { n: 3, label: 'Kết quả' },
  { n: 4, label: 'Script' },
  { n: 5, label: 'Ngữ pháp' }
]

interface Props {
  lesson: LessonDetail
  step: Step
  doneSteps: Set<number>
  onStep: (s: Step) => void
  onBack: () => void
  onDelete: () => void
}

// Thanh trên cùng của bài học: ← Trang chủ · tên bài · meta · xóa · stepper 5 bước
export default function LessonHeader({ lesson, step, doneSteps, onStep, onBack, onDelete }: Props) {
  return (
    <header className="flex flex-none flex-col gap-3.5 border-b border-line bg-surface px-7 pt-3.5">
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={onBack} className="btn btn-ghost h-9 gap-1 pl-1.5 pr-2.5">
          <ChevronLeft size={18} strokeWidth={2} />
          Trang chủ
        </button>
        <div className="flex min-w-[240px] flex-1 flex-col">
          <h1 className="m-0 font-serif text-xl font-semibold tracking-[-0.01em]">{lesson.title}</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-fg3">
            <span>{formatRelative(lesson.createdAt)}</span>
            <span>{lesson.topic}</span>
            <span>Level {lesson.level}</span>
            <span>
              Ngữ pháp: {lesson.grammarName}
              {lesson.isGrammarReview ? ' (bài ôn)' : ''}
            </span>
            {lesson.knownRatio !== null && <span className="font-semibold text-known">{Math.round(lesson.knownRatio * 100)}% từ quen</span>}
          </div>
        </div>
        <button type="button" aria-label="Xóa bài này" title="Xóa bài này" onClick={onDelete} className="icon-btn hover:text-err">
          <Trash2 size={17} strokeWidth={1.8} />
        </button>
      </div>
      <nav aria-label="Các bước bài học" className="flex gap-1 overflow-x-auto">
        {STEPS.map((s) => {
          const isCur = s.n === step
          const isDone = doneSteps.has(s.n) && !isCur
          return (
            <button
              key={s.n}
              type="button"
              aria-current={isCur ? 'step' : undefined}
              onClick={() => onStep(s.n)}
              className={
                'flex flex-[1_0_auto] items-center gap-2 border-b-2 px-3 pb-3 pt-2.5 transition-colors ' +
                (isCur ? 'border-accent font-semibold text-fg' : 'border-transparent font-medium hover:text-fg ' + (isDone ? 'text-fg2' : 'text-fg3'))
              }
            >
              <span
                className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-bold"
                style={{
                  background: isCur ? 'var(--accent)' : isDone ? 'var(--accent-soft)' : 'transparent',
                  color: isCur ? '#fff' : isDone ? 'var(--accent-text)' : 'var(--text3)',
                  border: `1px solid ${isCur || isDone ? 'transparent' : 'var(--line2)'}`
                }}
              >
                {isDone ? <Check size={12} strokeWidth={3} /> : s.n}
              </span>
              <span>{s.label}</span>
            </button>
          )
        })}
      </nav>
    </header>
  )
}
