import { Check, CircleAlert, X } from 'lucide-react'
import { useApp } from '../appState'

// Toast: pill nền mực ở giữa đáy (thành công) · thẻ góc phải dưới (lỗi)
export default function Toaster() {
  const { toasts, dismissToast } = useApp()
  const ok = toasts.find((t) => t.kind === 'ok')
  const err = toasts.find((t) => t.kind === 'error')
  return (
    <>
      {ok && (
        <div
          role="status"
          className="toast-pill fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-full bg-ink py-2.5 pl-4 pr-4 text-[13px] font-medium text-onink shadow-pop"
        >
          <Check size={16} strokeWidth={2.4} />
          {ok.title}
          {ok.action && (
            <button
              type="button"
              onClick={() => {
                ok.action!.onClick()
                dismissToast(ok.id)
              }}
              className="ml-1 rounded-full border-0 bg-onink/15 px-3 py-1 font-[inherit] text-[13px] font-semibold text-onink hover:bg-onink/25"
            >
              {ok.action.label}
            </button>
          )}
        </div>
      )}
      {err && (
        <div
          role="alert"
          className="fade-up fixed bottom-6 right-6 z-50 flex w-[min(380px,calc(100%-48px))] gap-3 rounded-[14px] border border-line2 bg-surface px-4 py-3.5 shadow-pop"
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-err-soft text-err">
            <CircleAlert size={16} strokeWidth={2} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-semibold">{err.title}</span>
            {err.body && <span className="text-[13px] text-fg2">{err.body}</span>}
            {err.action && (
              <button
                type="button"
                onClick={() => {
                  err.action!.onClick()
                  dismissToast(err.id)
                }}
                className="mt-1 self-start border-0 bg-transparent p-0 font-[inherit] text-[13px] font-semibold text-accent-text underline"
              >
                {err.action.label}
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => dismissToast(err.id)}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-md border-0 bg-transparent text-fg3 hover:bg-surface2"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      )}
    </>
  )
}
