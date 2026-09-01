import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns'

export const ISO = 'yyyy-MM-dd'

export const toISODate = (d: Date | number = new Date()) => format(d, ISO)
export const fromISODate = (s: string) => startOfDay(parseISO(s))
export const today = () => toISODate(new Date())

export const weekStart = (d: Date | number = new Date()) => startOfWeek(d, { weekStartsOn: 1 })
export const weekEnd = (d: Date | number = new Date()) => endOfWeek(d, { weekStartsOn: 1 })

export function isOverdue(due: string | null, status: string) {
  if (!due || status === 'done') return false
  return due < today()
}

/** "Today", "Tomorrow", "Yesterday", "Friday", "3d ago", "12 Mar". Never judges. */
export function relativeDay(due: string) {
  const d = fromISODate(due)
  const delta = differenceInCalendarDays(d, startOfDay(new Date()))
  if (delta === 0) return 'Today'
  if (delta === 1) return 'Tomorrow'
  if (delta === -1) return 'Yesterday'
  if (delta > 1 && delta < 7) return format(d, 'EEEE')
  if (delta < -1 && delta > -7) return `${-delta}d ago`
  return format(d, 'd MMM')
}

/**
 * Due label for a task. Only open work can be late, so a finished task keeps
 * the plain date rather than being scolded for it.
 */
export function dueLabel(due: string, done = false) {
  if (done) return relativeDay(due)
  const delta = differenceInCalendarDays(fromISODate(due), startOfDay(new Date()))
  if (delta === -1) return 'Yesterday'
  if (delta < -1) return `${-delta}d overdue`
  return relativeDay(due)
}

export const timeLabel = (ms: number) => format(ms, 'HH:mm')
export const dayLabel = (d: Date | number) => format(d, 'EEEE d MMMM')

export function minutesUntil(ms: number) {
  return Math.round((ms - Date.now()) / 60000)
}

/** Human countdown for a meeting: "in 25 min", "now", "2h 10m". */
export function untilLabel(ms: number) {
  const m = minutesUntil(ms)
  if (m <= 0 && m > -90) return 'now'
  if (m < 0) return 'ended'
  if (m < 60) return `in ${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem ? `in ${h}h ${rem}m` : `in ${h}h`
}

export function daysOfWeek(from: Date = weekStart()) {
  return Array.from({ length: 7 }, (_, i) => addDays(from, i))
}

export { addDays, isSameDay, format, differenceInCalendarDays, startOfDay }
