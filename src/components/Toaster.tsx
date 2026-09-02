import { createPortal } from 'react-dom'
import { useUI } from '../store/ui'

export function Toaster() {
  const toasts = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismissToast)
  if (toasts.length === 0) return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-21 z-60 flex flex-col items-center gap-2 px-4 lg:bottom-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-rise pointer-events-auto flex max-w-md items-center gap-3 rounded-md border border-line-strong bg-surface px-3 py-2 shadow-hard"
        >
          <span className="text-micro text-ink">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action?.run()
                dismiss(t.id)
              }}
              className="shrink-0 text-micro uppercase track-wide text-accent-ink underline underline-offset-2"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
            className="shrink-0 text-micro text-faint hover:text-ink"
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
