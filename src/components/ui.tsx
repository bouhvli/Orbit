import clsx, { type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import type { Health, Priority } from '../db/types'

/**
 * Later classes win. Without this a per-instance `w-[110px]` silently loses to a
 * base `w-full`, because Tailwind emits both and source order decides.
 * The custom scales from index.css are registered so they conflict correctly.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'body', 'head', 'display', 'jumbo'] }],
      rounded: [{ rounded: ['card'] }],
    },
  },
})

export const cn = (...parts: ClassValue[]) => twMerge(clsx(parts))

/* ------------------------------------------------------------------ buttons */

type Variant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger'
type Size = 'sm' | 'md' | 'lg'

/**
 * Buttons read as underlined links, colour-coded by intent rather than boxed.
 * No fills or borders — the only chrome is the underline, in the accent.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'text-accent decoration-accent hover:text-accent-ink hover:decoration-accent-ink',
  secondary: 'text-ink decoration-accent hover:text-accent',
  ghost: 'text-muted decoration-muted/50 hover:text-accent hover:decoration-accent',
  quiet: 'text-faint decoration-transparent hover:text-accent hover:decoration-accent',
  danger: 'text-bad decoration-bad/60 hover:decoration-bad',
}

/**
 * Height carries the touch target; horizontal padding stays small so the
 * underline hugs the label instead of floating inside a phantom box.
 */
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-1 text-micro gap-1.5 sm:h-7',
  md: 'h-10 px-1 text-body gap-2 sm:h-9',
  lg: 'h-12 px-1.5 text-body gap-2 sm:h-11',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap underline decoration-2 underline-offset-4 transition-[color,text-decoration-color] duration-100 active:translate-y-px disabled:pointer-events-none disabled:no-underline disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}

export function IconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40 sm:h-8 sm:w-8',
        className,
      )}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------- chrome */

export function Pill({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad'
  className?: string
}) {
  const tones = {
    neutral: 'bg-surface-2 text-muted border-line',
    accent: 'bg-accent-soft text-accent-ink border-transparent',
    good: 'bg-good-soft text-good border-transparent',
    warn: 'bg-warn-soft text-warn border-transparent',
    bad: 'bg-bad-soft text-bad border-transparent',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-micro leading-[1.5] track-wide uppercase',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export const HEALTH_LABEL: Record<Health, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  stalled: 'Stalled',
}

export function HealthDot({ health, className }: { health: Health; className?: string }) {
  const colour = { 'on-track': 'bg-good', 'at-risk': 'bg-warn', stalled: 'bg-bad' }[health]
  return (
    <span
      title={HEALTH_LABEL[health]}
      className={cn('inline-block h-[7px] w-[7px] shrink-0', colour, className)}
    />
  )
}

export function PriorityMark({ priority }: { priority: Priority }) {
  if (priority === 'med') return null
  const isHigh = priority === 'high'
  return (
    <span
      title={isHigh ? 'High priority' : 'Low priority'}
      className={cn('text-micro leading-none', isHigh ? 'text-bad' : 'text-faint')}
    >
      {isHigh ? '!!' : '↓'}
    </span>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm border border-line bg-surface-2 px-1 text-micro leading-none text-muted">
      {children}
    </kbd>
  )
}

/* -------------------------------------------------------------------- inputs */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="label-micro mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-micro text-faint">{hint}</span>}
    </label>
  )
}

const controlBase =
  'w-full rounded-md border border-line bg-surface px-2.5 text-body text-ink transition-colors placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlBase, 'h-11 sm:h-9', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(controlBase, 'resize-y py-2 leading-relaxed', className)} {...props} />
  )
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        controlBase,
        'h-11 cursor-pointer appearance-none bg-no-repeat pr-7 sm:h-9',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23999' d='M2 4h6L5 7z'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.6rem center',
      }}
      {...props}
    />
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; title?: string }[]
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'no-scrollbar inline-flex max-w-full items-center gap-px overflow-x-auto rounded-md border border-line bg-surface-2 p-px',
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          title={o.title}
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'shrink-0 whitespace-nowrap rounded-sm px-2.5 py-1.5 text-micro uppercase track-wide transition-colors sm:px-2 sm:py-1',
            value === o.value
              ? 'bg-surface text-ink shadow-[1px_1px_0_var(--c-border)]'
              : 'text-faint hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  className,
  size = 17,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  className?: string
  size?: number
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      style={{ width: size, height: size }}
      className={cn(
        'tap group relative grid shrink-0 place-items-center rounded-sm border transition-colors duration-100',
        checked ? 'border-accent bg-accent' : 'border-line-strong hover:border-accent',
        className,
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className={cn(
          'h-[70%] w-[70%] transition-opacity duration-100',
          checked ? 'animate-pop opacity-100' : 'opacity-0 group-hover:opacity-40',
        )}
        aria-hidden
      >
        <path
          d="M3 8.5 6.3 11.5 13 4.8"
          fill="none"
          stroke={checked ? 'var(--c-bg)' : 'var(--c-muted)'}
          strokeWidth="2.2"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
    </button>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'tap relative h-5 w-9 shrink-0 rounded-sm border transition-colors duration-150',
        checked ? 'border-accent bg-accent' : 'border-line-strong bg-surface-2',
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-[1px] transition-[left] duration-150',
          checked ? 'left-[19px] bg-canvas' : 'left-[2px] bg-line-strong',
        )}
      />
    </button>
  )
}

/* ------------------------------------------------------------------- overlay */

const DialogCtx = createContext<() => void>(() => {})
export const useDialogClose = () => useContext(DialogCtx)

export function Overlay({
  open,
  onClose,
  children,
  placement = 'center',
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  /**
   * Where the panel sits on a large screen. On a phone everything except
   * `top` becomes a bottom sheet, because that is where thumbs are.
   */
  placement?: 'center' | 'top' | 'right' | 'bottom'
  labelledBy?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = window.setTimeout(() => {
      const target = ref.current?.querySelector<HTMLElement>(
        '[data-autofocus], input, textarea, button',
      )
      target?.focus()
    }, 20)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      window.clearTimeout(focusTimer)
    }
  }, [open, onClose])

  if (!open) return null

  const sheet = placement !== 'top'
  const box = {
    // full-height side panel on a desktop, bottom sheet on a phone
    right:
      'mt-auto max-h-[92dvh] w-full rounded-t-xl border-t sm:mt-0 sm:ml-auto sm:h-full sm:max-h-none sm:max-w-xl sm:rounded-none sm:border-t-0 sm:border-l',
    bottom:
      'mt-auto max-h-[92dvh] w-full rounded-t-xl border-t sm:m-auto sm:max-h-full sm:max-w-md sm:rounded-md sm:border sm:shadow-hard',
    center:
      'mt-auto max-h-[92dvh] w-full rounded-t-xl border-t sm:m-auto sm:max-h-full sm:max-w-lg sm:rounded-md sm:border sm:shadow-hard',
    // capture and search stay at the top, under the thumb's reach but next to the keyboard
    top: 'mx-auto w-full max-w-2xl self-start rounded-b-xl border-b sm:mt-[9vh] sm:rounded-md sm:border sm:shadow-hard',
  }[placement]

  return createPortal(
    <DialogCtx.Provider value={onClose}>
      <div
        className={cn('fixed inset-0 z-50 flex', placement === 'right' ? 'p-0' : 'p-0 sm:p-4')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div
          className="animate-fade absolute inset-0 bg-[rgb(31_28_23/0.32)] dark:bg-[rgb(0_0_0/0.62)]"
          onClick={onClose}
        />
        <div
          ref={ref}
          className={cn(
            'relative flex max-h-full flex-col overflow-hidden border-line-strong bg-surface',
            sheet ? 'animate-sheet sm:animate-rise' : 'animate-rise',
            box,
          )}
        >
          {sheet && (
            <div className="flex shrink-0 justify-center pt-2 sm:hidden" aria-hidden>
              <span className="h-1 w-9 rounded-full bg-line-strong" />
            </div>
          )}
          {children}
        </div>
      </div>
    </DialogCtx.Provider>,
    document.body,
  )
}

export function DialogHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  const close = useDialogClose()
  const id = useId()
  return (
    <header className="flex items-start gap-2 border-b border-line px-4 py-3">
      <div className="min-w-0 flex-1">
        <h2 id={id} className="truncate text-body text-ink">
          {title}
        </h2>
        {subtitle && <div className="label-micro mt-1 truncate">{subtitle}</div>}
      </div>
      {actions}
      <IconButton label="Close" onClick={close}>
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden>
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </IconButton>
    </header>
  )
}

/* -------------------------------------------------------------------- states */

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string
  body?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="text-body text-ink">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-micro leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function SectionLabel({
  children,
  count,
  className,
}: {
  children: ReactNode
  count?: number
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <h2 className="label-micro">{children}</h2>
      {count !== undefined && (
        <span className="tabular text-micro text-faint">[{count}]</span>
      )}
    </div>
  )
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-sm bg-surface-2', className)}>
      <div
        className="h-full bg-accent transition-[width] duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  )
}

/** Block-character bar, e.g. the week's momentum strip. */
export function BlockBar({ level }: { level: number }) {
  const blocks = ['·', '▁', '▂', '▃', '▅', '▆', '▇', '█']
  const idx = Math.max(0, Math.min(blocks.length - 1, Math.round(level * (blocks.length - 1))))
  return <span aria-hidden>{blocks[idx]}</span>
}
