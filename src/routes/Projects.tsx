import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../components/AppShell'
import {
  Button,
  DialogHeader,
  EmptyState,
  Field,
  HEALTH_LABEL,
  HealthDot,
  Input,
  Overlay,
  ProgressBar,
  Segmented,
  Textarea,
  cn,
} from '../components/ui'
import { IconArchive, IconPlus, IconProjects } from '../components/icons'
import { createProject, setArchived } from '../db/actions'
import { summarise, useMeetings, useNotes, useProjects, useTasks } from '../db/queries'
import { relativeDay, timeLabel, toISODate } from '../lib/date'
import type { AccentKey, ProjectStatus } from '../db/types'
import { ACCENTS } from '../lib/accents'
import { useUI } from '../store/ui'

const ICONS = ['◆', '▲', '●', '◇', '■', '✦', '▶', '❖']

export function NewProjectDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('')
  const [accent, setAccent] = useState<AccentKey>('indigo')
  const [icon, setIcon] = useState('◆')
  const toast = useUI((s) => s.toast)

  const reset = () => {
    setName('')
    setDescription('')
    setGoal('')
    setAccent('indigo')
    setIcon('◆')
  }

  return (
    <Overlay open={open} onClose={onClose}>
      <DialogHeader title="New project" subtitle="A container for tasks, meetings and notes" />
      <form
        className={`accent-${accent} flex max-h-[70dvh] flex-col gap-4 overflow-y-auto scroll-quiet px-4 py-4`}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          await createProject({ name, description, goal, accent, icon })
          toast(`Project “${name.trim()}” created`)
          reset()
          onClose()
        }}
      >
        <Field label="Name">
          <Input
            data-autofocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Platform migration"
            required
          />
        </Field>
        <Field label="Description" hint="One or two lines — what this is.">
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Move the legacy reporting stack onto the new service layer."
          />
        </Field>
        <Field label="Definition of done" hint="What has to be true for this to be finished?">
          <Input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="All reports served by the new API."
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Colour">
            <div className="flex flex-wrap gap-1.5">
              {ACCENTS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-label={label}
                  title={label}
                  onClick={() => setAccent(key)}
                  className={cn(
                    `accent-${key} h-8 w-8 rounded-sm border-2 transition-transform sm:h-6 sm:w-6`,
                    accent === key ? 'border-ink' : 'border-transparent sm:hover:scale-110',
                  )}
                  style={{ background: 'var(--accent)' }}
                />
              ))}
            </div>
          </Field>
          <Field label="Mark">
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Mark ${i}`}
                  onClick={() => setIcon(i)}
                  className={cn(
                    'grid h-8 w-8 place-items-center rounded-sm border text-body sm:h-6 sm:w-6',
                    icon === i
                      ? 'border-accent bg-accent-soft text-accent-ink'
                      : 'border-line text-muted hover:border-line-strong',
                  )}
                >
                  {i}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!name.trim()}>
            Create project
          </Button>
        </div>
      </form>
    </Overlay>
  )
}

export function Projects() {
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all')
  const [showArchived, setShowArchived] = useState(false)
  const projects = useProjects(true)
  const tasks = useTasks()
  const meetings = useMeetings()
  const notes = useNotes()

  const all = useMemo(
    () => summarise(projects, tasks, meetings, notes),
    [projects, tasks, meetings, notes],
  )
  const live = all.filter((s) => !s.project.archived)
  const archived = all.filter((s) => s.project.archived)
  const shown = filter === 'all' ? live : live.filter((s) => s.project.status === filter)

  return (
    <Page
      wide
      title="Projects"
      subtitle={`${live.length} active · ${archived.length} archived`}
      actions={
        <>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'on-hold', label: 'Held' },
              { value: 'done', label: 'Done' },
            ]}
          />
          <Button variant="primary" onClick={() => setShowNew(true)}>
            <IconPlus className="h-4 w-4" />
            New
          </Button>
        </>
      }
    >
      {shown.length === 0 ? (
        <EmptyState
          icon={<IconProjects className="h-6 w-6" />}
          title="No projects here yet"
          body="A project is just a container — a name and the work that belongs to it. You can add detail later."
          action={
            <Button variant="primary" onClick={() => setShowNew(true)}>
              <IconPlus className="h-4 w-4" />
              Create a project
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ project, open, done, overdue, total, health, nextMeeting, lastTouched }) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              // min-w-0: a grid item defaults to min-width:auto and refuses to
              // shrink below its content, which pushes the card past the viewport
              className={`accent-${project.accent} lift card flex min-w-0 flex-col gap-3 p-3.5`}
            >
              <div className="flex items-start gap-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-accent-soft text-body text-accent-ink">
                  {project.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body text-ink">{project.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <HealthDot health={health} />
                    <span className="text-micro text-muted">{HEALTH_LABEL[health]}</span>
                    {project.status !== 'active' && (
                      <span className="text-micro text-faint">
                        · {project.status === 'on-hold' ? 'on hold' : 'done'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {project.description && (
                <p className="line-clamp-2 text-micro leading-relaxed text-muted">
                  {project.description}
                </p>
              )}

              <div className="mt-auto flex flex-col gap-2">
                <ProgressBar value={total ? done / total : 0} />
                <div className="flex items-center justify-between text-micro text-faint">
                  <span className="tabular truncate">
                    {open} open{overdue > 0 && <span className="text-bad"> · {overdue} overdue</span>}
                  </span>
                  <span className="tabular shrink-0">
                    {total ? Math.round((done / total) * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line pt-2 text-micro">
                  {nextMeeting ? (
                    <span className="min-w-0 truncate text-muted">
                      {relativeDay(toISODate(nextMeeting.start))} {timeLabel(nextMeeting.start)} ·{' '}
                      {nextMeeting.title}
                    </span>
                  ) : (
                    <span className="text-faint">No meetings scheduled</span>
                  )}
                  <span className="shrink-0 text-faint">
                    {relativeDay(toISODate(lastTouched))}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-2 text-micro uppercase track-wide text-faint hover:text-ink"
          >
            <IconArchive className="h-3.5 w-3.5" />
            Archived [{archived.length}] {showArchived ? '▴' : '▾'}
          </button>
          {showArchived && (
            <div className="mt-3 flex flex-col gap-1.5">
              {archived.map(({ project, total, done }) => (
                <div
                  key={project.id}
                  className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2"
                >
                  <span className="text-muted">{project.icon}</span>
                  <Link
                    to={`/projects/${project.id}`}
                    className="min-w-0 flex-1 truncate text-body text-muted hover:text-ink"
                  >
                    {project.name}
                  </Link>
                  <span className="tabular shrink-0 text-micro text-faint">
                    {done}/{total} done
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => void setArchived(project.id, false)}>
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <NewProjectDialog open={showNew} onClose={() => setShowNew(false)} />
    </Page>
  )
}
