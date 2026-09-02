import { useRef, useState } from 'react'
import { Page } from '../components/AppShell'
import { Button, Input, Segmented, Select, Switch, cn } from '../components/ui'
import { updateNotificationPrefs, updateSettings, wipeAllData } from '../db/actions'
import { db } from '../db/db'
import { seedSampleWorkspace } from '../db/seed'
import { useSettings } from '../db/queries'
import { permissionState, requestNotificationPermission } from '../lib/notify'
import { ACCENTS } from '../lib/accents'
import { useInstall } from '../lib/pwa'
import type { AccentKey } from '../db/types'
import { useUI } from '../store/ui'

function Row({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-line py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <div className="text-body text-ink">{title}</div>
        {description && (
          <p className="mt-0.5 max-w-md text-micro leading-relaxed text-muted">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card px-4 py-1">
      <h2 className="label-micro border-b border-line py-3">{title}</h2>
      {children}
    </section>
  )
}

export function Settings() {
  const settings = useSettings()
  const toast = useUI((s) => s.toast)
  const fileRef = useRef<HTMLInputElement>(null)
  const [permission, setPermission] = useState(permissionState())
  const prefs = settings.notifications

  const exportData = async () => {
    const payload = {
      orbit: 1,
      exportedAt: new Date().toISOString(),
      projects: await db.projects.toArray(),
      tasks: await db.tasks.toArray(),
      meetings: await db.meetings.toArray(),
      notes: await db.notes.toArray(),
      activity: await db.activity.toArray(),
      settings: await db.settings.toArray(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orbit-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('Exported')
  }

  const importData = async (file: File) => {
    const text = await file.text()
    const data = JSON.parse(text)
    if (!data.orbit) {
      toast('That does not look like an Orbit export')
      return
    }
    await db.transaction(
      'rw',
      [db.projects, db.tasks, db.meetings, db.notes, db.activity],
      async () => {
        await Promise.all([
          db.projects.clear(),
          db.tasks.clear(),
          db.meetings.clear(),
          db.notes.clear(),
          db.activity.clear(),
        ])
        await db.projects.bulkAdd(data.projects ?? [])
        await db.tasks.bulkAdd(data.tasks ?? [])
        await db.meetings.bulkAdd(data.meetings ?? [])
        await db.notes.bulkAdd(data.notes ?? [])
        await db.activity.bulkAdd(data.activity ?? [])
      },
    )
    toast('Imported')
  }

  return (
    <Page title="Settings" subtitle="Everything stays on this device.">
      <div className="flex flex-col gap-5">
        <Section title="Appearance">
          <Row title="Theme">
            <Segmented
              value={settings.theme}
              onChange={(theme) => void updateSettings({ theme })}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'Auto' },
              ]}
            />
          </Row>
          <Row
            title="Accent colour"
            description="Used for anything the app itself highlights. Projects keep their own colour on top of this."
          >
            <AccentPicker
              value={settings.accent}
              onChange={(accent) => void updateSettings({ accent })}
            />
          </Row>
          <Row
            title="Reading typeface"
            description="Departure Mono is a pixel font — lovely for the interface. If long notes read better in a system sans, switch just the note body."
          >
            <Segmented
              value={settings.readingFont}
              onChange={(readingFont) => void updateSettings({ readingFont })}
              options={[
                { value: 'mono', label: 'Departure' },
                { value: 'sans', label: 'System' },
              ]}
            />
          </Row>
        </Section>

        <Section title="Reminders">
          <Row
            title="Notifications"
            description={
              permission === 'granted'
                ? 'Reminders fire while Orbit is open. Install it as an app to keep it running in the background.'
                : permission === 'denied'
                  ? 'Blocked by the browser — enable notifications for this site in your browser settings.'
                  : 'Orbit needs permission from your browser first.'
            }
          >
            {permission === 'granted' ? (
              <Switch
                checked={prefs.enabled}
                label="Enable notifications"
                onChange={(enabled) => void updateNotificationPrefs({ enabled })}
              />
            ) : (
              <Button
                size="sm"
                disabled={permission === 'denied' || permission === 'unsupported'}
                onClick={async () => {
                  const result = await requestNotificationPermission()
                  setPermission(permissionState())
                  if (result === 'granted') void updateNotificationPrefs({ enabled: true })
                }}
              >
                Allow
              </Button>
            )}
          </Row>

          <div className={cn(!prefs.enabled && 'pointer-events-none opacity-50')}>
            <Row title="Morning digest" description="What today holds, once each morning.">
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="h-10 w-[150px] sm:h-8 sm:w-[122px]"
                  value={prefs.digestTime}
                  onChange={(e) => void updateNotificationPrefs({ digestTime: e.target.value })}
                />
                <Switch
                  checked={prefs.dailyDigest}
                  label="Daily digest"
                  onChange={(dailyDigest) => void updateNotificationPrefs({ dailyDigest })}
                />
              </div>
            </Row>
            <Row title="Meeting reminders" description="A heads-up before each meeting starts.">
              <div className="flex items-center gap-2">
                <Select
                  className="h-10 w-[100px] sm:h-8 sm:w-[92px]"
                  value={String(prefs.meetingLeadMin)}
                  onChange={(e) =>
                    void updateNotificationPrefs({ meetingLeadMin: Number(e.target.value) })
                  }
                >
                  {[5, 10, 15, 30].map((n) => (
                    <option key={n} value={n}>
                      {n} min
                    </option>
                  ))}
                </Select>
                <Switch
                  checked={prefs.meetingReminders}
                  label="Meeting reminders"
                  onChange={(meetingReminders) =>
                    void updateNotificationPrefs({ meetingReminders })
                  }
                />
              </div>
            </Row>
            <Row
              title="Due-soon nudge"
              description="Mid-afternoon, only when something is genuinely still open."
            >
              <Switch
                checked={prefs.dueSoon}
                label="Due soon"
                onChange={(dueSoon) => void updateNotificationPrefs({ dueSoon })}
              />
            </Row>
            <Row
              title="Welcome back note"
              description="After a couple of quiet days, an honest summary rather than a guilt trip."
            >
              <Switch
                checked={prefs.reengage}
                label="Re-engagement"
                onChange={(reengage) => void updateNotificationPrefs({ reengage })}
              />
            </Row>
          </div>
        </Section>

        <Section title="Focus">
          <Row title="Focus interval">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={120}
                className="h-10 w-[76px] sm:h-8 sm:w-[72px]"
                value={settings.focusMinutes}
                onChange={(e) =>
                  void updateSettings({ focusMinutes: Math.max(1, Number(e.target.value)) })
                }
              />
              <span className="text-micro text-faint">min</span>
            </div>
          </Row>
          <Row title="Break interval">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={60}
                className="h-10 w-[76px] sm:h-8 sm:w-[72px]"
                value={settings.breakMinutes}
                onChange={(e) =>
                  void updateSettings({ breakMinutes: Math.max(1, Number(e.target.value)) })
                }
              />
              <span className="text-micro text-faint">min</span>
            </div>
          </Row>
        </Section>

        <InstallSection />

        <Section title="Your data">
          <Row
            title="Export"
            description="Everything as a single JSON file — projects, tasks, meetings, notes, history."
          >
            <Button size="sm" onClick={() => void exportData()}>
              Export
            </Button>
          </Row>
          <Row title="Import" description="Replaces what is here with the contents of an export.">
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void importData(file)
                  e.target.value = ''
                }}
              />
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                Import
              </Button>
            </>
          </Row>
          <Row title="Load the sample workspace" description="Four projects with realistic work, to try things out.">
            <Button
              size="sm"
              onClick={async () => {
                await seedSampleWorkspace()
                toast('Sample workspace loaded')
              }}
            >
              Load
            </Button>
          </Row>
          <Row title="Delete everything" description="Irreversible. Export first if you are unsure.">
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                if (!window.confirm('Delete every project, task, meeting and note? This cannot be undone.'))
                  return
                await wipeAllData()
                toast('All data deleted')
              }}
            >
              Delete
            </Button>
          </Row>
        </Section>

        <Section title="About">
          <Row title="Orbit" description="A local-first work command center. No account, no server — everything lives in this browser's storage on this device.">
            <span className="text-micro text-faint">v0.1</span>
          </Row>
          <Row
            title="Departure Mono"
            description="Typeface by Helena Zhang, licensed under the SIL Open Font License 1.1."
          >
            <a
              href="/fonts/DepartureMono-OFL.txt"
              target="_blank"
              rel="noreferrer"
              className="text-micro uppercase track-wide text-accent-ink underline underline-offset-2"
            >
              License
            </a>
          </Row>
        </Section>
      </div>
    </Page>
  )
}

/**
 * Install is a browser affordance, and every browser exposes it differently:
 * Chrome hands us a deferred prompt, Safari has none and needs instructions.
 */
function InstallSection() {
  const { canPrompt, install, installed, ios } = useInstall()
  const toast = useUI((s) => s.toast)

  return (
    <Section title="Install">
      <Row
        title={installed ? 'Orbit is installed' : 'Install Orbit'}
        description={
          installed
            ? 'Running as an app. Reminders keep working in the background and it opens without browser chrome.'
            : ios
              ? 'In Safari: tap Share, then "Add to Home Screen".'
              : canPrompt
                ? 'Adds Orbit to your home screen or dock, opens without browser chrome, and keeps reminders running.'
                : 'Your browser has not offered an install yet. It usually appears after a couple of visits, or from the browser menu ("Install app" / "Add to Home Screen").'
        }
      >
        {installed ? (
          <span className="text-micro uppercase track-wide text-good">✓ Installed</span>
        ) : (
          <Button
            size="sm"
            variant={canPrompt ? 'primary' : 'secondary'}
            disabled={!canPrompt}
            onClick={async () => {
              const outcome = await install()
              if (outcome === 'accepted') toast('Installing Orbit…')
            }}
          >
            Install
          </Button>
        )}
      </Row>
      <Row
        title="Offline"
        description="The whole app is cached and all your data is local, so Orbit works with no connection at all — including the first launch after installing."
      >
        <span className="text-micro uppercase track-wide text-muted">Always</span>
      </Row>
      <Row
        title="Updates"
        description="A new version is downloaded in the background. Orbit asks before reloading rather than doing it mid-sentence."
      >
        <span className="text-micro uppercase track-wide text-muted">On reload</span>
      </Row>
    </Section>
  )
}

function AccentPicker({
  value,
  onChange,
}: {
  value: AccentKey
  onChange: (next: AccentKey) => void
}) {
  return (
    <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-1.5">
      {ACCENTS.map(({ key, label }) => {
        const selected = key === value
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => onChange(key)}
            className={cn(
              `accent-${key}`,
              'grid h-9 w-9 place-items-center rounded-md border-2 transition-transform sm:h-7 sm:w-7',
              selected ? 'border-ink' : 'border-transparent active:scale-95 sm:hover:scale-110',
            )}
            style={{ background: 'var(--accent)' }}
          >
            {selected && (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
                <path
                  d="M3 8.5 6.3 11.5 13 4.8"
                  fill="none"
                  stroke="var(--c-bg)"
                  strokeWidth="2.4"
                  strokeLinecap="square"
                />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}

