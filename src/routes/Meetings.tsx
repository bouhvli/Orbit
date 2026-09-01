import { useMemo, useState } from 'react'
import { Page } from '../components/AppShell'
import {
  Button,
  DialogHeader,
  EmptyState,
  Field,
  Input,
  Overlay,
  Pill,
  Segmented,
  Select,
  Textarea,
  cn,
} from '../components/ui'
import { IconMeetings, IconPlus } from '../components/icons'
import { createMeeting } from '../db/actions'
import { useProjects, useWorkspace } from '../db/queries'
import { addDays, dayLabel, isSameDay, timeLabel, toISODate, untilLabel, weekStart } from '../lib/date'
import { useUI } from '../store/ui'
import type { Meeting, Project } from '../db/types'

/* ------------------------------------------------------------------- dialog */

const defaultStart = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function NewMeetingDialog({
  open,
  onClose,
  defaultProjectId,
}: {
  open: boolean
  onClose: () => void
  defaultProjectId?: string | null
}) {
  const projects = useProjects()
  const openMeeting = useUI((s) => s.openMeeting)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId ?? '')
  const [start, setStart] = useState(defaultStart())
  const [durationMin, setDuration] = useState(30)
  const [attendees, setAttendees] = useState('')
  const [prep, setPrep] = useState('')

  return (
    <Overlay open={open} onClose={onClose}>
      <DialogHeader title="Schedule a meeting" subtitle="Prep and notes live with it" />
      <form
        className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto scroll-quiet px-4 py-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!title.trim()) return
          const meeting = await createMeeting({
            title,
            summary,
            projectId: projectId || null,
            start: new Date(start).getTime(),
            durationMin,
            attendees: attendees
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            prep,
          })
          setTitle('')
          setSummary('')
          setAttendees('')
          setPrep('')
          onClose()
          openMeeting(meeting.id)
        }}
      >
        <Field label="Title">
          <Input
            data-autofocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Migration cutover sync"
            required
          />
        </Field>
        <Field label="What this is about" hint="One line — it shows on Today.">
          <Input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Agree the cutover date and who owns the rollback call."
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Duration">
            <Select value={String(durationMin)} onChange={(e) => setDuration(Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120].map((n) => (
                <option key={n} value={n}>
                  {n} min
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Project">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Attendees">
            <Input
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="Sam, Priya"
            />
          </Field>
        </div>
        <Field label="Prep" hint="What do you need before this?">
          <Textarea rows={3} value={prep} onChange={(e) => setPrep(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!title.trim()}>
            Schedule
          </Button>
        </div>
      </form>
    </Overlay>
  )
}

/* -------------------------------------------------------------------- agenda */

function MeetingRow({
  meeting,
  project,
  showRelative,
}: {
  meeting: Meeting
  project?: Project
  showRelative?: boolean
}) {
  const openMeeting = useUI((s) => s.openMeeting)
  const past = meeting.start + meeting.durationMin * 60_000 < Date.now()

  return (
    <button
      type="button"
      onClick={() => openMeeting(meeting.id)}
      className={cn(
        project ? `accent-${project.accent}` : '',
        'group flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-2/70',
        past && 'opacity-60',
      )}
    >
      <span className="tabular w-14 shrink-0 text-body text-muted">
        {timeLabel(meeting.start)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-body text-ink">{meeting.title}</span>
          {showRelative && !past && (
            <span className="text-micro text-accent-ink">{untilLabel(meeting.start)}</span>
          )}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-micro text-faint">
          {project && (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="h-[7px] w-[7px] bg-accent" />
              {project.name}
            </span>
          )}
          <span>{meeting.summary || 'No agenda'}</span>
          {meeting.prep.trim() && !past && <Pill>prep ready</Pill>}
          {past && !meeting.notes.trim() && <Pill tone="warn">no notes</Pill>}
          {meeting.notes.trim() && <Pill tone="accent">notes</Pill>}
        </span>
      </span>
      <span className="tabular shrink-0 text-micro text-faint">{meeting.durationMin}m</span>
    </button>
  )
}

export function Meetings() {
  const { meetings, projectMap } = useWorkspace()
  const [scope, setScope] = useState<'week' | 'upcoming' | 'past'>('week')
  const [showNew, setShowNew] = useState(false)

  const week = useMemo(() => {
    const start = weekStart()
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i)
      return {
        day,
        items: meetings
          .filter((m) => isSameDay(m.start, day))
          .sort((a, b) => a.start - b.start),
      }
    })
  }, [meetings])

  const upcoming = meetings.filter((m) => m.start >= Date.now()).sort((a, b) => a.start - b.start)
  const past = meetings.filter((m) => m.start < Date.now()).sort((a, b) => b.start - a.start)
  const needNotes = past.filter((m) => !m.notes.trim()).length

  return (
    <Page
      title="Agenda"
      subtitle={`${upcoming.length} upcoming${needNotes ? ` · ${needNotes} without notes` : ''}`}
      actions={
        <>
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { value: 'week', label: 'Week' },
              { value: 'upcoming', label: 'Next' },
              { value: 'past', label: 'Past' },
            ]}
          />
          <Button variant="primary" onClick={() => setShowNew(true)}>
            <IconPlus className="h-4 w-4" />
            New
          </Button>
        </>
      }
    >
      {scope === 'week' && (
        <div className="flex flex-col gap-5">
          {week.map(({ day, items }) => {
            const isToday = toISODate(day) === toISODate(new Date())
            return (
              <div key={day.toISOString()}>
                <div className="mb-1 flex items-baseline gap-2 border-b border-line pb-1">
                  <span
                    className={cn(
                      'text-micro uppercase track-wide',
                      isToday ? 'text-accent-ink' : 'text-faint',
                    )}
                  >
                    {dayLabel(day)}
                  </span>
                  {isToday && <span className="text-micro text-accent">today</span>}
                  <span className="tabular ml-auto text-micro text-faint">
                    {items.length || ''}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="px-2 py-1.5 text-micro text-faint">Clear.</p>
                ) : (
                  items.map((m) => (
                    <MeetingRow
                      key={m.id}
                      meeting={m}
                      project={m.projectId ? projectMap.get(m.projectId) : undefined}
                      showRelative={isToday}
                    />
                  ))
                )}
              </div>
            )
          })}
        </div>
      )}

      {scope !== 'week' && (
        <div className="flex flex-col gap-1">
          {(scope === 'upcoming' ? upcoming : past).length === 0 ? (
            <EmptyState
              icon={<IconMeetings className="h-6 w-6" />}
              title={scope === 'upcoming' ? 'Nothing scheduled' : 'No past meetings'}
              body={
                scope === 'upcoming'
                  ? 'When you add one, its prep and notes live with it.'
                  : 'Past meetings and their notes will collect here.'
              }
            />
          ) : (
            (scope === 'upcoming' ? upcoming : past).map((m, i, arr) => {
              const prev = arr[i - 1]
              const newDay = !prev || !isSameDay(prev.start, m.start)
              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="label-micro mb-1 mt-3 border-b border-line pb-1">
                      {dayLabel(m.start)}
                    </div>
                  )}
                  <MeetingRow
                    meeting={m}
                    project={m.projectId ? projectMap.get(m.projectId) : undefined}
                  />
                </div>
              )
            })
          )}
        </div>
      )}

      <NewMeetingDialog open={showNew} onClose={() => setShowNew(false)} />
    </Page>
  )
}
