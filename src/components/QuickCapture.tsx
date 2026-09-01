import { useMemo, useRef, useState } from 'react'
import { createTask, deleteTask } from '../db/actions'
import { useProjects } from '../db/queries'
import { captureHint, parseCapture } from '../lib/parse'
import { useUI } from '../store/ui'
import { Kbd, Overlay, cn } from './ui'
import { IconPlus } from './icons'

const SYNTAX = [
  { token: '#project', meaning: 'file it' },
  { token: '!high', meaning: 'priority' },
  { token: 'tomorrow', meaning: 'due date' },
  { token: 'every week', meaning: 'repeat' },
]

function useCapture(onDone?: () => void) {
  const projects = useProjects()
  const [value, setValue] = useState('')
  const toast = useUI((s) => s.toast)
  const parsed = useMemo(() => parseCapture(value, projects), [value, projects])
  const hints = captureHint(parsed)

  const submit = async () => {
    if (!parsed.title.trim()) return
    const task = await createTask({
      title: parsed.title,
      projectId: parsed.projectId,
      priority: parsed.priority ?? 'med',
      due: parsed.due,
      recurrence: parsed.recurrence,
    })
    toast(
      `Captured${parsed.projectName ? ` in ${parsed.projectName}` : ''}${parsed.dueLabel ? ` · ${parsed.dueLabel}` : ''}`,
      { label: 'Undo', run: () => void deleteTask(task.id) },
    )
    setValue('')
    onDone?.()
  }

  return { value, setValue, parsed, hints, submit }
}

function HintRow({ hints }: { hints: string[] }) {
  if (hints.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-micro text-faint">
        {SYNTAX.map((s) => (
          <span key={s.token} className="whitespace-nowrap">
            <span className="text-muted">{s.token}</span> {s.meaning}
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-micro">
      <span className="text-faint">→</span>
      {hints.map((h) => (
        <span
          key={h}
          className="rounded-sm border border-accent/30 bg-accent-soft px-1.5 py-px text-accent-ink"
        >
          {h}
        </span>
      ))}
    </div>
  )
}

/** The always-there capture bar at the top of Today. */
export function QuickCaptureBar() {
  const inputRef = useRef<HTMLInputElement>(null)
  const { value, setValue, hints, submit } = useCapture()
  const [focused, setFocused] = useState(false)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className={cn(
        'rounded-card border bg-surface transition-colors',
        focused ? 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-line',
      )}
    >
      <div className="flex items-center gap-2 px-3">
        <IconPlus className={cn('h-4 w-4 shrink-0', focused ? 'text-accent' : 'text-faint')} />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Capture anything…"
          aria-label="Quick capture"
          className="h-11 flex-1 bg-transparent text-body outline-none placeholder:text-faint"
        />
        {value ? (
          <button
            type="submit"
            className="shrink-0 px-1 text-micro uppercase track-wide text-accent underline decoration-2 underline-offset-4"
          >
            Add
          </button>
        ) : (
          <span className="hidden shrink-0 items-center gap-1 sm:flex">
            <Kbd>C</Kbd>
          </span>
        )}
      </div>
      {(focused || value) && (
        <div className="border-t border-line px-3 py-2">
          <HintRow hints={hints} />
        </div>
      )}
    </form>
  )
}

/** Same capture, as a modal, for the `c` shortcut anywhere in the app. */
export function QuickCaptureModal() {
  const open = useUI((s) => s.quickAddOpen)
  const setOpen = useUI((s) => s.setQuickAdd)
  const { value, setValue, hints, submit } = useCapture(() => setOpen(false))

  return (
    <Overlay open={open} onClose={() => setOpen(false)} placement="top">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="flex items-center gap-2.5 px-4">
          <IconPlus className="h-4 w-4 shrink-0 text-accent" />
          <input
            data-autofocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Capture anything…"
            aria-label="Quick capture"
            className="h-14 flex-1 bg-transparent text-body outline-none placeholder:text-faint"
          />
          <Kbd>↵</Kbd>
        </div>
        <div className="border-t border-line px-4 py-2.5">
          <HintRow hints={hints} />
        </div>
      </form>
    </Overlay>
  )
}
