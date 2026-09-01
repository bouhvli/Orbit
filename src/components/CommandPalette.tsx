import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings, useWorkspace } from '../db/queries'
import { updateSettings } from '../db/actions'
import { firstLine } from '../lib/markdown'
import { dayLabel, relativeDay, timeLabel } from '../lib/date'
import { useUI } from '../store/ui'
import { Kbd, Overlay, cn } from './ui'
import {
  IconFocus,
  IconMeetings,
  IconNotes,
  IconPlus,
  IconProjects,
  IconSearch,
  IconSettings,
  IconTasks,
  IconToday,
} from './icons'

interface Item {
  id: string
  label: string
  detail?: string
  group: string
  icon: typeof IconToday
  run: () => void
  keywords?: string
}

/** Subsequence match — forgiving enough to feel fuzzy, cheap enough to be instant. */
function score(haystack: string, needle: string): number {
  if (!needle) return 1
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  const direct = h.indexOf(n)
  if (direct === 0) return 1000
  if (direct > 0) return 800 - direct
  let hi = 0
  let hits = 0
  for (const char of n) {
    const found = h.indexOf(char, hi)
    if (found === -1) return 0
    hits += found === hi ? 2 : 1
    hi = found + 1
  }
  return 100 + hits
}

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen)
  const setOpen = useUI((s) => s.setPalette)
  const setQuickAdd = useUI((s) => s.setQuickAdd)
  const openTask = useUI((s) => s.openTask)
  const openMeeting = useUI((s) => s.openMeeting)
  const { projects, tasks, meetings, notes, projectMap } = useWorkspace()
  const settings = useSettings()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
    }
  }, [open])

  const items = useMemo<Item[]>(() => {
    const go = (path: string) => () => {
      navigate(path)
      setOpen(false)
    }

    const commands: Item[] = [
      {
        id: 'cmd-capture',
        label: 'Capture a task',
        group: 'Actions',
        icon: IconPlus,
        keywords: 'new add todo',
        run: () => {
          setOpen(false)
          setQuickAdd(true)
        },
      },
      { id: 'cmd-today', label: 'Go to Today', group: 'Actions', icon: IconToday, run: go('/') },
      {
        id: 'cmd-projects',
        label: 'Go to Projects',
        group: 'Actions',
        icon: IconProjects,
        run: go('/projects'),
      },
      { id: 'cmd-tasks', label: 'Go to Tasks', group: 'Actions', icon: IconTasks, run: go('/tasks') },
      {
        id: 'cmd-meetings',
        label: 'Go to Meetings',
        group: 'Actions',
        icon: IconMeetings,
        run: go('/meetings'),
      },
      { id: 'cmd-notes', label: 'Go to Notes', group: 'Actions', icon: IconNotes, run: go('/notes') },
      {
        id: 'cmd-focus',
        label: 'Enter Focus mode',
        group: 'Actions',
        icon: IconFocus,
        run: go('/focus'),
      },
      {
        id: 'cmd-review',
        label: 'Open the weekly review',
        group: 'Actions',
        icon: IconToday,
        keywords: 'week done progress',
        run: go('/review'),
      },
      {
        id: 'cmd-theme',
        label: `Switch to ${settings.theme === 'dark' ? 'light' : 'dark'} theme`,
        group: 'Actions',
        icon: IconSettings,
        keywords: 'dark light appearance',
        run: () => {
          void updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
          setOpen(false)
        },
      },
      {
        id: 'cmd-settings',
        label: 'Open Settings',
        group: 'Actions',
        icon: IconSettings,
        run: go('/settings'),
      },
    ]

    const projectItems: Item[] = projects.map((p) => ({
      id: p.id,
      label: p.name,
      detail: p.description || undefined,
      group: 'Projects',
      icon: IconProjects,
      run: go(`/projects/${p.id}`),
    }))

    const taskItems: Item[] = tasks
      .filter((t) => t.status !== 'done')
      .map((t) => ({
        id: t.id,
        label: t.title,
        detail: [
          t.projectId ? projectMap.get(t.projectId)?.name : 'Personal',
          t.due ? relativeDay(t.due) : null,
        ]
          .filter(Boolean)
          .join(' · '),
        group: 'Tasks',
        icon: IconTasks,
        run: () => {
          openTask(t.id)
          setOpen(false)
        },
      }))

    const meetingItems: Item[] = meetings.map((m) => ({
      id: m.id,
      label: m.title,
      detail: `${dayLabel(m.start)} · ${timeLabel(m.start)}`,
      group: 'Meetings',
      icon: IconMeetings,
      run: () => {
        openMeeting(m.id)
        setOpen(false)
      },
    }))

    const noteItems: Item[] = notes.map((n) => ({
      id: n.id,
      label: n.title,
      detail: firstLine(n.body, 60) || undefined,
      group: 'Notes',
      icon: IconNotes,
      keywords: n.body.slice(0, 400),
      run: go(`/notes?note=${n.id}`),
    }))

    return [...commands, ...projectItems, ...taskItems, ...meetingItems, ...noteItems]
  }, [
    projects,
    tasks,
    meetings,
    notes,
    projectMap,
    navigate,
    setOpen,
    setQuickAdd,
    openTask,
    openMeeting,
    settings.theme,
  ])

  const results = useMemo(() => {
    if (!query.trim()) {
      return items.filter((i) => i.group === 'Actions').slice(0, 8)
    }
    const ranked = items
      .map((item) => ({
        item,
        s: Math.max(
          score(item.label, query),
          item.detail ? score(item.detail, query) * 0.6 : 0,
          item.keywords ? score(item.keywords, query) * 0.4 : 0,
        ),
      }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 24)

    // Cluster by group, ordered by each group's best hit, so headings appear once.
    const buckets = new Map<string, Item[]>()
    for (const { item } of ranked) {
      buckets.set(item.group, [...(buckets.get(item.group) ?? []), item])
    }
    return [...buckets.values()].flat()
  }, [items, query])

  useEffect(() => {
    setCursor(0)
  }, [query])

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [cursor, results])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault()
      setCursor((c) => (c + 1) % Math.max(1, results.length))
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault()
      setCursor((c) => (c - 1 + results.length) % Math.max(1, results.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      results[cursor]?.run()
    }
  }

  let lastGroup = ''

  return (
    <Overlay open onClose={() => setOpen(false)} placement="top">
      <div className="flex items-center gap-2.5 border-b border-line px-4">
        <IconSearch className="h-4 w-4 shrink-0 text-faint" />
        <input
          data-autofocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search tasks, projects, meetings, notes…"
          aria-label="Search everything"
          className="h-13 flex-1 bg-transparent py-4 text-body outline-none placeholder:text-faint"
        />
        <Kbd>esc</Kbd>
      </div>

      <div ref={listRef} className="max-h-[52vh] overflow-y-auto scroll-quiet py-1.5">
        {results.length === 0 && (
          <p className="px-4 py-6 text-center text-micro text-faint">
            Nothing matches “{query}”.
          </p>
        )}
        {results.map((item, i) => {
          const showGroup = item.group !== lastGroup
          lastGroup = item.group
          const active = i === cursor
          return (
            <div key={`${item.group}-${item.id}`}>
              {showGroup && <div className="label-micro px-4 pb-1 pt-2.5">{item.group}</div>}
              <button
                type="button"
                data-active={active}
                onMouseMove={() => setCursor(i)}
                onClick={item.run}
                className={cn(
                  'flex w-full items-center gap-2.5 px-4 py-1.5 text-left transition-colors',
                  active ? 'bg-accent-soft text-accent-ink' : 'text-ink hover:bg-surface-2',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0 opacity-60" />
                <span className="min-w-0 flex-1 truncate text-body">{item.label}</span>
                {item.detail && (
                  <span className="hidden shrink-0 truncate text-micro text-faint sm:block">
                    {item.detail}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      <div className="hidden items-center gap-3 border-t border-line px-4 py-2 text-micro text-faint sm:flex">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> move
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> open
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>C</Kbd> capture
        </span>
      </div>
    </Overlay>
  )
}
