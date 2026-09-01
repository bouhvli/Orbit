import { useMemo, useRef, useState } from 'react'
import { createTask, deleteMeeting, updateMeeting } from '../db/actions'
import { useMeeting, useProjects, useTasks } from '../db/queries'
import { dayLabel, timeLabel } from '../lib/date'
import { renderMarkdown } from '../lib/markdown'
import { draftProps, useDraft } from '../lib/useDraft'
import { useUI } from '../store/ui'
import type { Meeting } from '../db/types'
import { Button, DialogHeader, Field, Input, Overlay, Segmented, Select, cn } from './ui'
import { IconPlus, IconTasks, IconTrash } from './icons'

const ACTION_PATTERNS = [
  /^(\s*)(?:[-*]\s*)?\[\s*\]\s+(.+)$/,
  /^(\s*)(?:[-*]\s*)?(?:TODO|AI|ACTION)[:\s]\s*(.+)$/i,
]

interface ActionLine {
  index: number
  indent: string
  text: string
}

function findActionLines(body: string): ActionLine[] {
  return body.split('\n').flatMap((line, index) => {
    for (const re of ACTION_PATTERNS) {
      const m = re.exec(line)
      if (m) return [{ index, indent: m[1] ?? '', text: m[2].trim() }]
    }
    return []
  })
}

const localDateTime = (ms: number) => {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}

const editorClass =
  'w-full resize-y rounded-md border border-line bg-surface px-3 py-2.5 text-body leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-accent/20'

function NotesEditor({ meeting }: { meeting: Meeting }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)
  const toast = useUI((s) => s.toast)
  const draft = useDraft(meeting.notes, (notes) => void updateMeeting(meeting.id, { notes }))
  const actions = useMemo(() => findActionLines(draft.value), [draft.value])

  const writeLines = (lines: string[]) => {
    draft.onChange(lines.join('\n'))
    draft.flush()
  }

  const capture = (title: string) =>
    createTask({
      title,
      projectId: meeting.projectId,
      meetingId: meeting.id,
      priority: 'med',
    })

  const convert = async (line: ActionLine) => {
    await capture(line.text)
    const lines = draft.value.split('\n')
    lines[line.index] = `${line.indent}- [x] ${line.text}`
    writeLines(lines)
    toast(`“${line.text}” is now a task`)
  }

  const convertAll = async () => {
    const lines = draft.value.split('\n')
    for (const line of actions) {
      await capture(line.text)
      lines[line.index] = `${line.indent}- [x] ${line.text}`
    }
    writeLines(lines)
    toast(`${actions.length} follow-up task${actions.length === 1 ? '' : 's'} created`)
  }

  /** Turn the line the caret sits on into an action item, then a task. */
  const convertCaretLine = async () => {
    const el = ref.current
    if (!el) return
    const index = el.value.slice(0, el.selectionStart).split('\n').length - 1
    const lines = el.value.split('\n')
    const raw = lines[index] ?? ''
    const existing = findActionLines(el.value).find((a) => a.index === index)
    const text = (existing?.text ?? raw.replace(/^\s*[-*]\s*/, '')).trim()
    if (!text) return
    await capture(text)
    lines[index] = `${raw.match(/^\s*/)?.[0] ?? ''}- [x] ${text}`
    writeLines(lines)
    toast(`“${text}” is now a task`)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Segmented
          value={preview ? 'preview' : 'write'}
          onChange={(v) => setPreview(v === 'preview')}
          options={[
            { value: 'write', label: 'Write' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
        <Button size="sm" variant="ghost" onClick={() => void convertCaretLine()}>
          <IconTasks className="h-3.5 w-3.5" />
          Line → task
        </Button>
      </div>

      {preview ? (
        <div
          className="prose-note min-h-40 rounded-md border border-line bg-surface-2/40 px-3 py-3"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.value || '_No notes yet._') }}
        />
      ) : (
        <textarea
          ref={ref}
          {...draftProps(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void convertCaretLine()
            }
          }}
          placeholder={'What happened?\n\nStart a line with [ ] to mark an action item.'}
          rows={12}
          className={editorClass}
        />
      )}

      {actions.length > 0 && (
        <div className="rounded-md border border-accent/30 bg-accent-soft/50 p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="label-micro text-accent-ink">
              {actions.length} action item{actions.length === 1 ? '' : 's'} found
            </span>
            <button
              type="button"
              onClick={() => void convertAll()}
              className="text-micro uppercase track-wide text-accent-ink underline underline-offset-2"
            >
              Add all
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {actions.map((a) => (
              <li key={a.index} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void convert(a)}
                  title="Turn into a task"
                  aria-label={`Turn "${a.text}" into a task`}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-sm border border-accent/40 text-accent-ink hover:bg-accent hover:text-canvas"
                >
                  <IconPlus className="h-3 w-3" />
                </button>
                <span className="min-w-0 flex-1 truncate text-micro text-ink">{a.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function MeetingBody({ meeting }: { meeting: Meeting }) {
  const openTask = useUI((s) => s.openTask)
  const openMeeting = useUI((s) => s.openMeeting)
  const projects = useProjects(true)
  const allTasks = useTasks()
  const [tab, setTab] = useState<'prep' | 'notes'>(
    meeting.start < Date.now() ? 'notes' : 'prep',
  )

  const summary = useDraft(meeting.summary, (v) => void updateMeeting(meeting.id, { summary: v }))
  const prep = useDraft(meeting.prep, (v) => void updateMeeting(meeting.id, { prep: v }))
  const attendees = useDraft(meeting.attendees.join(', '), (v) =>
    void updateMeeting(meeting.id, {
      attendees: v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    }),
  )

  const followUps = allTasks.filter((t) => t.meetingId === meeting.id)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-quiet px-4 py-4">
      <div className="flex flex-col gap-5">
        <Field label="What this is about">
          <Input placeholder="One line, so Today can show it" {...draftProps(summary)} />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Project">
            <Select
              value={meeting.projectId ?? ''}
              onChange={(e) => void updateMeeting(meeting.id, { projectId: e.target.value || null })}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Duration">
            <Select
              value={String(meeting.durationMin)}
              onChange={(e) =>
                void updateMeeting(meeting.id, { durationMin: Number(e.target.value) })
              }
            >
              {[15, 30, 45, 60, 90, 120].map((n) => (
                <option key={n} value={n}>
                  {n} min
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Starts">
            <Input
              type="datetime-local"
              value={localDateTime(meeting.start)}
              onChange={(e) => {
                const next = new Date(e.target.value).getTime()
                if (!Number.isNaN(next)) void updateMeeting(meeting.id, { start: next })
              }}
            />
          </Field>
          <Field label="Attendees">
            <Input placeholder="Names, comma separated" {...draftProps(attendees)} />
          </Field>
        </div>

        <div>
          <Segmented
            className="mb-3"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'prep', label: 'Prep' },
              { value: 'notes', label: 'Notes' },
            ]}
          />
          {tab === 'prep' ? (
            <textarea
              {...draftProps(prep)}
              placeholder={'What do you need before this?\n- Read the plan\n- Decide on X'}
              rows={8}
              className={editorClass}
            />
          ) : (
            <NotesEditor meeting={meeting} />
          )}
        </div>

        {followUps.length > 0 && (
          <div>
            <div className="label-micro mb-1.5">Follow-ups from this meeting</div>
            <div className="flex flex-col gap-1">
              {followUps.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    openMeeting(null)
                    openTask(t.id)
                  }}
                  className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left text-micro hover:border-line-strong"
                >
                  <span className={cn(t.status === 'done' ? 'text-good' : 'text-faint')}>
                    {t.status === 'done' ? '✓' : '□'}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate',
                      t.status === 'done' ? 'strike-soft text-faint' : 'text-ink',
                    )}
                  >
                    {t.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MeetingTitle({ meeting }: { meeting: Meeting }) {
  const title = useDraft(meeting.title, (v) => {
    if (v.trim()) void updateMeeting(meeting.id, { title: v.trim() })
  })
  return (
    <input
      {...draftProps(title)}
      className="w-full bg-transparent text-body outline-none"
      aria-label="Meeting title"
    />
  )
}

export function MeetingSheet() {
  const id = useUI((s) => s.openMeetingId)
  const openMeeting = useUI((s) => s.openMeeting)
  const toast = useUI((s) => s.toast)
  const close = () => openMeeting(null)
  const meeting = useMeeting(id ?? undefined)
  const projects = useProjects(true)

  if (!id || !meeting) return null

  const project = meeting.projectId ? projects.find((p) => p.id === meeting.projectId) : undefined

  return (
    <Overlay open onClose={close} placement="right">
      <div className={project ? `accent-${project.accent}` : undefined}>
        <DialogHeader
          title={<MeetingTitle key={meeting.id} meeting={meeting} />}
          subtitle={`${dayLabel(meeting.start)} · ${timeLabel(meeting.start)} · ${meeting.durationMin} min`}
        />
      </div>

      <MeetingBody key={meeting.id} meeting={meeting} />

      <footer className="flex items-center justify-end border-t border-line px-4 py-2.5">
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            void deleteMeeting(meeting.id)
            close()
            toast('Meeting deleted')
          }}
        >
          <IconTrash className="h-3.5 w-3.5" />
          Delete
        </Button>
      </footer>
    </Overlay>
  )
}
