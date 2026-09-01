import { useNavigate } from 'react-router-dom'
import { pullIntoToday, toggleTask } from '../db/actions'
import { dueLabel, today } from '../lib/date'
import { useFocus, useUI } from '../store/ui'
import type { Project, Task } from '../db/types'
import { Checkbox, PriorityMark, cn } from './ui'
import { IconFocus, IconToday } from './icons'
import { useSettings } from '../db/queries'

export function DueLabel({ task, className }: { task: Task; className?: string }) {
  if (!task.due) return null
  const t = today()
  const overdue = task.due < t && task.status !== 'done'
  const isToday = task.due === t
  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap text-micro',
        overdue ? 'text-bad' : isToday ? 'text-accent-ink' : 'text-faint',
        className,
      )}
    >
      {dueLabel(task.due, task.status === 'done')}
    </span>
  )
}

export function ProjectTag({
  project,
  className,
}: {
  project: Project | undefined
  className?: string
}) {
  if (!project) {
    return (
      <span className={cn('shrink-0 whitespace-nowrap text-micro text-faint', className)}>
        Personal
      </span>
    )
  }
  return (
    <span
      className={cn(
        `accent-${project.accent} inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-micro text-muted`,
        className,
      )}
    >
      <span className="h-[7px] w-[7px] shrink-0 bg-accent" />
      {project.name}
    </span>
  )
}

export function TaskRow({
  task,
  project,
  showProject = true,
  className,
}: {
  task: Task
  project?: Project
  showProject?: boolean
  className?: string
}) {
  const openTask = useUI((s) => s.openTask)
  const toast = useUI((s) => s.toast)
  const startFocus = useFocus((s) => s.start)
  const settings = useSettings()
  const navigate = useNavigate()

  const done = task.status === 'done'
  const doneSubs = task.subtasks.filter((s) => s.done).length
  const pulledIn = task.pulledInFor === today()

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors active:bg-surface-2 sm:gap-2.5 sm:py-2 sm:hover:bg-surface-2/70',
        className,
      )}
    >
      <Checkbox
        checked={done}
        label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onChange={() => void toggleTask(task)}
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
            done ? 'strike-soft text-faint' : 'text-ink',
          )}
        >
          {task.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {showProject && <ProjectTag project={project} />}
          <DueLabel task={task} />
          <PriorityMark priority={task.priority} />
          {task.status === 'doing' && !done && (
            <span className="text-micro text-accent-ink">in progress</span>
          )}
          {task.recurrence && <span className="text-micro text-faint" title="Repeats">↻</span>}
          {task.subtasks.length > 0 && (
            <span className="tabular text-micro text-faint">
              ▤ {doneSubs}/{task.subtasks.length}
            </span>
          )}
          {task.noteId && (
            <span className="text-micro text-faint" title="Has a linked note">
              ¶
            </span>
          )}
          {pulledIn && !task.due && <span className="text-micro text-accent-ink">pulled in</span>}
        </span>
      </button>

      {/* Phone-sized screens reach these through the task sheet instead. */}
      <div className="row-actions hidden shrink-0 items-center gap-0.5 sm:flex">
        {!done && !pulledIn && task.due !== today() && (
          <button
            type="button"
            title="Pull into Today"
            aria-label="Pull into Today"
            onClick={() => {
              void pullIntoToday(task.id)
              toast('Pulled into Today', {
                label: 'Undo',
                run: () => void pullIntoToday(task.id, false),
              })
            }}
            className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-surface hover:text-ink"
          >
            <IconToday className="h-4 w-4" />
          </button>
        )}
        {!done && (
          <button
            type="button"
            title="Focus on this"
            aria-label="Focus on this task"
            onClick={() => {
              startFocus({
                taskId: task.id,
                projectId: task.projectId,
                minutes: settings.focusMinutes,
              })
              navigate('/focus')
            }}
            className="grid h-7 w-7 place-items-center rounded-md text-faint hover:bg-surface hover:text-ink"
          >
            <IconFocus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

/** Tasks grouped under a project heading — the shape Today wants. */
export function TaskGroup({
  label,
  tasks,
  projects,
  showProject,
  accentClass,
}: {
  label?: React.ReactNode
  tasks: Task[]
  projects: Map<string, Project>
  showProject?: boolean
  accentClass?: string
}) {
  if (tasks.length === 0) return null
  return (
    <div className={accentClass}>
      {label && <div className="mb-1 flex items-center gap-2 px-2">{label}</div>}
      <div className="flex flex-col">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            project={task.projectId ? projects.get(task.projectId) : undefined}
            showProject={showProject}
          />
        ))}
      </div>
    </div>
  )
}
