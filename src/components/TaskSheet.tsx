import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  addSubtask,
  createNote,
  deleteTask,
  patchSubtask,
  removeSubtask,
  pullIntoToday,
  setTaskStatus,
  updateTask,
} from '../db/actions'
import { db } from '../db/db'
import { useMeeting, useProjects, useTask } from '../db/queries'
import { dayLabel, timeLabel, today } from '../lib/date'
import { draftProps, useDraft } from '../lib/useDraft'
import { useFocus, useUI } from '../store/ui'
import type { Recurrence, Task } from '../db/types'
import {
  Button,
  Checkbox,
  DialogHeader,
  Field,
  Input,
  Overlay,
  Segmented,
  Select,
  Textarea,
  cn,
} from './ui'
import { IconFocus, IconPlus, IconTrash } from './icons'
import { useSettings } from '../db/queries'

const RECURRENCE_OPTIONS: { value: string; label: string; recurrence: Recurrence | null }[] = [
  { value: 'none', label: 'Does not repeat', recurrence: null },
  { value: 'daily', label: 'Every day', recurrence: { freq: 'daily', interval: 1 } },
  { value: 'weekdays', label: 'Every weekday', recurrence: { freq: 'weekdays', interval: 1 } },
  { value: 'weekly', label: 'Every week', recurrence: { freq: 'weekly', interval: 1 } },
  { value: 'fortnightly', label: 'Every 2 weeks', recurrence: { freq: 'weekly', interval: 2 } },
  { value: 'monthly', label: 'Every month', recurrence: { freq: 'monthly', interval: 1 } },
]

const recurrenceValue = (r: Recurrence | null) => {
  if (!r) return 'none'
  if (r.freq === 'weekly' && r.interval === 2) return 'fortnightly'
  return r.freq
}

function SubtaskRow({ task, sub }: { task: Task; sub: Task['subtasks'][number] }) {
  const title = useDraft(sub.title, (v) => void patchSubtask(task, sub.id, { title: v }))
  return (
    <div className="group flex items-center gap-2.5 py-1">
      <Checkbox
        size={15}
        checked={sub.done}
        label={sub.title}
        onChange={(v) => void patchSubtask(task, sub.id, { done: v })}
      />
      <input
        {...draftProps(title)}
        aria-label="Sub-task"
        className={cn(
          'min-w-0 flex-1 bg-transparent text-body outline-none',
          sub.done && 'strike-soft text-faint',
        )}
      />
      <button
        type="button"
        aria-label={`Remove ${sub.title}`}
        onClick={() => void removeSubtask(task, sub.id)}
        className="shrink-0 text-micro text-faint opacity-0 transition-opacity hover:text-bad group-hover:opacity-100"
      >
        ✕
      </button>
    </div>
  )
}

function Subtasks({ task }: { task: Task }) {
  const [draft, setDraft] = useState('')
  const done = task.subtasks.filter((s) => s.done).length

  return (
    <div>
      <div className="label-micro mb-1.5 flex items-center gap-2">
        Sub-tasks
        {task.subtasks.length > 0 && (
          <span className="tabular">
            [{done}/{task.subtasks.length}]
          </span>
        )}
      </div>
      <div className="flex flex-col">
        {task.subtasks.map((sub) => (
          <SubtaskRow key={sub.id} task={task} sub={sub} />
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          void addSubtask(task, draft)
          setDraft('')
        }}
        className="mt-1 flex items-center gap-2.5"
      >
        <span className="grid h-[15px] w-[15px] shrink-0 place-items-center border border-dashed border-line-strong text-micro text-faint">
          +
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a step"
          className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-faint"
        />
      </form>
    </div>
  )
}

export function TaskSheet() {
  const id = useUI((s) => s.openTaskId)
  const openTask = useUI((s) => s.openTask)
  const close = () => openTask(null)
  const toast = useUI((s) => s.toast)
  const task = useTask(id ?? undefined)
  const projects = useProjects(true)
  const meeting = useMeeting(task?.meetingId ?? undefined)
  const settings = useSettings()
  const startFocus = useFocus((s) => s.start)
  const navigate = useNavigate()

  if (!id || !task) return null

  return (
    <Overlay open onClose={close} placement="right">
      <DialogHeader
        title={<TaskTitle key={task.id} task={task} />}
        subtitle={`Created ${dayLabel(task.createdAt)}`}
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              startFocus({
                taskId: task.id,
                projectId: task.projectId,
                minutes: settings.focusMinutes,
              })
              close()
              navigate('/focus')
            }}
          >
            <IconFocus className="h-3.5 w-3.5" />
            Focus
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto scroll-quiet px-4 py-4">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={task.status}
              onChange={(status) => void setTaskStatus(task.id, status)}
              options={[
                { value: 'todo', label: 'To do' },
                { value: 'doing', label: 'In progress' },
                { value: 'done', label: 'Done' },
              ]}
            />
            {task.status !== 'done' && task.due !== today() && (
              <Button
                size="sm"
                variant={task.pulledInFor === today() ? 'primary' : 'secondary'}
                onClick={() => void pullIntoToday(task.id, task.pulledInFor !== today())}
              >
                {task.pulledInFor === today() ? '✓ On Today' : 'Pull into Today'}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Project">
              <Select
                value={task.projectId ?? ''}
                onChange={(e) =>
                  void updateTask(task.id, { projectId: e.target.value || null })
                }
              >
                <option value="">Personal / none</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select
                value={task.priority}
                onChange={(e) =>
                  void updateTask(task.id, { priority: e.target.value as Task['priority'] })
                }
              >
                <option value="high">High</option>
                <option value="med">Medium</option>
                <option value="low">Low</option>
              </Select>
            </Field>
            <Field label="Due">
              <Input
                type="date"
                value={task.due ?? ''}
                onChange={(e) => void updateTask(task.id, { due: e.target.value || null })}
              />
            </Field>
            <Field label="Repeat">
              <Select
                value={recurrenceValue(task.recurrence)}
                onChange={(e) => {
                  const opt = RECURRENCE_OPTIONS.find((o) => o.value === e.target.value)
                  void updateTask(task.id, { recurrence: opt?.recurrence ?? null })
                }}
              >
                {RECURRENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notes on this task">
            <TaskDetail key={task.id} task={task} />
          </Field>

          <Subtasks task={task} />

          <div className="flex flex-col gap-2">
            <div className="label-micro">Linked</div>
            {meeting && (
              <div className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-2 text-micro text-muted">
                <span className="text-faint">From meeting</span>
                <span className="truncate text-ink">{meeting.title}</span>
                <span className="tabular ml-auto shrink-0 text-faint">
                  {timeLabel(meeting.start)}
                </span>
              </div>
            )}
            {task.noteId ? (
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() => {
                  close()
                  navigate(`/notes?note=${task.noteId}`)
                }}
              >
                ¶ Open linked note
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="self-start"
                onClick={async () => {
                  const note = await createNote({
                    title: task.title,
                    projectId: task.projectId,
                    taskId: task.id,
                    body: `# ${task.title}\n\n`,
                  })
                  await updateTask(task.id, { noteId: note.id })
                  close()
                  navigate(`/notes?note=${note.id}`)
                }}
              >
                <IconPlus className="h-3.5 w-3.5" />
                Write a note for this
              </Button>
            )}
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-line px-4 py-2.5">
        <span className="text-micro text-faint">
          {task.completedAt ? `Completed ${dayLabel(task.completedAt)}` : ''}
        </span>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            const snapshot = task
            void deleteTask(task.id)
            close()
            toast('Task deleted', {
              label: 'Undo',
              run: () => void db.tasks.put(snapshot),
            })
          }}
        >
          <IconTrash className="h-3.5 w-3.5" />
          Delete
        </Button>
      </footer>
    </Overlay>
  )
}

function TaskDetail({ task }: { task: Task }) {
  const detail = useDraft(task.detail, (v) => void updateTask(task.id, { detail: v }))
  return (
    <Textarea rows={4} placeholder="Context, links, what done looks like…" {...draftProps(detail)} />
  )
}

function TaskTitle({ task }: { task: Task }) {
  const title = useDraft(task.title, (v) => {
    if (v.trim()) void updateTask(task.id, { title: v.trim() })
  })
  return (
    <input
      {...draftProps(title)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className="w-full bg-transparent text-body text-ink outline-none"
      aria-label="Task title"
    />
  )
}
