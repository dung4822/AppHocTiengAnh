import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowUp, Check, GripHorizontal, MessageCircle, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type { ChatExpression, ChatReply, ChatTurn } from '@shared/types'
import { api, call, errMsg } from '../api'
import { useApp } from '../appState'
import LookupPanel from './LookupPanel'
import SpeakButton, { prefetchSpeech } from './SpeakButton'

// =====================================================================
// TRỢ LÝ CHAT NỔI: nút tròn luôn nổi trên mọi trang, kéo thả được (kéo nút hoặc thanh tiêu đề).
// Hỏi "ý này tiếng Anh nói sao?" → 1–2 cách người bản xứ hay dùng nhất + ví dụ có loa đọc + lưu thành thẻ.
// Gõ một từ tiếng Anh → tra từ như panel tra từ (có cache, lưu thẻ).
// =====================================================================

type Msg =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; reply: ChatReply }
  | { id: number; role: 'error'; text: string; retry: string }

const FAB = 52 // đường kính nút
const MARGIN = 16
const STORE_MSGS = 'chat:messages'
const STORE_POS = 'chat:pos'
const MAX_STORED = 40

const SUGGESTIONS = ['"Tư duy sâu" tiếng Anh nói sao?', 'Cách tiếp cận trực diện', 'overwhelmed']

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* localStorage không dùng được thì bỏ qua */
  }
}

// Vị trí lưu theo khoảng cách tới mép PHẢI/DƯỚI → phóng to/thu nhỏ cửa sổ nút vẫn bám góc
interface Pos {
  right: number
  bottom: number
}
function clampPos(p: Pos): Pos {
  const maxR = Math.max(MARGIN, window.innerWidth - FAB - MARGIN)
  const maxB = Math.max(MARGIN, window.innerHeight - FAB - MARGIN)
  return { right: Math.min(maxR, Math.max(MARGIN, p.right)), bottom: Math.min(maxB, Math.max(MARGIN, p.bottom)) }
}

// Bản chữ gọn của một lượt trả lời, gửi kèm câu hỏi sau để AI hiểu "cái thứ 2", "cho thêm ví dụ"...
function replyAsText(r: ChatReply): string {
  if (r.kind === 'lookup') return `Looked up the word "${r.term}".`
  if (r.kind === 'answer') return r.answerVi
  return 'Suggested: ' + r.expressions.map((e) => `"${e.text}" (${e.meaningVi})`).join('; ')
}

export default function ChatWidget() {
  const { refresh } = useApp()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos>(() => clampPos(load(STORE_POS, { right: 24, bottom: 24 })))
  const [messages, setMessages] = useState<Msg[]>(() => load<Msg[]>(STORE_MSGS, []))
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nextId = useRef(Date.now())

  useEffect(() => store(STORE_MSGS, messages.slice(-MAX_STORED)), [messages])

  // Cửa sổ đổi kích thước → kéo nút vào lại trong màn hình
  useEffect(() => {
    const onResize = (): void => setPos((p) => clampPos(p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ----- Kéo thả: dùng chung cho nút tròn và thanh tiêu đề của khung chat -----
  const drag = useRef<{ x: number; y: number; start: Pos; moved: boolean } | null>(null)
  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* không bắt được con trỏ thì vẫn kéo được khi chuột còn trên phần tử */
    }
    drag.current = { x: e.clientX, y: e.clientY, start: pos, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 5) return // rung tay nhẹ vẫn tính là bấm
    d.moved = true
    setPos(clampPos({ right: d.start.right - dx, bottom: d.start.bottom - dy }))
  }
  const onPointerUp = (toggle: boolean) => (): void => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.moved) store(STORE_POS, pos)
    else if (toggle) setOpen((o) => !o)
  }

  // Esc đóng khung chat
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    inputRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Tin nhắn mới → cuộn xuống cuối
  useLayoutEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, busy, open])

  const send = useCallback(
    async (text: string) => {
      const q = text.trim()
      if (!q || busy) return
      const history: ChatTurn[] = messages.flatMap((m): ChatTurn[] =>
        m.role === 'user' ? [{ role: 'user', text: m.text }] : m.role === 'assistant' ? [{ role: 'assistant', text: replyAsText(m.reply) }] : []
      )
      setMessages((ms) => [...ms.filter((m) => m.role !== 'error'), { id: nextId.current++, role: 'user', text: q }])
      setInput('')
      setBusy(true)
      try {
        const reply = await call(api.askChat(q, history))
        setMessages((ms) => [...ms, { id: nextId.current++, role: 'assistant', reply }])
        // Tạo sẵn audio các câu ví dụ ở nền (giọng offline, miễn phí) → bấm loa là phát ngay
        // (câu đầu của mỗi cách trước — đó là câu mặc định của thẻ; mỗi câu mất vài giây trên CPU)
        if (reply.kind === 'express') {
          const firsts = reply.expressions.map((e) => e.examples[0]?.en).filter(Boolean) as string[]
          const rest = reply.expressions.flatMap((e) => e.examples.slice(1).map((x) => x.en))
          prefetchSpeech([...firsts, ...rest])
        }
      } catch (e) {
        setMessages((ms) => [...ms, { id: nextId.current++, role: 'error', text: errMsg(e), retry: q }])
      } finally {
        setBusy(false)
      }
    },
    [busy, messages]
  )

  const markSaved = (msgId: number, exprIdx: number, vocabId: number): void => {
    setMessages((ms) =>
      ms.map((m) =>
        m.id === msgId && m.role === 'assistant' && m.reply.kind === 'express'
          ? {
              ...m,
              reply: { ...m.reply, expressions: m.reply.expressions.map((e, i) => (i === exprIdx ? { ...e, savedVocabId: vocabId } : e)) }
            }
          : m
      )
    )
    refresh()
  }

  // ----- Vị trí khung chat: mở ra phía trên nút, lệch về phía có nhiều chỗ hơn -----
  const vw = window.innerWidth
  const vh = window.innerHeight
  const panelW = Math.min(420, vw - MARGIN * 2)
  const panelH = Math.min(640, vh - MARGIN * 2)
  const fabLeft = vw - pos.right - FAB
  const fabTop = vh - pos.bottom - FAB
  const onRightHalf = fabLeft + FAB / 2 > vw / 2
  let panelLeft = onRightHalf ? fabLeft + FAB - panelW : fabLeft
  let panelTop = fabTop - panelH - 12
  if (panelTop < MARGIN) panelTop = fabTop + FAB + 12 // không đủ chỗ phía trên → mở xuống dưới
  if (panelTop + panelH > vh - MARGIN) panelTop = fabTop + FAB - panelH // cũng không đủ → phủ lên chỗ nút tròn
  panelTop = Math.max(MARGIN, panelTop)
  panelLeft = Math.min(vw - panelW - MARGIN, Math.max(MARGIN, panelLeft))

  return (
    <>
      {open && (
        <section
          aria-label="Trợ lý tiếng Anh"
          className="fade-up fixed z-[45] flex flex-col overflow-hidden rounded-[18px] border border-line2 bg-surface text-fg shadow-pop"
          style={{ left: panelLeft, top: panelTop, width: panelW, height: panelH }}
        >
          <header
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp(false)}
            className="flex flex-none cursor-grab touch-none select-none items-center gap-2.5 border-b border-line px-4 py-3 active:cursor-grabbing"
          >
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text">
              <MessageCircle size={17} strokeWidth={2} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold leading-tight">Trợ lý diễn đạt</span>
              <span className="truncate text-xs text-fg3">Hỏi "ý này nói sao?" hoặc gõ từ cần tra</span>
            </div>
            <GripHorizontal size={16} className="flex-none text-fg3" aria-hidden="true" />
            {messages.length > 0 && (
              <button
                type="button"
                aria-label="Xóa cuộc trò chuyện"
                title="Xóa cuộc trò chuyện"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setMessages([])}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border-0 bg-transparent text-fg3 hover:bg-surface2 hover:text-fg"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              type="button"
              aria-label="Đóng trợ lý"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border-0 bg-surface2 text-fg2 hover:text-fg"
            >
              <X size={16} />
            </button>
          </header>

          <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !busy && (
              <div className="flex flex-col gap-3 py-2">
                <p className="m-0 text-[13px] text-fg2">
                  Bạn muốn nói một ý mà chưa biết diễn đạt? Gõ bằng tiếng Việt, mình gợi ý 1–2 cách người bản xứ hay dùng nhất, có ví dụ đọc
                  được thành tiếng và lưu thành thẻ ôn.
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => void send(s)} className="chip chip-outline cursor-pointer font-normal hover:bg-surface2">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="max-w-[85%] self-end whitespace-pre-wrap rounded-[14px] rounded-br-[4px] bg-ink px-3.5 py-2 text-onink">
                  {m.text}
                </div>
              ) : m.role === 'error' ? (
                <div key={m.id} className="flex flex-col gap-2 rounded-[12px] bg-err-soft px-3.5 py-3 text-[13px] text-err">
                  <span>{m.text}</span>
                  <button type="button" onClick={() => void send(m.retry)} className="btn btn-secondary btn-xs self-start">
                    <RotateCcw size={14} />
                    Thử lại
                  </button>
                </div>
              ) : (
                <AssistantReply key={m.id} reply={m.reply} onSaved={(i, vocabId) => markSaved(m.id, i, vocabId)} onSavedLookup={refresh} />
              )
            )}

            {busy && (
              <div className="flex items-center gap-1.5 self-start rounded-[14px] bg-surface2 px-4 py-3" aria-label="Đang trả lời">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg3" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            )}
          </div>

          <form
            className="flex flex-none items-end gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              maxLength={500}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void send(input)
                }
              }}
              placeholder='Ví dụ: "đi thẳng vào vấn đề" nói sao?'
              className="input max-h-28 min-h-[42px] flex-1 resize-none py-2.5"
            />
            <button type="submit" aria-label="Gửi" disabled={!input.trim() || busy} className="btn btn-primary h-[42px] w-[42px] flex-none p-0">
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          </form>
        </section>
      )}

      {/* Đang mở thì ẩn nút tròn (đóng bằng nút X trên tiêu đề / Esc) → không đè lên ô nhập khi cửa sổ thấp */}
      {!open && (
      <button
        type="button"
        aria-label="Mở trợ lý diễn đạt (kéo để di chuyển)"
        title="Trợ lý diễn đạt — bấm để mở, kéo để di chuyển"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
        className="fixed z-[45] flex touch-none select-none items-center justify-center rounded-full border-0 bg-accent text-white shadow-pop transition-[filter] hover:brightness-110"
        style={{ right: pos.right, bottom: pos.bottom, width: FAB, height: FAB }}
      >
        <MessageCircle size={24} strokeWidth={2} />
      </button>
      )}
    </>
  )
}

function AssistantReply({
  reply,
  onSaved,
  onSavedLookup
}: {
  reply: ChatReply
  onSaved: (exprIdx: number, vocabId: number) => void
  onSavedLookup: () => void
}) {
  if (reply.kind === 'answer') {
    return <div className="max-w-[92%] self-start whitespace-pre-wrap rounded-[14px] rounded-bl-[4px] bg-surface2 px-3.5 py-2.5">{reply.answerVi}</div>
  }
  if (reply.kind === 'lookup') {
    return (
      <div className="flex flex-col gap-2 rounded-[14px] border border-line p-3.5">
        <span className="font-serif text-[22px] font-semibold leading-tight">{reply.term}</span>
        <LookupPanel term={reply.term} embedded onSaved={onSavedLookup} />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      {reply.expressions.map((e, i) => (
        <ExpressionCard key={e.text} expr={e} rank={i + 1} onSaved={(vocabId) => onSaved(i, vocabId)} />
      ))}
      {reply.avoidVi && (
        <div className="flex gap-2.5 rounded-[12px] bg-learn-soft px-3.5 py-3 text-[13px]">
          <AlertTriangle size={16} className="mt-0.5 flex-none text-learn" />
          <span>{reply.avoidVi}</span>
        </div>
      )}
    </div>
  )
}

function ExpressionCard({ expr, rank, onSaved }: { expr: ChatExpression; rank: number; onSaved: (vocabId: number) => void }) {
  const [exampleIdx, setExampleIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const saved = expr.savedVocabId !== null

  const save = async (): Promise<void> => {
    setSaving(true)
    setNote(null)
    try {
      const r = await call(api.saveExpression({ text: expr.text, meaningVi: expr.meaningVi, usageVi: expr.usageVi, examples: expr.examples, exampleIdx }))
      if (r.alreadyExisted) setNote('Cụm này đã có trong thẻ rồi (không tạo thêm).')
      onSaved(r.vocabId)
    } catch (e) {
      setNote(errMsg(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-[14px] border border-line bg-surface p-3.5">
      <div className="flex items-start gap-2.5">
        <span className="mt-1 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-text">
          {rank}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="font-serif text-[20px] font-semibold leading-snug">{expr.text}</span>
            <SpeakButton text={expr.text} size={13} className="h-6 w-6" />
          </span>
          <strong className="font-semibold">{expr.meaningVi}</strong>
          {expr.usageVi && <span className="text-[13px] text-fg3">{expr.usageVi}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5" role={saved ? undefined : 'radiogroup'} aria-label="Câu ví dụ">
        {expr.examples.map((x, i) => {
          const selected = !saved && i === exampleIdx && expr.examples.length > 1
          return (
            <div
              key={i}
              role={saved ? undefined : 'radio'}
              aria-checked={saved ? undefined : i === exampleIdx}
              tabIndex={saved ? undefined : 0}
              onClick={() => !saved && setExampleIdx(i)}
              onKeyDown={(e) => !saved && (e.key === 'Enter' || e.key === ' ') && setExampleIdx(i)}
              className={
                'flex items-start gap-2 rounded-[10px] border px-3 py-2 ' +
                (selected ? 'border-accent bg-accent-soft/40' : 'border-transparent bg-surface2') +
                (saved ? '' : ' cursor-pointer')
              }
            >
              <SpeakButton text={x.en} size={13} className="mt-0.5 h-6 w-6" idleBg="bg-surface" />
              <div className="flex min-w-0 flex-col">
                <span className="font-serif text-[15px] leading-snug">{x.en}</span>
                {x.vi && <span className="text-[13px] text-fg3">{x.vi}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {saved ? (
        <div className="flex h-9 items-center justify-center gap-2 rounded-[10px] bg-known-soft text-[13px] font-semibold text-known">
          <Check size={15} strokeWidth={2.4} />
          Đã lưu thành thẻ ôn
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <button type="button" className="btn btn-primary btn-sm w-full" onClick={save} disabled={saving}>
            <Plus size={15} strokeWidth={2.4} />
            {saving ? 'Đang lưu và tạo audio…' : 'Lưu thành thẻ'}
          </button>
          {expr.examples.length > 1 && <span className="text-center text-xs text-fg3">Thẻ dùng câu ví dụ đang chọn (bấm vào câu để đổi)</span>}
        </div>
      )}
      {note && <p className="m-0 text-[13px] text-fg3">{note}</p>}
    </article>
  )
}
