import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../components/AppShell'
import { QuickCaptureBar } from '../components/QuickCapture'
import { TaskRow } from '../components/TaskRow'
import { EmptyState, SectionLabel, cn } from '../components/ui'
import { IconArrowRight, IconMeetings, IconSpark } from '../components/icons'
import {
  completedToday,
  meetingsOn,
  todaysTasks,
  useSettings,
  useWorkspace,
} from '../db/queries'
import { addDays, dayLabel, toISODate, today, untilLabel, weekStart } from '../lib/date'
import { reengagementMessage } from '../lib/notify'
import { useUI } from '../store/ui'
import type { Meeting, Project, Task } from '../db/types'

/* ------------------------------------------------------------------ momentum */

function MomentumStrip({ tasks }: { tasks: Task[] }) {
  const settings = useSettings()
  const days = useMemo(() => {
    const start = weekStart()
    return Array.from({ length: 7 }, (_, i) => {
      const iso = toISODate(addDays(start, i))
      const count = tasks.filter((t) => t.completedAt && toISODate(t.completedAt) === iso).length
      return { iso, count, isToday: iso === today(), isFuture: iso > today() }
    })
  }, [tasks])

  const max = Math.max(1, ...days.map((d) => d.count))
  const weekTotal = days.reduce((sum, d) => sum + d.count, 0)
  const doneToday = days.find((d) => d.isToday)?.count ?? 0
  const blocks = ['▁', '▂', '▃', '▅', '▆', '▇', '█']

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-line bg-surface px-3 py-2">
      <div className="flex items-baseline gap-1.5">
        <span className="tabular text-head text-ink">{doneToday}</span>
        <span className="text-micro text-muted">done today</span>
      </div>

      <div className="flex items-end gap-[3px]" title="Tasks completed each day this week">
        {days.map((d) => (
          <span
            key={d.iso}
            className={cn(
              'w-[9px] text-center leading-none',
              d.count === 0 ? 'text-line-strong' : d.isToday ? 'text-accent' : 'text-muted',
              d.isFuture && 'opacity-40',
            )}
          >
            {d.count === 0 ? '·' : blocks[Math.min(6, Math.round((d.count / max) * 6))]}
          </span>
        ))}
      </div>

      <span className="text-micro text-muted">
        {weekTotal} this week
      </span>

      <span className="ml-auto flex items-center gap-1.5 text-micro text-muted">
        <IconSpark className="h-3.5 w-3.5 text-accent" />
        {settings.openStreak > 1 ? `${settings.openStreak}-day streak` : 'Day one'}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ meetings */

function MeetingLine({
  meeting,
  project,
  next,
}: {
  meeting: Meeting
  project?: Project
  next?: boolean
}) {
  const openMeeting = useUI((s) => s.openMeeting)
  const ended = meeting.start + meeting.durationMin * 60_000 < Date.now()
  const time = new Date(meeting.start)
  const hhmm = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`

  return (
    <button
      type="button"
      onClick={() => openMeeting(meeting.id)}
      className={cn(
        project ? `accent-${project.accent}` : '',
        'group flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-2/70',
        ended && 'opacity-55',
      )}
    >
      <span
        className={cn(
          'tabular mt-px w-14 shrink-0 text-body',
          next ? 'text-accent' : 'text-muted',
        )}
      >
        {hhmm}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-body text-ink">{meeting.title}</span>
          {next && !ended && (
            <span className="rounded-sm bg-accent-soft px-1.5 py-px text-micro uppercase track-wide text-accent-ink">
              {untilLabel(meeting.start)}
            </span>
          )}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-micro text-muted">
          {project && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] bg-accent" />
              {project.name}
            </span>
          )}
          {meeting.summary ? (
            <span className="text-faint">{meeting.summary}</span>
          ) : (
            <span className="text-faint italic">no agenda yet</span>
          )}
          {meeting.prep.trim() && <span className="text-accent-ink">prep ready</span>}
        </span>
      </span>
      <IconArrowRight className="mt-1 h-4 w-4 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

/* --------------------------------------------------------------------- today */

export function Today() {
  const { tasks, meetings, projects, projectMap } = useWorkspace()
  const settings = useSettings()
  const [welcomeBack, setWelcomeBack] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

  useEffect(() => {
    void reengagementMessage(settings).then(setWelcomeBack)
    // only on first settings load
  }, [settings.lastOpened])

  const t = today()
  const focusTasks = todaysTasks(tasks)
  const overdue = focusTasks.filter((task) => task.due && task.due < t)
  const dueNow = focusTasks.filter((task) => !task.due || task.due >= t)
  const doneToday = completedToday(tasks)
  const schedule = meetingsOn(meetings, t)
  const nextMeeting = schedule.find((m) => m.start + m.durationMin * 60_000 > Date.now())

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of dueNow) {
      const key = task.projectId ?? '__none'
      map.set(key, [...(map.get(key) ?? []), task])
    }
    const ordered = projects
      .filter((p) => map.has(p.id))
      .map((p) => ({ project: p as Project | undefined, items: map.get(p.id)! }))
    if (map.has('__none')) ordered.push({ project: undefined, items: map.get('__none')! })
    return ordered
  }, [dueNow, projects])

  const orientation = [
    schedule.length ? `${schedule.length} meeting${schedule.length === 1 ? '' : 's'}` : null,
    focusTasks.length ? `${focusTasks.length} task${focusTasks.length === 1 ? '' : 's'}` : null,
    overdue.length ? `${overdue.length} overdue` : null,
  ].filter(Boolean)

  return (
    <Page
      title={dayLabel(new Date())}
      subtitle={orientation.length ? orientation.join(' · ') : 'Nothing scheduled. Your call.'}
    >
      <div className="flex flex-col gap-6">
        {welcomeBack && (
          <div className="flex items-start gap-2.5 rounded-card border border-accent/30 bg-accent-soft px-3 py-2.5">
            <span className="text-accent-ink">◆</span>
            <p className="flex-1 text-micro leading-relaxed text-accent-ink">{welcomeBack}</p>
            <button
              type="button"
              onClick={() => setWelcomeBack(null)}
              className="text-micro text-accent-ink/70 hover:text-accent-ink"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        <QuickCaptureBar />

        <MomentumStrip tasks={tasks} />

        {schedule.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <SectionLabel count={schedule.length}>Schedule</SectionLabel>
            <div className="flex flex-col">
              {schedule.map((m) => (
                <MeetingLine
                  key={m.id}
                  meeting={m}
                  project={m.projectId ? projectMap.get(m.projectId) : undefined}
                  next={m.id === nextMeeting?.id}
                />
              ))}
            </div>
          </section>
        )}

        {overdue.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <SectionLabel count={overdue.length}>Slipped</SectionLabel>
            <div className="flex flex-col rounded-card border border-bad/25 bg-bad-soft/40 p-1">
              {overdue.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  project={task.projectId ? projectMap.get(task.projectId) : undefined}
                />
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <SectionLabel count={dueNow.length}>Today</SectionLabel>

          {dueNow.length === 0 && overdue.length === 0 ? (
            <EmptyState
              icon={<IconMeetings className="h-6 w-6" />}
              title={
                doneToday.length
                  ? `That is everything — ${doneToday.length} done today.`
                  : 'Nothing due today.'
              }
              body={
                doneToday.length
                  ? 'Anything else you pull in is a bonus.'
                  : 'Capture something above, or pull a task in from another day.'
              }
              action={
                <Link
                  to="/tasks"
                  className="inline-flex h-8 items-center px-1 text-micro uppercase track-wide text-accent underline decoration-2 underline-offset-4"
                >
                  Browse all tasks
                </Link>
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              {grouped.map(({ project, items }) => (
                <div key={project?.id ?? 'none'} className={project ? `accent-${project.accent}` : ''}>
                  <div className="mb-1 flex items-center gap-2 px-2">
                    {project ? (
                      <>
                        <span className="h-[7px] w-[7px] bg-accent" />
                        <Link
                          to={`/projects/${project.id}`}
                          className="text-micro uppercase track-wide text-muted hover:text-ink"
                        >
                          {project.name}
                        </Link>
                      </>
                    ) : (
                      <span className="label-micro">Personal</span>
                    )}
                    <span className="tabular text-micro text-faint">[{items.length}]</span>
                  </div>
                  {items.map((task) => (
                    <TaskRow key={task.id} task={task} project={project} showProject={false} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>

        {doneToday.length > 0 && (
          <section className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="flex w-fit items-center gap-2 text-left"
            >
              <SectionLabel count={doneToday.length}>Done today</SectionLabel>
              <span className="text-micro text-faint">{showDone ? '▴' : '▾'}</span>
            </button>
            {showDone && (
              <div className="flex flex-col">
                {doneToday.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    project={task.projectId ? projectMap.get(task.projectId) : undefined}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <div className="rule-dashed" />

        <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
          <Link
            to="/review"
            className="inline-flex items-center gap-2 text-micro uppercase track-wide text-muted hover:text-ink"
          >
            <IconSpark className="h-3.5 w-3.5" />
            Weekly review
          </Link>
          <Link
            to="/meetings"
            className="inline-flex items-center gap-2 text-micro uppercase track-wide text-muted hover:text-ink"
          >
            This week's agenda
            <IconArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </Page>
  )
}
