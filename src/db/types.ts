export type ID = string

export type ProjectStatus = 'active' | 'on-hold' | 'done'
export type Health = 'on-track' | 'at-risk' | 'stalled'
export type HealthSetting = Health | 'auto'
export type TaskStatus = 'todo' | 'doing' | 'done'
export type Priority = 'low' | 'med' | 'high'

/** Accent keys map to CSS custom properties defined in index.css. */
export type AccentKey =
  | 'indigo'
  | 'teal'
  | 'amber'
  | 'rose'
  | 'violet'
  | 'sky'
  | 'lime'
  | 'clay'

export interface Project {
  id: ID
  name: string
  description: string
  /** Definition of done — the thing that makes this project finishable. */
  goal: string
  status: ProjectStatus
  health: HealthSetting
  accent: AccentKey
  icon: string
  archived: 0 | 1
  order: number
  createdAt: number
  updatedAt: number
}

export interface Subtask {
  id: ID
  title: string
  done: boolean
}

export type RecurrenceFreq = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface Recurrence {
  freq: RecurrenceFreq
  /** every N days/weeks/months */
  interval: number
}

export interface Task {
  id: ID
  title: string
  projectId: ID | null
  status: TaskStatus
  priority: Priority
  /** ISO calendar date, `yyyy-MM-dd`, or null for someday. */
  due: string | null
  detail: string
  subtasks: Subtask[]
  noteId: ID | null
  meetingId: ID | null
  recurrence: Recurrence | null
  /** ISO date the user manually pulled this into Today. */
  pulledInFor: string | null
  completedAt: number | null
  order: number
  createdAt: number
  updatedAt: number
}

export interface Meeting {
  id: ID
  title: string
  projectId: ID | null
  /** epoch ms */
  start: number
  durationMin: number
  attendees: string[]
  /** one-line "what this is about", shown on Today */
  summary: string
  prep: string
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Note {
  id: ID
  title: string
  projectId: ID | null
  body: string
  taskId: ID | null
  meetingId: ID | null
  pinned: 0 | 1
  createdAt: number
  updatedAt: number
}

export type ActivityKind =
  | 'task.created'
  | 'task.completed'
  | 'task.reopened'
  | 'project.created'
  | 'project.status'
  | 'project.health'
  | 'project.archived'
  | 'meeting.created'
  | 'meeting.notes'
  | 'note.created'
  | 'note.edited'
  | 'focus.session'

export interface Activity {
  id: ID
  kind: ActivityKind
  text: string
  projectId: ID | null
  entityId: ID | null
  at: number
  /** ISO date of `at`, indexed so streaks are a cheap query. */
  day: string
}

export interface NotificationPrefs {
  enabled: boolean
  dailyDigest: boolean
  /** HH:mm local */
  digestTime: string
  meetingReminders: boolean
  meetingLeadMin: number
  dueSoon: boolean
  reengage: boolean
}

export interface Settings {
  id: 'app'
  theme: 'light' | 'dark' | 'system'
  /** The app's own accent. Projects keep their own on top of it. */
  accent: AccentKey
  /** Long-form reading face: the pixel mono, or the system sans. */
  readingFont: 'mono' | 'sans'
  /** Day the app was last opened, ISO date — powers the open streak. */
  lastOpened: string | null
  openStreak: number
  focusMinutes: number
  breakMinutes: number
  notifications: NotificationPrefs
  onboarded: boolean
}
