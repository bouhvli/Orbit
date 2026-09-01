import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, Select, cn } from '../components/ui'
import { IconPause, IconPlay, IconStop } from '../components/icons'
import { logActivity, patchSubtask, setTaskStatus } from '../db/actions'
import { useProjects, useSettings, useTask, useTasks } from '../db/queries'
import { relativeDay, today } from '../lib/date'
import { setNotificationsMuted } from '../lib/notify'
import { focusIsActive, useFocus, useUI } from '../store/ui'

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0')

function useCountdown(endsAt: number | null, remaining: number | null) {
  const [, force] = useState(0)
  useEffect(() => {
    if (endsAt === null) return
    const t = window.setInterval(() => force((n) => n + 1), 500)
    return () => window.clearInterval(t)
  }, [endsAt])
  if (endsAt !== null) return Math.max(0, endsAt - Date.now())
  return remaining ?? 0
}

export function Focus() {
  const focus = useFocus()
  const settings = useSettings()
  const tasks = useTasks()
  const projects = useProjects()
  const task = useTask(focus.taskId ?? undefined)
  const toast = useUI((s) => s.toast)
  const navigate = useNavigate()

  const active = focusIsActive(focus)
  const ticking = useCountdown(focus.endsAt, focus.remaining)
  const totalMs =
    (focus.mode === 'focus' ? settings.focusMinutes : settings.breakMinutes) * 60_000
  // Idle shows the interval you are about to start, not a spent one.
  const ms = active ? ticking : totalMs
  const progress = active && totalMs ? 1 - ms / totalMs : 0

  useEffect(() => {
    setNotificationsMuted(active)
    return () => setNotificationsMuted(false)
  }, [active])

  // interval finished
  useEffect(() => {
    if (!focus.endsAt || ticking > 0) return
    const wasFocus = focus.mode === 'focus'
    if (wasFocus) {
      void logActivity('focus.session', `Focused for ${settings.focusMinutes} minutes`, {
        projectId: focus.projectId,
        entityId: focus.taskId,
      })
    }
    focus.switchMode(wasFocus ? 'break' : 'focus', wasFocus ? settings.breakMinutes : settings.focusMinutes)
    toast(wasFocus ? 'Interval done — take a break.' : 'Break over. Back to it.')
  }, [ticking, focus.endsAt])

  const candidates = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done')
        .sort((a, b) => {
          const aToday = a.due && a.due <= today() ? 0 : 1
          const bToday = b.due && b.due <= today() ? 0 : 1
          return aToday - bToday
        })
        .slice(0, 40),
    [tasks],
  )

  const project = projects.find((p) => p.id === (task?.projectId ?? focus.projectId))
  const minutes = Math.floor(ms / 60_000)
  const seconds = (ms % 60_000) / 1000

  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col items-center px-5',
        'pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]',
        'pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]',
        project ? `accent-${project.accent}` : '',
      )}
    >
      <header className="flex w-full max-w-2xl items-center justify-between">
        <span className="label-micro">
          {focus.mode === 'break' ? 'Break' : 'Focus'}
          {focus.rounds > 0 && ` · round ${focus.rounds + 1}`}
        </span>
        <Button
          size="sm"
          variant="quiet"
          onClick={() => {
            focus.stop()
            navigate(-1)
          }}
        >
          Leave focus ✕
        </Button>
      </header>

      <div className="flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 py-8">
        <div className="flex flex-col items-center gap-3">
          <span
            className={cn(
              'tabular select-none leading-none',
              focus.paused ? 'text-faint' : 'text-ink',
            )}
            style={{ fontSize: 'clamp(3.4375rem, 16vw, 5.5rem)' }}
          >
            {pad(minutes)}:{pad(seconds)}
          </span>

          <div className="flex w-[min(78vw,22rem)] gap-[2px]" aria-hidden>
            {Array.from({ length: 20 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-3 flex-1',
                  i / 20 < progress
                    ? focus.mode === 'break'
                      ? 'bg-good'
                      : 'bg-accent'
                    : 'bg-line',
                )}
              />
            ))}
          </div>
        </div>

        {task ? (
          <div className="w-full max-w-md text-center">
            <div className="label-micro mb-1.5">
              {project ? project.name : 'Personal'}
              {task.due && ` · due ${relativeDay(task.due)}`}
            </div>
            <p className="text-head text-ink">{task.title}</p>
            {task.subtasks.length > 0 && (
              <div className="mx-auto mt-4 flex max-w-xs flex-col gap-1.5 text-left">
                {task.subtasks.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2.5">
                    <Checkbox
                      size={15}
                      checked={sub.done}
                      label={sub.title}
                      onChange={(v) => void patchSubtask(task, sub.id, { done: v })}
                    />
                    <span
                      className={cn('text-body', sub.done ? 'strike-soft text-faint' : 'text-muted')}
                    >
                      {sub.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-sm">
            <label className="label-micro mb-1.5 block">What are you working on?</label>
            <Select
              value=""
              onChange={(e) => {
                const picked = tasks.find((t) => t.id === e.target.value)
                if (picked) focus.setTarget({ taskId: picked.id, projectId: picked.projectId })
              }}
            >
              <option value="">Pick a task (optional)</option>
              {candidates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2">
          {!active ? (
            <Button
              variant="primary"
              size="lg"
              onClick={() =>
                focus.start({
                  taskId: focus.taskId,
                  projectId: focus.projectId,
                  minutes: settings.focusMinutes,
                })
              }
            >
              <IconPlay className="h-4 w-4" />
              Start {settings.focusMinutes} minutes
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => (focus.paused ? focus.resume() : focus.pause())}
              >
                {focus.paused ? <IconPlay className="h-4 w-4" /> : <IconPause className="h-4 w-4" />}
                {focus.paused ? 'Resume' : 'Pause'}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => focus.stop()}>
                <IconStop className="h-4 w-4" />
                Stop
              </Button>
            </>
          )}
          {task && (
            <Button
              size="lg"
              variant="ghost"
              onClick={() => {
                void setTaskStatus(task.id, 'done')
                focus.setTarget({ taskId: null, projectId: focus.projectId })
                toast('Done. Nice.')
              }}
            >
              ✓ Mark done
            </Button>
          )}
        </div>
      </div>

      <footer className="flex w-full max-w-2xl items-center justify-between text-micro text-faint">
        <span>Notifications are paused while you focus.</span>
        {task && (
          <button
            type="button"
            onClick={() => focus.setTarget({ taskId: null, projectId: null })}
            className="hover:text-ink"
          >
            Change task
          </button>
        )}
      </footer>
    </div>
  )
}
