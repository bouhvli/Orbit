import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, DEFAULT_SETTINGS } from './db'
import { toISODate, today, weekEnd, weekStart } from '../lib/date'
import { inferHealth } from './actions'
import type { Health, ID, Meeting, Note, Project, Task } from './types'

const EMPTY: never[] = []

export function useSettings() {
  // Merged with defaults so a settings row saved before a new preference
  // existed (e.g. an older Settings shape already on someone's device)
  // still has every field the UI expects.
  const stored = useLiveQuery(() => db.settings.get('app'), [], DEFAULT_SETTINGS)
  return { ...DEFAULT_SETTINGS, ...stored }
}

export function useProjects(includeArchived = false) {
  return (
    useLiveQuery(async () => {
      const all = await db.projects.orderBy('order').toArray()
      return includeArchived ? all : all.filter((p) => !p.archived)
    }, [includeArchived]) ?? EMPTY
  )
}

export function useProject(id: ID | undefined) {
  return useLiveQuery(() => (id ? db.projects.get(id) : undefined), [id])
}

export function useTasks() {
  return useLiveQuery(() => db.tasks.toArray(), []) ?? EMPTY
}

export function useProjectTasks(projectId: ID | undefined) {
  return (
    useLiveQuery(
      () => (projectId ? db.tasks.where('projectId').equals(projectId).toArray() : []),
      [projectId],
    ) ?? EMPTY
  )
}

export function useMeetings() {
  return useLiveQuery(() => db.meetings.orderBy('start').toArray(), []) ?? EMPTY
}

export function useNotes() {
  return useLiveQuery(() => db.notes.reverse().sortBy('updatedAt'), []) ?? EMPTY
}

export function useNote(id: ID | undefined) {
  return useLiveQuery(() => (id ? db.notes.get(id) : undefined), [id])
}

export function useMeeting(id: ID | undefined) {
  return useLiveQuery(() => (id ? db.meetings.get(id) : undefined), [id])
}

export function useTask(id: ID | undefined) {
  return useLiveQuery(() => (id ? db.tasks.get(id) : undefined), [id])
}

export function useActivity(limit = 40) {
  return useLiveQuery(() => db.activity.orderBy('at').reverse().limit(limit).toArray(), [limit]) ?? EMPTY
}

export function useProjectActivity(projectId: ID | undefined, limit = 20) {
  return (
    useLiveQuery(
      async () =>
        projectId
          ? (await db.activity.where('projectId').equals(projectId).reverse().sortBy('at')).slice(
              0,
              limit,
            )
          : [],
      [projectId, limit],
    ) ?? EMPTY
  )
}

/* ------------------------------------------------------------- derived views */

export const byId = <T extends { id: string }>(items: T[]) =>
  new Map(items.map((i) => [i.id, i] as const))

export function sortTasks(tasks: Task[]) {
  const rank = { high: 0, med: 1, low: 2 } as const
  return [...tasks].sort((a, b) => {
    if (a.status === 'done' !== (b.status === 'done')) return a.status === 'done' ? 1 : -1
    const dueA = a.due ?? '9999-99-99'
    const dueB = b.due ?? '9999-99-99'
    if (dueA !== dueB) return dueA < dueB ? -1 : 1
    if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority]
    return a.order - b.order
  })
}

/** Everything that belongs on Today: due today, overdue, in progress, or pulled in. */
export function todaysTasks(tasks: Task[]) {
  const t = today()
  return sortTasks(
    tasks.filter(
      (task) =>
        task.status !== 'done' &&
        ((task.due && task.due <= t) || task.pulledInFor === t || task.status === 'doing'),
    ),
  )
}

export function completedToday(tasks: Task[]) {
  const t = today()
  return tasks.filter((task) => task.completedAt && toISODate(task.completedAt) === t)
}

export function meetingsOn(meetings: Meeting[], day = today()) {
  return meetings.filter((m) => toISODate(m.start) === day).sort((a, b) => a.start - b.start)
}

export function meetingsThisWeek(meetings: Meeting[]) {
  const from = weekStart().getTime()
  const to = weekEnd().getTime()
  return meetings.filter((m) => m.start >= from && m.start <= to)
}

export interface ProjectSummary {
  project: Project
  open: number
  done: number
  overdue: number
  total: number
  health: Health
  nextMeeting: Meeting | null
  lastTouched: number
}

export function summarise(
  projects: Project[],
  tasks: Task[],
  meetings: Meeting[],
  notes: Note[],
): ProjectSummary[] {
  const t = today()
  return projects.map((project) => {
    const own = tasks.filter((task) => task.projectId === project.id)
    const open = own.filter((task) => task.status !== 'done')
    const overdue = open.filter((task) => task.due && task.due < t)
    const upcoming = meetings
      .filter((m) => m.projectId === project.id && m.start >= Date.now())
      .sort((a, b) => a.start - b.start)
    const lastTouched = Math.max(
      project.updatedAt,
      ...own.map((task) => task.updatedAt),
      ...meetings.filter((m) => m.projectId === project.id).map((m) => m.updatedAt),
      ...notes.filter((n) => n.projectId === project.id).map((n) => n.updatedAt),
    )
    return {
      project,
      open: open.length,
      done: own.length - open.length,
      overdue: overdue.length,
      total: own.length,
      health: inferHealth(project, own, lastTouched),
      nextMeeting: upcoming[0] ?? null,
      lastTouched,
    }
  })
}

export function useWorkspace() {
  const projects = useProjects()
  const tasks = useTasks()
  const meetings = useMeetings()
  const notes = useNotes()
  const summaries = useMemo(
    () => summarise(projects, tasks, meetings, notes),
    [projects, tasks, meetings, notes],
  )
  const projectMap = useMemo(() => byId(projects), [projects])
  return { projects, tasks, meetings, notes, summaries, projectMap }
}
