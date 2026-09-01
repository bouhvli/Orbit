import { useState } from 'react'
import { updateSettings } from '../db/actions'
import { seedSampleWorkspace } from '../db/seed'
import { useSettings } from '../db/queries'
import { Button, Kbd, Overlay, cn } from './ui'
import { IconOrbit } from './icons'

const LINES = [
  { k: 'Today', v: 'What is actually due, and what you are walking into.' },
  { k: 'Projects', v: 'Tasks, meetings and notes for one body of work, together.' },
  { k: 'Focus', v: 'One task, a timer, and nothing else.' },
]

export function Onboarding() {
  const settings = useSettings()
  const [busy, setBusy] = useState(false)

  if (settings.onboarded) return null

  const finish = async (withSample: boolean) => {
    setBusy(true)
    if (withSample) await seedSampleWorkspace()
    await updateSettings({ onboarded: true })
    setBusy(false)
  }

  return (
    <Overlay open onClose={() => void finish(false)}>
      <div className="flex flex-col gap-5 px-5 py-5">
        <div className="flex items-center gap-2.5">
          <IconOrbit className="h-6 w-6 text-accent" />
          <span className="text-head uppercase tracking-[0.16em]">Orbit</span>
        </div>

        <p className="text-body leading-relaxed text-muted">
          One place for the work you are juggling. Open it and you know what to do next — no feed,
          no inbox, nothing to scroll.
        </p>

        <dl className="flex flex-col gap-2 border-y border-line py-3">
          {LINES.map((l) => (
            <div key={l.k} className="flex gap-3">
              <dt className="w-[76px] shrink-0 text-micro uppercase track-wide text-accent-ink">
                {l.k}
              </dt>
              <dd className="min-w-0 flex-1 text-micro leading-relaxed text-muted">{l.v}</dd>
            </div>
          ))}
        </dl>

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-micro text-faint">
          <span className="flex items-center gap-1">
            <Kbd>C</Kbd> capture anything
          </span>
          <span className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd> search everything
          </span>
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={() => void finish(false)}>
            Start empty
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            className={cn(busy && 'opacity-60')}
            onClick={() => void finish(true)}
          >
            Explore with sample work
          </Button>
        </div>

        <p className="text-micro leading-relaxed text-faint">
          Everything is stored in this browser on this device. No account, no server. You can export
          it all as JSON at any time from Settings.
        </p>
      </div>
    </Overlay>
  )
}
