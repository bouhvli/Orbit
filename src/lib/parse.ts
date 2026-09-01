import { addDays, nextDay, type Day } from 'date-fns'
import { toISODate } from './date'
import type { Priority, Project, Recurrence } from '../db/types'

export interface ParsedCapture {
  title: string
  projectId: string | null
  projectName: string | null
  priority: Priority | null
  due: string | null
  dueLabel: string | null
  recurrence: Recurrence | null
  recurrenceLabel: string | null
}

const WEEKDAYS: Record<string, Day> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

const PRIORITY_WORDS: Record<string, Priority> = {
  high: 'high', hi: 'high', h: 'high', '1': 'high', urgent: 'high',
  med: 'med', medium: 'med', m: 'med', '2': 'med', normal: 'med',
  low: 'low', l: 'low', '3': 'low', later: 'low',
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Turns a single line of quick-capture text into a task draft.
 * Supported: `#project`, `!high`, `today|tomorrow|mon..sun|3d|12/03`, `every week`.
 * Everything unrecognised stays in the title, so capture never silently eats words.
 */
export function parseCapture(raw: string, projects: Project[]): ParsedCapture {
  const result: ParsedCapture = {
    title: raw.trim(),
    projectId: null,
    projectName: null,
    priority: null,
    due: null,
    dueLabel: null,
    recurrence: null,
    recurrenceLabel: null,
  }
  if (!result.title) return result

  let text = ` ${result.title} `

  const strip = (match: string) => {
    text = text.replace(match, ' ')
  }

  // --- recurrence: "every day" / "every weekday" / "every 2 weeks" / "~weekly"
  const recur =
    / (?:every|each) (?:(\d+) )?(day|days|weekday|weekdays|week|weeks|month|months) /i.exec(text) ||
    / ~(daily|weekdays|weekly|monthly) /i.exec(text)
  if (recur) {
    const interval = recur[2] ? Number(recur[1] ?? 1) || 1 : 1
    const unit = (recur[2] ?? recur[1]).toLowerCase()
    const freq: Recurrence['freq'] = unit.startsWith('weekday')
      ? 'weekdays'
      : unit.startsWith('day') || unit === 'daily'
        ? 'daily'
        : unit.startsWith('month')
          ? 'monthly'
          : 'weekly'
    result.recurrence = { freq, interval }
    result.recurrenceLabel =
      freq === 'weekdays'
        ? 'every weekday'
        : interval === 1
          ? { daily: 'daily', weekly: 'weekly', monthly: 'monthly', weekdays: '' }[freq]
          : `every ${interval} ${freq === 'daily' ? 'days' : freq === 'weekly' ? 'weeks' : 'months'}`
    strip(recur[0])
  }

  // --- project: #token, matched against project names by slug prefix
  const projectMatch = / #([\w-]+)/.exec(text)
  if (projectMatch) {
    const needle = slug(projectMatch[1])
    const hit =
      projects.find((p) => slug(p.name) === needle) ??
      projects.find((p) => slug(p.name).startsWith(needle)) ??
      projects.find((p) => slug(p.name).includes(needle))
    if (hit) {
      result.projectId = hit.id
      result.projectName = hit.name
      strip(projectMatch[0])
    }
  }

  // --- priority: !high / !1 / !!
  const bang = / !(\w+)/.exec(text)
  if (bang && PRIORITY_WORDS[bang[1].toLowerCase()]) {
    result.priority = PRIORITY_WORDS[bang[1].toLowerCase()]
    strip(bang[0])
  } else if (/ !! /.test(text)) {
    result.priority = 'high'
    strip(' !! ')
  }

  // --- dates
  const today = new Date()
  const setDue = (d: Date, label: string, match: string) => {
    result.due = toISODate(d)
    result.dueLabel = label
    strip(match)
  }

  const rel = / (today|tod|tomorrow|tmr|tom)\b/i.exec(text)
  const weekday = / (?:on |next )?(sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b/i.exec(text)
  const inDays = / in (\d+) ?(d|day|days|w|week|weeks)\b/i.exec(text)
  const numeric = / (\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))? /.exec(text)

  if (rel) {
    const word = rel[1].toLowerCase()
    const isToday = word.startsWith('tod')
    setDue(isToday ? today : addDays(today, 1), isToday ? 'today' : 'tomorrow', rel[0])
  } else if (inDays) {
    const n = Number(inDays[1])
    const weeks = inDays[2].startsWith('w')
    setDue(addDays(today, weeks ? n * 7 : n), `in ${n}${weeks ? 'w' : 'd'}`, inDays[0])
  } else if (weekday) {
    const day = WEEKDAYS[weekday[1].toLowerCase()]
    setDue(nextDay(today, day), weekday[1].toLowerCase(), weekday[0])
  } else if (numeric) {
    const [, dd, mm, yy] = numeric
    const year = yy ? (yy.length === 2 ? 2000 + Number(yy) : Number(yy)) : today.getFullYear()
    const d = new Date(year, Number(mm) - 1, Number(dd))
    if (!Number.isNaN(d.getTime())) setDue(d, `${dd}/${mm}`, numeric[0])
  }

  if (result.recurrence && !result.due) {
    result.due = toISODate(today)
    result.dueLabel ??= 'today'
  }

  result.title = text.replace(/\s+/g, ' ').trim()
  return result
}

/** Short human summary of what capture understood, for the live hint line. */
export function captureHint(p: ParsedCapture): string[] {
  const bits: string[] = []
  if (p.projectName) bits.push(p.projectName)
  if (p.priority) bits.push(`${p.priority} priority`)
  if (p.dueLabel) bits.push(p.dueLabel)
  if (p.recurrenceLabel) bits.push(p.recurrenceLabel)
  return bits
}
