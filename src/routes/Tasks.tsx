import { useMemo, useState } from 'react'
import { Page } from '../components/AppShell'
import { TaskRow } from '../components/TaskRow'
import { Button, EmptyState, Input, Segmented, cn } from '../components/ui'
import { IconPlus, IconTasks } from '../components/icons'
import { sortTasks, useWorkspace } from '../db/queries'
import { addDays, relativeDay, toISODate, today } from '../lib/date'
import { useUI } from '../store/ui'
import type { Task } from '../db/types'

type Filter = 'today' | 'week' | 'overdue' | 'someday' | 'all'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'someday', label: 'Someday' },
  { value: 'all', label: 'All' },
]

const matches = (task: Task, filter: Filter) => {
  const t = today()
  const weekAhead = toISODate(addDays(new Date(), 7))
  switch (filter) {
    case 'today':
      return !!task.due && task.due <= t
    case 'week':
      return !!task.due && task.due <= weekAhead
    case 'overdue':
      return !!task.due && task.due < t && task.status !== 'done'
    case 'someday':
      return !task.due
    case 'all':
      return true
  }
}

export function Tasks() {
  const { tasks, projects, projectMap } = useWorkspace()
  const setQuickAdd = useUI((s) => s.setQuickAdd)
  const [filter, setFilter] = useState<Filter>('week')
  const [group, setGroup] = useState<'project' | 'due'>('project')
  const [query, setQuery] = useState('')
  const [showDone, setShowDone] = useState(false)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sortTasks(
      tasks.filter((task) => {
        if (!showDone && task.status === 'done') return false
        if (!matches(task, filter)) return false
        if (q && !`${task.title} ${task.detail}`.toLowerCase().includes(q)) return false
        return true
      }),
    )
  }, [tasks, filter, showDone, query])

  const groups = useMemo(() => {
    if (group === 'project') {
      const map = new Map<string, Task[]>()
      for (const task of visible) {
        const key = task.projectId ?? '__none'
        map.set(key, [...(map.get(key) ?? []), task])
      }
      const out = projects
        .filter((p) => map.has(p.id))
        .map((p) => ({
          key: p.id,
          label: p.name,
          accent: `accent-${p.accent}`,
          dot: true,
          items: map.get(p.id)!,
        }))
      if (map.has('__none')) {
        out.push({
          key: 'none',
          label: 'Personal',
          accent: '',
          dot: false,
          items: map.get('__none')!,
        })
      }
      return out
    }

    const map = new Map<string, Task[]>()
    for (const task of visible) {
      const key = task.due ?? '__none'
      map.set(key, [...(map.get(key) ?? []), task])
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === '__none' ? 1 : b === '__none' ? -1 : a < b ? -1 : 1))
      .map(([key, items]) => ({
        key,
        label: key === '__none' ? 'No due date' : relativeDay(key),
        accent: '',
        dot: false,
        items,
      }))
  }, [visible, group, projects])

  const openCount = tasks.filter((t) => t.status !== 'done').length

  return (
    <Page
      title="Tasks"
      subtitle={`${visible.length} shown · ${openCount} open across everything`}
      actions={
        <Button variant="primary" onClick={() => setQuickAdd(true)}>
          <IconPlus className="h-4 w-4" />
          Capture
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <Segmented value={filter} onChange={setFilter} options={FILTERS} />
          <Segmented
            value={group}
            onChange={setGroup}
            options={[
              { value: 'project', label: 'By project' },
              { value: 'due', label: 'By date' },
            ]}
          />
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className={cn(
              'shrink-0 whitespace-nowrap px-1 text-micro uppercase track-wide transition-colors',
              showDone ? 'text-accent-ink' : 'text-faint hover:text-ink',
            )}
          >
            {showDone ? 'Hiding nothing' : 'Show done'}
          </button>
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter tasks…"
          className="h-10 sm:ml-auto sm:h-8 sm:max-w-[220px]"
        />

        {visible.length === 0 ? (
          <EmptyState
            icon={<IconTasks className="h-6 w-6" />}
            title="Nothing here"
            body={
              filter === 'overdue'
                ? 'Nothing has slipped. That is worth noticing.'
                : 'Try another filter, or capture something new.'
            }
            action={
              <Button size="sm" onClick={() => setQuickAdd(true)}>
                <IconPlus className="h-3.5 w-3.5" />
                Capture a task
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((g) => (
              <div key={g.key} className={g.accent}>
                <div className="mb-1 flex items-center gap-2 border-b border-line px-2 pb-1">
                  {g.dot && <span className="h-[7px] w-[7px] bg-accent" />}
                  <span className="text-micro uppercase track-wide text-muted">{g.label}</span>
                  <span className="tabular ml-auto text-micro text-faint">{g.items.length}</span>
                </div>
                {g.items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    project={task.projectId ? projectMap.get(task.projectId) : undefined}
                    showProject={group === 'due'}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  )
}
