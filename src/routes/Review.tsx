import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../components/AppShell'
import { EmptyState, HEALTH_LABEL, HealthDot, Segmented, cn } from '../components/ui'
import { IconSpark } from '../components/icons'
import { useWorkspace } from '../db/queries'
import { addDays, dayLabel, format, toISODate, weekEnd, weekStart } from '../lib/date'

export function Review() {
  const { tasks, meetings, notes, projects, summaries, projectMap } = useWorkspace()
  const [offset, setOffset] = useState(0)

  const { from, to, label } = useMemo(() => {
    const base = addDays(new Date(), offset * 7)
    const s = weekStart(base)
    const e = weekEnd(base)
    return {
      from: s.getTime(),
      to: e.getTime(),
      label:
        offset === 0
          ? 'This week'
          : offset === -1
            ? 'Last week'
            : `${format(s, 'd MMM')} – ${format(e, 'd MMM')}`,
    }
  }, [offset])

  const completed = tasks.filter(
    (t) => t.completedAt && t.completedAt >= from && t.completedAt <= to,
  )
  const held = meetings.filter((m) => m.start >= from && m.start <= to && m.start < Date.now())
  const written = notes.filter((n) => n.updatedAt >= from && n.updatedAt <= to)
  const carried = tasks.filter((t) => t.status !== 'done' && t.due && t.due < toISODate(new Date()))

  const byProject = useMemo(() => {
    const map = new Map<string, typeof completed>()
    for (const task of completed) {
      const key = task.projectId ?? '__none'
      map.set(key, [...(map.get(key) ?? []), task])
    }
    return [...map.entries()]
      .map(([key, items]) => ({
        key,
        project: key === '__none' ? undefined : projectMap.get(key),
        items,
      }))
      .sort((a, b) => b.items.length - a.items.length)
  }, [completed, projectMap])

  const days = useMemo(() => {
    const s = weekStart(addDays(new Date(), offset * 7))
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(s, i)
      const iso = toISODate(day)
      return {
        iso,
        short: format(day, 'EEEEE'),
        count: completed.filter((t) => toISODate(t.completedAt!) === iso).length,
      }
    })
  }, [completed, offset])

  const max = Math.max(1, ...days.map((d) => d.count))

  return (
    <Page
      title="Weekly review"
      subtitle={`${label} · ${dayLabel(from)} → ${dayLabel(to)}`}
      actions={
        <Segmented
          value={String(offset)}
          onChange={(v) => setOffset(Number(v))}
          options={[
            { value: '-2', label: '2 wks ago' },
            { value: '-1', label: 'Last' },
            { value: '0', label: 'This week' },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-7">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Tasks completed', value: completed.length },
            { label: 'Meetings held', value: held.length },
            { label: 'Notes touched', value: written.length },
          ].map((s) => (
            <div key={s.label} className="card px-3.5 py-3">
              <div className="label-micro">{s.label}</div>
              <div className="tabular mt-1 text-display text-ink">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="card px-3.5 py-3">
          <div className="label-micro mb-2">Shape of the week</div>
          <div className="flex items-end gap-2">
            {days.map((d) => (
              <div key={d.iso} className="flex flex-1 flex-col items-center gap-1">
                <span className="tabular text-micro text-faint">{d.count || ''}</span>
                <span
                  className={cn('w-full', d.count === 0 ? 'bg-line' : 'bg-accent')}
                  style={{ height: d.count === 0 ? 2 : Math.max(4, (d.count / max) * 56) }}
                />
                <span className="text-micro uppercase text-faint">{d.short}</span>
              </div>
            ))}
          </div>
        </div>

        <section>
          <div className="label-micro mb-2">What got done</div>
          {completed.length === 0 ? (
            <EmptyState
              icon={<IconSpark className="h-6 w-6" />}
              title="Nothing completed in this week"
              body="Either it was a thinking week, or the work was too big to tick off. Both happen."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {byProject.map(({ key, project, items }) => (
                <div key={key} className={project ? `accent-${project.accent}` : ''}>
                  <div className="mb-1 flex items-center gap-2 border-b border-line pb-1">
                    {project ? (
                      <>
                        <span className="h-[7px] w-[7px] bg-accent" />
                        <Link
                          to={`/projects/${project.id}`}
                          className="text-micro uppercase track-wide text-muted hover:text-ink"
                        >
                          {project.name}
                        </Link>
                      </>
                    ) : (
                      <span className="label-micro">Personal</span>
                    )}
                    <span className="tabular ml-auto text-micro text-faint">{items.length}</span>
                  </div>
                  <ul className="flex flex-col">
                    {items.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-baseline gap-2.5 px-2 py-1 text-body text-muted"
                      >
                        <span className="text-good">✓</span>
                        <span className="min-w-0 flex-1">{t.title}</span>
                        <span className="tabular shrink-0 text-micro text-faint">
                          {format(t.completedAt!, 'EEE')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {offset === 0 && (
          <section>
            <div className="label-micro mb-2">Where things stand</div>
            <div className="flex flex-col gap-1">
              {summaries
                .filter((s) => s.project.status === 'active')
                .map((s) => (
                  <Link
                    key={s.project.id}
                    to={`/projects/${s.project.id}`}
                    className={`accent-${s.project.accent} flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-2`}
                  >
                    <HealthDot health={s.health} />
                    <span className="min-w-0 flex-1 truncate text-body text-ink">
                      {s.project.name}
                    </span>
                    <span className="shrink-0 text-micro text-faint">{HEALTH_LABEL[s.health]}</span>
                    <span className="tabular w-14 shrink-0 text-right text-micro text-muted">
                      {s.open} open
                    </span>
                  </Link>
                ))}
              {projects.length === 0 && (
                <p className="text-micro text-faint">No projects yet.</p>
              )}
            </div>
          </section>
        )}

        {carried.length > 0 && offset === 0 && (
          <section>
            <div className="label-micro mb-2">Carrying over [{carried.length}]</div>
            <ul className="flex flex-col gap-1">
              {carried.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-baseline gap-2.5 px-2 text-body">
                  <span className="text-bad">!</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{t.title}</span>
                  <span className="shrink-0 text-micro text-faint">
                    {t.projectId ? projectMap.get(t.projectId)?.name : 'Personal'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Page>
  )
}
