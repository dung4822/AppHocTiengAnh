import { useEffect, useState } from 'react'
import { Check, Lightbulb, Plus, X } from 'lucide-react'
import type { LookupContext, LookupResult } from '@shared/types'
import { api, call, errMsg } from '../api'
import { FreqMeter } from './ui'

interface Props {
  term: string
  ctx?: LookupContext
  onClose?: () => void
  // embedded = nằm trong panel khác (chi tiết thẻ): bỏ nút đóng và padding
  embedded?: boolean
  onSaved?: () => void
}

const SOURCE_LABEL: Record<LookupResult['source'], string> = {
  lesson: 'Nghĩa trong bài này',
  cache: 'Đã tra trước đây (không tốn API)',
  api: 'Vừa tra bằng AI'
}

// Panel tra từ: nghĩa, cụm hay đi kèm, mức tần suất (tính local) và nút "Lưu thành thẻ"
export default function LookupPanel({ term, ctx, onClose, embedded, onSaved }: Props) {
  const [result, setResult] = useState<LookupResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setResult(null)
    setSaveMsg(null)
    call(api.lookup(term, ctx))
      .then((r) => !cancelled && setResult(r))
      .catch((e) => !cancelled && setError(errMsg(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, ctx?.lessonId, ctx?.sentenceId])

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const r = await call(api.saveLookupAsCard(result?.term ?? term, ctx))
      setSaveMsg(r.alreadyExisted ? 'Từ này đã có trong thẻ rồi (không tạo thêm).' : null)
      setResult((old) => (old ? { ...old, savedVocabId: r.vocabId } : old))
      onSaved?.()
    } catch (e) {
      setSaveMsg(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={'flex flex-col gap-5 ' + (embedded ? '' : 'px-[22px] pb-7 pt-6')}>
      <div className="flex flex-col gap-2.5">
        <div className={'flex items-start justify-between gap-3 ' + (embedded ? 'hidden' : '')}>
          <div className="flex min-w-0 flex-col gap-0.5">
            {!embedded && <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg3">Tra từ</span>}
            <span className="break-words font-serif text-[26px] font-semibold leading-tight tracking-[-0.015em]">{result?.term ?? term}</span>
          </div>
          {!embedded && onClose && (
            <button
              type="button"
              aria-label="Đóng panel tra từ"
              onClick={onClose}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border-0 bg-surface2 text-fg2 hover:text-fg"
            >
              <X size={16} strokeWidth={2} />
            </button>
          )}
        </div>
        {result && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="chip chip-outline">
              <FreqMeter label={result.frequencyLabel} />
            </span>
            {result.cefr && <span className="chip chip-outline font-mono">{result.cefr}</span>}
            <span className="chip bg-surface2 font-normal text-fg3">{SOURCE_LABEL[result.source]}</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex flex-col gap-3" aria-label="Đang tra">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-surface2" />
          ))}
        </div>
      )}
      {error && <p className="m-0 rounded-[10px] bg-err-soft px-3.5 py-3 text-[13px] text-err">{error}</p>}

      {result && (
        <>
          <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
            {result.meanings.map((m, i) => (
              <li key={i} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2.5">
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface2 text-xs font-bold text-fg2">{i + 1}</span>
                <div className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-[15px] font-semibold">{m.meaning_vi}</strong>
                    {result.source === 'lesson' && i === 0 && (
                      <span className="chip bg-accent-soft px-2 py-px text-[11px] text-accent-text">nghĩa trong bài</span>
                    )}
                  </span>
                  {m.example_en && <span className="font-serif text-[15px]">{m.example_en}</span>}
                  {m.example_vi && <span className="text-[13px] text-fg3">{m.example_vi}</span>}
                </div>
              </li>
            ))}
          </ol>

          {result.collocations.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.04em] text-fg3">Hay đi với</span>
              <div className="flex flex-col overflow-hidden rounded-[10px] border border-line">
                {result.collocations.map((c, i) => (
                  <div key={i} className={'flex justify-between gap-3 px-3 py-2 ' + (i ? 'border-t border-line' : '')}>
                    <span className="font-serif font-medium">{c.text}</span>
                    <span className="text-right text-[13px] text-fg3">{c.vi}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.noteVi && (
            <div className="flex gap-2.5 rounded-[10px] bg-learn-soft px-3.5 py-3 text-[13px]">
              <Lightbulb size={16} className="mt-0.5 flex-none text-learn" />
              <span>{result.noteVi}</span>
            </div>
          )}

          {result.savedVocabId ? (
            <div className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-known-soft font-semibold text-known">
              <Check size={16} strokeWidth={2.4} />
              Đã có trong thẻ từ vựng
            </div>
          ) : (
            <button type="button" className="btn btn-primary w-full" onClick={save} disabled={saving}>
              <Plus size={16} strokeWidth={2.4} />
              {saving ? 'Đang lưu…' : 'Lưu thành thẻ'}
            </button>
          )}
          {saveMsg && <p className="m-0 text-[13px] text-fg3">{saveMsg}</p>}
        </>
      )}
    </div>
  )
}
