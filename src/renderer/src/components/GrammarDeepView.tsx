import { useState } from 'react'
import { Check, ChevronDown, Headphones, Play, X } from 'lucide-react'
import type { GrammarDeep, GrammarQuiz, Sentence } from '@shared/types'

interface Props {
  deep: GrammarDeep
  sentences: Sentence[]
  onPlay: (s: Sentence) => void
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// Câu ví dụ: nếu là câu trong bài thì có nút ▶ nghe lại
function ExampleRow({ ex, sentences, onPlay, last }: { ex: { en: string; vi: string }; sentences: Sentence[]; onPlay: (s: Sentence) => void; last: boolean }) {
  const s = sentences.find((x) => norm(x.text) === norm(ex.en))
  return (
    <div className={'flex items-start gap-3.5 px-[18px] py-3.5 ' + (last ? '' : 'border-b border-line')}>
      {s?.audioUrl ? (
        <button type="button" aria-label="Nghe lại câu trong bài" onClick={() => onPlay(s)} className="round-btn h-8 w-8 text-accent hover:text-accent">
          <Play size={12} fill="currentColor" strokeWidth={0} />
        </button>
      ) : (
        <span className="h-8 w-8 flex-none" />
      )}
      <div className="flex flex-col">
        <span className="font-serif text-lg">{ex.en}</span>
        <span className="text-sm text-fg3">{ex.vi}</span>
      </div>
    </div>
  )
}

// Ví dụ nhỏ trong phần giải thích (nền surface2)
function InlineExample({ ex }: { ex: { en: string; vi: string } }) {
  return (
    <span className="rounded-[10px] bg-surface2 px-3.5 py-2.5 font-serif text-[17px]">
      {ex.en} {ex.vi && <span className="font-sans text-sm text-fg3">→ {ex.vi}</span>}
    </span>
  )
}

// Bài kiểm tra trắc nghiệm: chọn đáp án → hiện đúng/sai + giải thích ngay (QuizOption theo handoff)
function Quiz({ items, title }: { items: GrammarQuiz[]; title: string }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => items.map(() => null))
  const done = picked.filter((p) => p !== null).length
  const correct = picked.filter((p, i) => p === items[i].answer).length
  const finished = done === items.length
  const reset = (): void => setPicked(items.map(() => null))

  return (
    <section className="flex flex-col gap-3.5">
      {finished ? (
        <div className="card flex flex-wrap items-center justify-between gap-3.5 px-5 py-[18px]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[17px] font-bold">{title}</span>
            <span className="text-sm text-fg2">
              Đúng{' '}
              <strong style={{ color: correct === items.length ? 'var(--known)' : 'var(--text)' }}>
                {correct}/{items.length}
              </strong>
              {correct === items.length ? ' — bạn đã nắm được điểm ngữ pháp này' : ' — xem lại giải thích ở các câu sai nhé'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div aria-hidden="true" className="flex gap-1">
              {items.map((q, i) => {
                const ok = picked[i] === q.answer
                return (
                  <span
                    key={i}
                    className={'flex h-6 w-6 items-center justify-center rounded-md ' + (ok ? 'bg-known-soft text-known' : 'bg-err-soft text-err')}
                  >
                    {ok ? <Check size={14} strokeWidth={2.6} /> : <X size={14} strokeWidth={2.6} />}
                  </span>
                )
              })}
            </div>
            <button type="button" className="btn btn-secondary btn-sm h-[34px] font-medium" onClick={reset}>
              Làm lại
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="m-0 text-lg font-bold">{title}</h3>
          {done > 0 ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-fg2">
                Đúng <strong className="text-fg">{correct}/{done}</strong> · còn {items.length - done} câu
              </span>
              <button type="button" className="btn btn-secondary btn-xs" onClick={reset}>
                Làm lại
              </button>
            </div>
          ) : (
            <span className="text-sm text-fg3">{items.length} câu</span>
          )}
        </div>
      )}

      {items.map((q, i) => {
        const p = picked[i]
        return (
          <div key={i} className="card flex flex-col gap-3 p-[18px]">
            <span className="font-serif text-[17px]">
              <span className="mr-2 font-sans text-[13px] text-fg3">{i + 1}.</span>
              {q.question}
            </span>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-2">
              {q.options.map((o, k) => {
                const isAnswer = k === q.answer
                const isPicked = k === p
                let cls = 'border border-line2 bg-surface text-fg hover:border-accent'
                if (p !== null) {
                  if (isPicked && isAnswer) cls = 'border-[1.5px] border-known bg-known-soft font-semibold text-fg'
                  else if (isPicked) cls = 'border-[1.5px] border-err bg-err-soft font-semibold text-fg'
                  else if (isAnswer) cls = 'border-[1.5px] border-dashed border-known bg-surface text-fg'
                  else cls = 'border border-line2 bg-surface text-fg3'
                }
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={isPicked}
                    disabled={p !== null}
                    onClick={() => setPicked((old) => old.map((v, j) => (j === i ? k : v)))}
                    className={'flex min-h-11 items-center justify-between gap-2 rounded-[10px] px-3.5 py-2 text-left disabled:cursor-default ' + cls}
                  >
                    <span>{o}</span>
                    {p !== null && isPicked && isAnswer && <Check size={18} strokeWidth={2.4} className="flex-none text-known" />}
                    {p !== null && isPicked && !isAnswer && <X size={18} strokeWidth={2.4} className="flex-none text-err" />}
                  </button>
                )
              })}
            </div>
            {p !== null && (
              <span className="text-sm" style={{ color: p === q.answer ? 'var(--known)' : 'var(--err)' }}>
                <strong>{p === q.answer ? 'Đúng.' : 'Chưa đúng.'}</strong> <span className="text-fg2">{q.explain}</span>
              </span>
            )}
          </div>
        )
      })}
    </section>
  )
}

// Trang ngữ pháp theo mẫu British Council LearnEnglish: ví dụ → kiểm tra → giải thích → kiểm tra lại
export default function GrammarDeepView({ deep, sentences, onPlay }: Props) {
  return (
    <>
      {deep.examples.length > 0 && (
        <section className="flex flex-col gap-3.5">
          <h3 className="m-0 text-lg font-bold">Xem các ví dụ</h3>
          <div className="card flex flex-col">
            {deep.examples.map((ex, i) => (
              <ExampleRow key={i} ex={ex} sentences={sentences} onPlay={onPlay} last={i === deep.examples.length - 1} />
            ))}
          </div>
        </section>
      )}

      {deep.test1.length > 0 && <Quiz items={deep.test1} title="Thử trước khi đọc giải thích" />}

      {deep.sections.length > 0 && (
        <section className="flex flex-col gap-[22px]">
          <h3 className="m-0 text-lg font-bold">Giải thích</h3>
          {deep.sections.map((sec, i) => (
            <div key={i} className="flex flex-col gap-2">
              <h4 className="m-0 text-base font-semibold">
                <span className="mr-2 text-accent-text">{i + 1}</span>
                {sec.heading}
              </h4>
              {sec.body && <p className="m-0 text-fg2">{sec.body}</p>}
              {sec.bullets.length > 0 && (
                <ul className="m-0 list-disc pl-5 text-fg2">
                  {sec.bullets.map((b, k) => (
                    <li key={k}>{b}</li>
                  ))}
                </ul>
              )}
              {sec.examples.map((ex, k) => (
                <InlineExample key={k} ex={ex} />
              ))}
            </div>
          ))}
        </section>
      )}

      {deep.table && (
        <section className="flex flex-col gap-3.5">
          <h3 className="m-0 text-lg font-bold">{deep.table.caption || 'Tóm tắt'}</h3>
          <div className="overflow-x-auto rounded-[14px] border border-line bg-surface">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface2 text-left">
                  {deep.table.headers.map((h, i) => (
                    <th key={i} scope="col" className={'px-4 py-3 ' + (i === 0 ? 'font-semibold text-fg3' : 'font-bold')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deep.table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {r.map((c, k) =>
                      k === 0 ? (
                        <th key={k} scope="row" className="px-4 py-3 text-left font-medium text-fg3">
                          {c}
                        </th>
                      ) : (
                        <td key={k} className="px-4 py-3">
                          {c}
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {deep.mistakes.length > 0 && (
        <section className="flex flex-col gap-3.5">
          <h3 className="m-0 text-lg font-bold">Lỗi hay gặp</h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-3">
            {deep.mistakes.map((m, i) => (
              <div key={i} className="card flex flex-col gap-2 px-[18px] py-4">
                <span className="flex items-baseline gap-2.5">
                  <span className="font-bold text-err">✗</span>
                  <span className="font-serif text-[17px] text-fg3 line-through">{m.wrong}</span>
                </span>
                <span className="flex items-baseline gap-2.5">
                  <span className="font-bold text-known">✓</span>
                  <span className="font-serif text-[17px]">{m.right}</span>
                </span>
                <span className="text-sm text-fg2">{m.why}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {deep.listening_tip && (
        <section className="flex items-start gap-4 rounded-2xl bg-accent-soft px-6 py-[22px]">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-accent text-white">
            <Headphones size={20} strokeWidth={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="m-0 text-base font-bold text-accent-text">Mẹo nghe</h3>
            <p className="m-0">{deep.listening_tip}</p>
          </div>
        </section>
      )}

      {deep.test2.length > 0 && <Quiz items={deep.test2} title="Kiểm tra lại" />}

      {deep.deep_dive.trim() && (
        <details className="details-clean card px-[18px]">
          <summary className="flex h-[52px] cursor-pointer items-center justify-between font-semibold">
            Đọc thêm — hiểu sâu hơn
            <ChevronDown size={18} className="chev text-fg3" />
          </summary>
          <div className="flex flex-col gap-3 pb-4 text-fg2">
            {deep.deep_dive
              .split(/\n\s*\n/)
              .filter((p) => p.trim())
              .map((p, i) => (
                <p key={i} className="m-0">
                  {p.trim()}
                </p>
              ))}
          </div>
        </details>
      )}
    </>
  )
}
