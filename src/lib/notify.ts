import { db } from '../db/db'
import { toISODate, today } from './date'
import type { Settings } from '../db/types'

const FIRED_KEY = 'orbit:notified'

function fired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function markFired(key: string) {
  const map = fired()
  map[key] = Date.now()
  // keep the ledger small — anything older than a week is irrelevant
  const cutoff = Date.now() - 7 * 86_400_000
  for (const k of Object.keys(map)) if (map[k] < cutoff) delete map[k]
  localStorage.setItem(FIRED_KEY, JSON.stringify(map))
}

const hasFired = (key: string) => key in fired()

export const notificationsSupported = () => typeof Notification !== 'undefined'

export function permissionState(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported' as const
  return Notification.requestPermission()
}

export function notify(title: string, body: string, tag: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body,
      tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    /* some browsers require a service worker registration; fail quietly */
  }
}

/** Focus mode silences everything while a session is running. */
let muted = false
export const setNotificationsMuted = (value: boolean) => {
  muted = value
}

function minutesFromHHMM(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

async function runChecks(settings: Settings) {
  const prefs = settings.notifications
  if (!prefs.enabled || muted || permissionState() !== 'granted') return

  const nowDate = new Date()
  const day = toISODate(nowDate)
  const minutesNow = nowDate.getHours() * 60 + nowDate.getMinutes()

  // --- morning digest
  if (prefs.dailyDigest) {
    const key = `digest:${day}`
    const target = minutesFromHHMM(prefs.digestTime)
    if (!hasFired(key) && minutesNow >= target && minutesNow < target + 120) {
      const [tasks, meetings] = await Promise.all([
        db.tasks.where('due').equals(day).toArray(),
        db.meetings.toArray(),
      ])
      const openTasks = tasks.filter((t) => t.status !== 'done').length
      const todaysMeetings = meetings.filter((m) => toISODate(m.start) === day).length
      if (openTasks || todaysMeetings) {
        notify(
          'Today in Orbit',
          `${openTasks} task${openTasks === 1 ? '' : 's'} and ${todaysMeetings} meeting${todaysMeetings === 1 ? '' : 's'} today.`,
          key,
        )
      } else {
        notify('Today in Orbit', 'Nothing scheduled. A good day to move something forward.', key)
      }
      markFired(key)
    }
  }

  // --- meeting reminders
  if (prefs.meetingReminders) {
    const soon = Date.now() + prefs.meetingLeadMin * 60_000
    const meetings = await db.meetings.where('start').between(Date.now() - 60_000, soon).toArray()
    for (const m of meetings) {
      const key = `meeting:${m.id}`
      if (hasFired(key)) continue
      const mins = Math.max(0, Math.round((m.start - Date.now()) / 60_000))
      notify(m.title, mins > 0 ? `Starts in ${mins} min. ${m.summary}`.trim() : 'Starting now.', key)
      markFired(key)
    }
  }

  // --- due-soon nudge, mid-afternoon, only if something is genuinely still open
  if (prefs.dueSoon) {
    const key = `duesoon:${day}`
    if (!hasFired(key) && minutesNow >= 15 * 60 && minutesNow < 18 * 60) {
      const open = (await db.tasks.where('due').equals(day).toArray()).filter(
        (t) => t.status !== 'done',
      )
      if (open.length) {
        notify(
          `${open.length} task${open.length === 1 ? '' : 's'} still due today`,
          open
            .slice(0, 3)
            .map((t) => t.title)
            .join(' · '),
          key,
        )
        markFired(key)
      }
    }
  }
}

/** Welcome-back nudge, shown in-app rather than as a push. */
export async function reengagementMessage(settings: Settings): Promise<string | null> {
  if (!settings.notifications.reengage || !settings.lastOpened) return null
  if (settings.lastOpened === today()) return null
  const gapDays = Math.round(
    (Date.now() - new Date(settings.lastOpened).getTime()) / 86_400_000,
  )
  if (gapDays < 2) return null
  const overdue = (await db.tasks.where('status').notEqual('done').toArray()).filter(
    (t) => t.due && t.due < today(),
  ).length
  if (!overdue) return `Welcome back. It has been ${gapDays} days — nothing has slipped.`
  return `Welcome back. ${overdue} thing${overdue === 1 ? '' : 's'} went past due while you were away.`
}

let timer: number | undefined

/** Starts the in-app reminder loop. Returns a cleanup function. */
export function startNotificationLoop() {
  const tick = async () => {
    const settings = await db.settings.get('app')
    if (settings) await runChecks(settings).catch(() => {})
  }
  void tick()
  timer = window.setInterval(tick, 30_000)
  return () => {
    if (timer) window.clearInterval(timer)
    timer = undefined
  }
}
