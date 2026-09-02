import Dexie, { type EntityTable } from 'dexie'
import type { Activity, Meeting, Note, Project, Settings, Task } from './types'

export class OrbitDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  tasks!: EntityTable<Task, 'id'>
  meetings!: EntityTable<Meeting, 'id'>
  notes!: EntityTable<Note, 'id'>
  activity!: EntityTable<Activity, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('orbit')
    this.version(1).stores({
      projects: 'id, name, status, archived, order, updatedAt',
      tasks: 'id, projectId, status, due, priority, completedAt, updatedAt, order',
      meetings: 'id, projectId, start, updatedAt',
      notes: 'id, projectId, taskId, meetingId, pinned, updatedAt',
      activity: 'id, kind, projectId, at, day',
      settings: 'id',
    })
  }
}

export const db = new OrbitDB()

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  theme: 'system',
  accent: 'indigo',
  headingFont: 'departure',
  bodyFont: 'departure',
  numericFont: 'departure',
  lastOpened: null,
  openStreak: 0,
  focusMinutes: 25,
  breakMinutes: 5,
  onboarded: false,
  notifications: {
    enabled: false,
    dailyDigest: true,
    digestTime: '08:30',
    meetingReminders: true,
    meetingLeadMin: 15,
    dueSoon: true,
    reengage: true,
  },
}

/** Resolves once settings exist; safe to await repeatedly. */
export const dbReady = (async () => {
  const existing = await db.settings.get('app')
  if (!existing) await db.settings.put(DEFAULT_SETTINGS)
  return db
})()
