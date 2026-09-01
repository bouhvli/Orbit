import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Page } from '../components/AppShell'
import { TaskRow } from '../components/TaskRow'
import { NewMeetingDialog } from './Meetings'
import {
  Button,
  Checkbox,
  EmptyState,
  Field,
  HEALTH_LABEL,
  HealthDot,
  Pill,
  ProgressBar,
  Segmented,
  Select,
  Textarea,
  cn,
} from '../components/ui'
import {
  IconArchive,
  IconMeetings,
  IconNotes,
  IconPlus,
  IconTasks,
} from '../components/icons'
import {
  createNote,
  createTask,
  inferHealth,
  setArchived,
  setTaskStatus,
  updateProject,
} from '../db/actions'
import {
  sortTasks,
  useMeetings,
  useNotes,
  useProject,
  useProjectActivity,
  useProjectTasks,
} from '../db/queries'
import { dayLabel, dueLabel, format, relativeDay, timeLabel, toISODate } from '../lib/date'
import { firstLine } from '../lib/markdown'
import { parseCapture } from '../lib/parse'
import { draftProps, useDraft } from '../lib/useDraft'
import { useUI } from '../store/ui'
import type { Health, Priority, Task, TaskStatus } from '../db/types'

type Tab = 'overview' | 'tasks' | 'meetings' | 'docs'

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'docs', label: 'Docs' },
]

/* ------------------------------------------------------------------ overview */

function ProjectText({
  value,
  placeholder,
  onCommit,
}: {
  value: string
  placeholder: string
  onCommit: (next: string) => void
}) {
  const draft = useDraft(value, onCommit)
  return <Textarea rows={3} placeholder={placeholder} {...draftProps(draft)} />
}

function Overview({ projectId }: { projectId: string }) {
  const project = useProject(projectId)
  const tasks = useProjectTasks(projectId)
  const activity = useProjectActivity(projectId, 12)
  const meetings = useMeetings().filter((m) => m.projectId === projectId)
  const notes = useNotes().filter((n) => n.projectId === projectId)
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)

  if (!project) return null

  const open = tasks.filter((t) => t.status !== 'done')
  const overdue = open.filter((t) => t.due && t.due < toISODate(new Date()))
  const health = inferHealth(project, tasks, project.updatedAt)
  const done = tasks.length - open.length

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { label: 'Open', value: open.length },
          { label: 'Done', value: done },
          { label: 'Overdue', value: overdue.length, tone: overdue.length ? 'bad' : undefined },
          { label: 'Meetings', value: meetings.length },
        ].map((stat) => (
          <div key={stat.label} className="card px-3 py-2.5">
            <div className="label-micro">{stat.label}</div>
            <div
              className={cn(
                'tabular mt-1 text-head',
                stat.tone === 'bad' ? 'text-bad' : 'text-ink',
              )}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label-micro">Progress</span>
          <span className="tabular text-micro text-muted">
            {tasks.length ? Math.round((done / tasks.length) * 100) : 0}%
          </span>
        </div>
        <ProgressBar value={tasks.length ? done / tasks.length : 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Description">
          <ProjectText
            key={`${project.id}-desc`}
            value={project.description}
            placeholder="What is this project?"
            onCommit={(description) => void updateProject(project.id, { description })}
          />
        </Field>
        <Field label="Definition of done" hint="The thing that makes this finishable.">
          <ProjectText
            key={`${project.id}-goal`}
            value={project.goal}
            placeholder="What has to be true for this to be over?"
            onCommit={(goal) => void updateProject(project.id, { goal })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">
          <Select
            value={project.status}
            onChange={(e) =>
              void updateProject(project.id, { status: e.target.value as typeof project.status })
            }
          >
            <option value="active">Active</option>
            <option value="on-hold">On hold</option>
            <option value="done">Done</option>
          </Select>
        </Field>
        <Field
          label="Health"
          hint={
            project.health === 'auto'
              ? `Inferred: ${HEALTH_LABEL[health]} — overdue work marks a project at risk.`
              : 'Set by hand. Switch to automatic to let overdue work decide.'
          }
        >
          <Select
            value={project.health}
            onChange={(e) =>
              void updateProject(project.id, {
                health: e.target.value as Health | 'auto',
              })
            }
          >
            <option value="auto">Automatic</option>
            <option value="on-track">On track</option>
            <option value="at-risk">At risk</option>
            <option value="stalled">Stalled</option>
          </Select>
        </Field>
      </div>

      <div>
        <div className="label-micro mb-2">Recent activity</div>
        {activity.length === 0 ? (
          <p className="text-micro text-faint">Nothing has happened here yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {activity.map((a) => (
              <li key={a.id} className="flex items-baseline gap-2.5 text-micro">
                <span className="tabular w-[76px] shrink-0 text-faint">
                  {format(a.at, 'EEE HH:mm')}
                </span>
                <span className="min-w-0 flex-1 text-muted">{a.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex gap-2 text-micro text-faint">
          <span>{notes.length} note{notes.length === 1 ? '' : 's'}</span>
          <span>·</span>
          <span>Created {dayLabel(project.createdAt)}</span>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            void setArchived(project.id, true)
            toast(`“${project.name}” archived`, {
              label: 'Undo',
              run: () => void setArchived(project.id, false),
            })
            navigate('/projects')
          }}
        >
          <IconArchive className="h-3.5 w-3.5" />
          Archive project
        </Button>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------- tasks */

function TaskComposer({ projectId }: { projectId: string }) {
  const [value, setValue] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const parsed = parseCapture(value, [])
        if (!parsed.title.trim()) return
        void createTask({
          title: parsed.title,
          projectId,
          priority: parsed.priority ?? 'med',
          due: parsed.due,
          recurrence: parsed.recurrence,
        })
        setValue('')
      }}
      className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5"
    >
      <IconPlus className="h-4 w-4 shrink-0 text-faint" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a task — try “!high friday”"
        className="h-9 flex-1 bg-transparent text-body outline-none placeholder:text-faint"
      />
    </form>
  )
}

const BOARD_ORDER: TaskStatus[] = ['todo', 'doing', 'done']

function BoardCard({ task }: { task: Task }) {
  const openTask = useUI((s) => s.openTask)
  const index = BOARD_ORDER.indexOf(task.status)
  const move = (delta: number) => {
    const next = BOARD_ORDER[index + delta]
    if (next) void setTaskStatus(task.id, next)
  }
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className="card cursor-grab px-2.5 py-2 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <Checkbox
          size={15}
          checked={task.status === 'done'}
          label={task.title}
          onChange={() => void setTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')}
          className="mt-[3px]"
        />
        <button
          type="button"
          onClick={() => openTask(task.id)}
          className="min-w-0 flex-1 text-left"
        >
          <span
            className={cn(
              'block text-body leading-snug',
              task.status === 'done' ? 'strike-soft text-faint' : 'text-ink',
            )}
          >
            {task.title}
          </span>
          {(task.due || task.priority !== 'med' || task.subtasks.length > 0) && (
            <span className="mt-1 flex flex-wrap items-center gap-2 text-micro text-faint">
              {task.due && (
                <span
                  className={
                    task.due < toISODate(new Date()) && task.status !== 'done' ? 'text-bad' : ''
                  }
                >
                  {dueLabel(task.due, task.status === 'done')}
                </span>
              )}
              {task.priority === 'high' && <span className="text-bad">!!</span>}
              {task.priority === 'low' && <span>↓</span>}
              {task.subtasks.length > 0 && (
                <span className="tabular">
                  ▤ {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
                </span>
              )}
            </span>
          )}
        </button>
      </div>

      {/* Dragging is a pointer affordance; this is how a thumb moves a card. */}
      <div className="row-actions mt-1.5 flex justify-end gap-0.5 border-t border-line pt-1">
        <button
          type="button"
          aria-label="Move back a column"
          disabled={index <= 0}
          onClick={() => move(-1)}
          className="tap grid h-6 w-7 place-items-center rounded-sm text-micro text-muted disabled:opacity-25 sm:hover:bg-surface-2"
        >
          ◀
        </button>
        <button
          type="button"
          aria-label="Move on a column"
          disabled={index >= BOARD_ORDER.length - 1}
          onClick={() => move(1)}
          className="tap grid h-6 w-7 place-items-center rounded-sm text-micro text-muted disabled:opacity-25 sm:hover:bg-surface-2"
        >
          ▶
        </button>
      </div>
    </div>
  )
}

function Board({ tasks }: { tasks: Task[] }) {
  const [over, setOver] = useState<TaskStatus | null>(null)
  const columns: { status: TaskStatus; label: string }[] = [
    { status: 'todo', label: 'To do' },
    { status: 'doing', label: 'In progress' },
    { status: 'done', label: 'Done' },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {columns.map((col) => {
        const items = tasks.filter((t) => t.status === col.status)
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(col.status)
            }}
            onDragLeave={() => setOver((s) => (s === col.status ? null : s))}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData('text/plain')
              if (id) void setTaskStatus(id, col.status)
              setOver(null)
            }}
            className={cn(
              'flex min-h-[160px] flex-col gap-2 rounded-card border p-2 transition-colors',
              over === col.status
                ? 'border-accent bg-accent-soft/40'
                : 'border-line bg-canvas-tint/60',
            )}
          >
            <div className="flex items-center justify-between px-1">
              <span className="label-micro">{col.label}</span>
              <span className="tabular text-micro text-faint">{items.length}</span>
            </div>
            {items.map((task) => (
              <BoardCard key={task.id} task={task} />
            ))}
            {items.length === 0 && (
              <p className="px-1 py-3 text-micro text-faint">Drop a task here.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Tasks({ projectId }: { projectId: string }) {
  const tasks = useProjectTasks(projectId)
  const [view, setView] = useState<'list' | 'board'>('list')
  const [priority, setPriority] = useState<Priority | 'all'>('all')
  const [showDone, setShowDone] = useState(false)

  const filtered = useMemo(() => {
    let out = tasks
    if (priority !== 'all') out = out.filter((t) => t.priority === priority)
    if (!showDone && view === 'list') out = out.filter((t) => t.status !== 'done')
    return sortTasks(out)
  }, [tasks, priority, showDone, view])

  return (
    <div className="flex flex-col gap-4">
      <TaskComposer projectId={projectId} />

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: 'List' },
            { value: 'board', label: 'Board' },
          ]}
        />
        <Segmented
          value={priority}
          onChange={setPriority}
          options={[
            { value: 'all', label: 'All' },
            { value: 'high', label: 'High' },
            { value: 'med', label: 'Med' },
            { value: 'low', label: 'Low' },
          ]}
        />
        {view === 'list' && (
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-micro uppercase track-wide text-faint hover:text-ink"
          >
            {showDone ? 'Hide done' : 'Show done'}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconTasks className="h-6 w-6" />}
          title="No tasks match"
          body="Add one above, or loosen the filter."
        />
      ) : view === 'board' ? (
        <Board tasks={filtered} />
      ) : (
        <div className="flex flex-col">
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task} showProject={false} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ meetings */

function Meetings({ projectId }: { projectId: string }) {
  const meetings = useMeetings().filter((m) => m.projectId === projectId)
  const openMeeting = useUI((s) => s.openMeeting)
  const [showNew, setShowNew] = useState(false)

  const upcoming = meetings.filter((m) => m.start >= Date.now())
  const past = meetings.filter((m) => m.start < Date.now()).reverse()

  const row = (m: (typeof meetings)[number]) => (
    <button
      key={m.id}
      type="button"
      onClick={() => openMeeting(m.id)}
      className="group flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-2/70"
    >
      <span className="tabular w-[92px] shrink-0 text-micro text-muted">
        {relativeDay(toISODate(m.start))} {timeLabel(m.start)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body text-ink">{m.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-micro text-faint">
          {m.summary || 'No agenda'}
          {m.notes.trim() && <Pill tone="accent">notes</Pill>}
          {!m.notes.trim() && m.prep.trim() && <Pill>prep</Pill>}
        </span>
      </span>
    </button>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="label-micro">Upcoming [{upcoming.length}]</span>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <IconPlus className="h-3.5 w-3.5" />
          Schedule
        </Button>
      </div>
      {upcoming.length === 0 ? (
        <EmptyState
          icon={<IconMeetings className="h-6 w-6" />}
          title="Nothing scheduled"
          body="Add the next sync so its prep has somewhere to live."
        />
      ) : (
        <div className="flex flex-col">{upcoming.map(row)}</div>
      )}

      {past.length > 0 && (
        <div>
          <div className="label-micro mb-1">Past [{past.length}]</div>
          <div className="flex flex-col opacity-80">{past.map(row)}</div>
        </div>
      )}

      <NewMeetingDialog
        open={showNew}
        onClose={() => setShowNew(false)}
        defaultProjectId={projectId}
      />
    </div>
  )
}

/* ---------------------------------------------------------------------- docs */

function Docs({ projectId }: { projectId: string }) {
  const notes = useNotes().filter((n) => n.projectId === projectId)
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="label-micro">Notes & docs [{notes.length}]</span>
        <Button
          size="sm"
          onClick={async () => {
            const note = await createNote({ title: 'Untitled note', projectId })
            navigate(`/notes?note=${note.id}`)
          }}
        >
          <IconPlus className="h-3.5 w-3.5" />
          New note
        </Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={<IconNotes className="h-6 w-6" />}
          title="No writing here yet"
          body="Meeting notes, decisions, drafts — anything that would otherwise live in your head."
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {notes.map((note) => (
            <Link
              key={note.id}
              to={`/notes?note=${note.id}`}
              className="lift card flex items-start gap-3 px-3 py-2.5"
            >
              <span className="mt-px text-faint">¶</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-ink">{note.title}</span>
                <span className="mt-0.5 block truncate text-micro text-faint">
                  {firstLine(note.body, 90) || 'Empty note'}
                </span>
              </span>
              <span className="shrink-0 text-micro text-faint">
                {relativeDay(toISODate(note.updatedAt))}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------- workspace */

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>()
  const project = useProject(id)
  const tasks = useProjectTasks(id)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'overview'

  if (!id) return null
  if (!project) {
    return (
      <Page title="Project not found">
        <EmptyState
          title="This project no longer exists"
          body="It may have been deleted."
          action={
            <Link
              to="/projects"
              className="inline-flex h-8 items-center px-1 text-micro uppercase track-wide text-accent underline decoration-2 underline-offset-4"
            >
              Back to projects
            </Link>
          }
        />
      </Page>
    )
  }

  const health = inferHealth(project, tasks, project.updatedAt)
  const open = tasks.filter((t) => t.status !== 'done').length

  return (
    <div className={`accent-${project.accent}`}>
      <Page
        wide
        title={project.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5">
              <HealthDot health={health} />
              {HEALTH_LABEL[health]}
            </span>
            <span>·</span>
            <span>{open} open</span>
            {project.status !== 'active' && (
              <>
                <span>·</span>
                <span>{project.status === 'on-hold' ? 'On hold' : 'Done'}</span>
              </>
            )}
          </span>
        }
        actions={
          <Segmented
            value={tab}
            onChange={(t) => setParams(t === 'overview' ? {} : { tab: t })}
            options={TABS}
          />
        }
      >
        {project.goal && tab !== 'overview' && (
          <div className="mb-5 rounded-card border border-accent/30 bg-accent-soft/50 px-3 py-2.5 sm:mb-6 sm:px-3.5 sm:py-3">
            <div className="label-micro mb-1 text-accent-ink">Done when</div>
            <p className="text-body text-ink">{project.goal}</p>
          </div>
        )}

        {tab === 'overview' && <Overview projectId={id} />}
        {tab === 'tasks' && <Tasks projectId={id} />}
        {tab === 'meetings' && <Meetings projectId={id} />}
        {tab === 'docs' && <Docs projectId={id} />}
      </Page>
    </div>
  )
}
