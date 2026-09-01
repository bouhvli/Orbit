import { addDays, addMonths, addWeeks, isWeekend } from 'date-fns'
import { db } from './db'
import { fromISODate, toISODate, today } from '../lib/date'
import { ACCENT_KEYS } from '../lib/accents'
import { uid } from '../lib/id'
import type {
  Activity,
  ActivityKind,
  Health,
  ID,
  Meeting,
  Note,
  Priority,
  Project,
  Recurrence,
  Settings,
  Task,
} from './types'

const now = () => Date.now()

export async function logActivity(
  kind: ActivityKind,
  text: string,
  opts: { projectId?: ID | null; entityId?: ID | null } = {},
) {
  const at = now()
  const entry: Activity = {
    id: uid('act'),
    kind,
    text,
    projectId: opts.projectId ?? null,
    entityId: opts.entityId ?? null,
    at,
    day: toISODate(at),
  }
  await db.activity.add(entry)
  return entry
}

/* ------------------------------------------------------------------ projects */

export const LABEL = {
  status: { active: 'active', 'on-hold': 'on hold', done: 'done' },
  health: { 'on-track': 'on track', 'at-risk': 'at risk', stalled: 'stalled' },
  priority: { low: 'Low', med: 'Medium', high: 'High' },
  taskStatus: { todo: 'To do', doing: 'In progress', done: 'Done' },
} as const

export async function createProject(input: Partial<Project> & { name: string }) {
  const count = await db.projects.count()
  const project: Project = {
    id: uid('prj'),
    name: input.name.trim(),
    description: input.description ?? '',
    goal: input.goal ?? '',
    status: input.status ?? 'active',
    health: input.health ?? 'auto',
    accent: input.accent ?? ACCENT_KEYS[count % ACCENT_KEYS.length],
    icon: input.icon ?? '◆',
    archived: 0,
    order: count,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.projects.add(project)
  await logActivity('project.created', `Created project "${project.name}"`, {
    projectId: project.id,
    entityId: project.id,
  })
  return project
}

export async function updateProject(id: ID, patch: Partial<Project>) {
  const before = await db.projects.get(id)
  await db.projects.update(id, { ...patch, updatedAt: now() })
  if (!before) return
  if (patch.status && patch.status !== before.status) {
    await logActivity('project.status', `"${before.name}" is now ${LABEL.status[patch.status]}`, {
      projectId: id,
      entityId: id,
    })
  }
  if (patch.health && patch.health !== before.health) {
    const label = patch.health === 'auto' ? 'tracked automatically' : LABEL.health[patch.health]
    await logActivity('project.health', `"${before.name}" marked ${label}`, {
      projectId: id,
      entityId: id,
    })
  }
}

export async function setArchived(id: ID, archived: boolean) {
  const project = await db.projects.get(id)
  await db.projects.update(id, { archived: archived ? 1 : 0, updatedAt: now() })
  if (project) {
    await logActivity(
      'project.archived',
      `${archived ? 'Archived' : 'Restored'} "${project.name}"`,
      { projectId: id, entityId: id },
    )
  }
}

/**
 * Health is manual when set, otherwise inferred:
 * anything overdue -> at risk; nothing touched in 14 days with open work -> stalled.
 */
export function inferHealth(project: Project, tasks: Task[], lastTouched: number): Health {
  if (project.health !== 'auto') return project.health
  const open = tasks.filter((t) => t.status !== 'done')
  const overdue = open.filter((t) => t.due && t.due < today())
  if (overdue.length) return 'at-risk'
  const daysIdle = (Date.now() - lastTouched) / 86_400_000
  if (open.length > 0 && daysIdle > 14) return 'stalled'
  return 'on-track'
}

/* --------------------------------------------------------------------- tasks */

export interface NewTask {
  title: string
  projectId?: ID | null
  priority?: Priority
  due?: string | null
  detail?: string
  meetingId?: ID | null
  noteId?: ID | null
  status?: Task['status']
  recurrence?: Recurrence | null
}

export async function createTask(input: NewTask) {
  const order = (await db.tasks.count()) + 1
  const task: Task = {
    id: uid('tsk'),
    title: input.title.trim(),
    projectId: input.projectId ?? null,
    status: input.status ?? 'todo',
    priority: input.priority ?? 'med',
    due: input.due ?? null,
    detail: input.detail ?? '',
    subtasks: [],
    noteId: input.noteId ?? null,
    meetingId: input.meetingId ?? null,
    recurrence: input.recurrence ?? null,
    pulledInFor: null,
    completedAt: null,
    order,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.tasks.add(task)
  await logActivity('task.created', `Added "${task.title}"`, {
    projectId: task.projectId,
    entityId: task.id,
  })
  return task
}

export async function updateTask(id: ID, patch: Partial<Task>) {
  await db.tasks.update(id, { ...patch, updatedAt: now() })
}

function nextOccurrence(due: string | null, r: Recurrence): string {
  const base = due ? fromISODate(due) : new Date()
  switch (r.freq) {
    case 'daily':
      return toISODate(addDays(base, r.interval))
    case 'weekdays': {
      let d = addDays(base, 1)
      while (isWeekend(d)) d = addDays(d, 1)
      return toISODate(d)
    }
    case 'weekly':
      return toISODate(addWeeks(base, r.interval))
    case 'monthly':
      return toISODate(addMonths(base, r.interval))
  }
}

/** Completing a recurring task closes this instance and schedules the next one. */
export async function setTaskStatus(id: ID, status: Task['status']) {
  const task = await db.tasks.get(id)
  if (!task) return
  const done = status === 'done'
  await db.tasks.update(id, {
    status,
    completedAt: done ? now() : null,
    pulledInFor: done ? null : task.pulledInFor,
    updatedAt: now(),
  })
  if (done) {
    await logActivity('task.completed', `Completed "${task.title}"`, {
      projectId: task.projectId,
      entityId: task.id,
    })
    if (task.recurrence) {
      await createTask({
        title: task.title,
        projectId: task.projectId,
        priority: task.priority,
        due: nextOccurrence(task.due, task.recurrence),
        detail: task.detail,
        recurrence: task.recurrence,
      })
    }
  } else if (task.status === 'done') {
    await logActivity('task.reopened', `Reopened "${task.title}"`, {
      projectId: task.projectId,
      entityId: task.id,
    })
  }
}

export const toggleTask = async (task: Task) =>
  setTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done')

export async function deleteTask(id: ID) {
  await db.tasks.delete(id)
}

export async function addSubtask(task: Task, title: string) {
  const subtasks = [...task.subtasks, { id: uid('sub'), title: title.trim(), done: false }]
  await updateTask(task.id, { subtasks })
}

export async function patchSubtask(
  task: Task,
  subId: ID,
  patch: Partial<{ title: string; done: boolean }>,
) {
  const subtasks = task.subtasks.map((s) => (s.id === subId ? { ...s, ...patch } : s))
  await updateTask(task.id, { subtasks })
}

export async function removeSubtask(task: Task, subId: ID) {
  await updateTask(task.id, { subtasks: task.subtasks.filter((s) => s.id !== subId) })
}

/** Pull a task into Today without changing its real due date. */
export async function pullIntoToday(id: ID, on = true) {
  await updateTask(id, { pulledInFor: on ? today() : null })
}

/* ------------------------------------------------------------------ meetings */

export async function createMeeting(input: Partial<Meeting> & { title: string; start: number }) {
  const meeting: Meeting = {
    id: uid('mtg'),
    title: input.title.trim(),
    projectId: input.projectId ?? null,
    start: input.start,
    durationMin: input.durationMin ?? 30,
    attendees: input.attendees ?? [],
    summary: input.summary ?? '',
    prep: input.prep ?? '',
    notes: input.notes ?? '',
    createdAt: now(),
    updatedAt: now(),
  }
  await db.meetings.add(meeting)
  await logActivity('meeting.created', `Scheduled "${meeting.title}"`, {
    projectId: meeting.projectId,
    entityId: meeting.id,
  })
  return meeting
}

export async function updateMeeting(id: ID, patch: Partial<Meeting>) {
  const before = await db.meetings.get(id)
  await db.meetings.update(id, { ...patch, updatedAt: now() })
  const gainedNotes = patch.notes !== undefined && !before?.notes?.trim() && !!patch.notes.trim()
  if (before && gainedNotes) {
    await logActivity('meeting.notes', `Wrote notes for "${before.title}"`, {
      projectId: before.projectId,
      entityId: id,
    })
  }
}

export async function deleteMeeting(id: ID) {
  await db.meetings.delete(id)
  await db.tasks.where('meetingId').equals(id).modify({ meetingId: null })
  await db.notes.where('meetingId').equals(id).modify({ meetingId: null })
}

/* --------------------------------------------------------------------- notes */

export async function createNote(input: Partial<Note> & { title: string }) {
  const note: Note = {
    id: uid('not'),
    title: input.title.trim() || 'Untitled note',
    projectId: input.projectId ?? null,
    body: input.body ?? '',
    taskId: input.taskId ?? null,
    meetingId: input.meetingId ?? null,
    pinned: input.pinned ?? 0,
    createdAt: now(),
    updatedAt: now(),
  }
  await db.notes.add(note)
  await logActivity('note.created', `Started "${note.title}"`, {
    projectId: note.projectId,
    entityId: note.id,
  })
  return note
}

export async function updateNote(id: ID, patch: Partial<Note>) {
  await db.notes.update(id, { ...patch, updatedAt: now() })
}

export async function deleteNote(id: ID) {
  await db.notes.delete(id)
  await db.tasks.where('noteId').equals(id).modify({ noteId: null })
}

/* ------------------------------------------------------------------ settings */

export async function updateSettings(patch: Partial<Settings>) {
  const current = await db.settings.get('app')
  if (!current) return
  await db.settings.put({ ...current, ...patch })
}

export async function updateNotificationPrefs(patch: Partial<Settings['notifications']>) {
  const current = await db.settings.get('app')
  if (!current) return
  await db.settings.put({ ...current, notifications: { ...current.notifications, ...patch } })
}

/** Called once per session: bumps the "days opened" streak. */
export async function touchOpenStreak() {
  const s = await db.settings.get('app')
  if (!s) return
  const t = today()
  if (s.lastOpened === t) return s
  const yesterday = toISODate(addDays(new Date(), -1))
  const openStreak = s.lastOpened === yesterday ? s.openStreak + 1 : 1
  const next = { ...s, lastOpened: t, openStreak }
  await db.settings.put(next)
  return next
}

export async function wipeAllData() {
  await db.transaction(
    'rw',
    [db.projects, db.tasks, db.meetings, db.notes, db.activity, db.settings],
    async () => {
      await Promise.all([
        db.projects.clear(),
        db.tasks.clear(),
        db.meetings.clear(),
        db.notes.clear(),
        db.activity.clear(),
      ])
      const s = await db.settings.get('app')
      if (s) await db.settings.put({ ...s, onboarded: false, openStreak: 0, lastOpened: null })
    },
  )
}
