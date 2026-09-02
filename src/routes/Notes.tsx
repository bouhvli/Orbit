import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Page } from '../components/AppShell'
import {
  Button,
  EmptyState,
  Input,
  Segmented,
  Select,
  cn,
} from '../components/ui'
import { IconNotes, IconPlus, IconTrash } from '../components/icons'
import { createNote, createTask, deleteNote, updateNote } from '../db/actions'
import { useNote, useNotes, useProjects, useWorkspace } from '../db/queries'
import type { Note } from '../db/types'
import { relativeDay, toISODate } from '../lib/date'
import { firstLine, renderMarkdown, wordCount } from '../lib/markdown'
import { draftProps, useDraft } from '../lib/useDraft'
import { useUI } from '../store/ui'

function Editor({ note }: { note: Note }) {
  const projects = useProjects(true)
  const toast = useUI((s) => s.toast)
  const [mode, setMode] = useState<'write' | 'read'>('write')
  const [, setParams] = useSearchParams()
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const title = useDraft(note.title, (v) => void updateNote(note.id, { title: v }))
  const body = useDraft(note.body, (v) => void updateNote(note.id, { body: v }))

  /** Selected text (or the caret's line) becomes a task linked to this note. */
  const selectionToTask = async () => {
    const el = areaRef.current
    if (!el) return
    let text = el.value.slice(el.selectionStart, el.selectionEnd).trim()
    if (!text) {
      const before = el.value.slice(0, el.selectionStart)
      const index = before.split('\n').length - 1
      text = (el.value.split('\n')[index] ?? '').replace(/^\s*[-*]\s*/, '').trim()
    }
    if (!text) return
    await createTask({
      title: text.slice(0, 160),
      projectId: note.projectId,
      noteId: note.id,
      priority: 'med',
    })
    toast(`“${text.slice(0, 40)}${text.length > 40 ? '…' : ''}” is now a task`)
  }

  const project = projects.find((p) => p.id === note.projectId)

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', project && `accent-${project.accent}`)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto sm:flex-1">
          <button
            type="button"
            onClick={() => setParams({})}
            aria-label="Back to all notes"
            className="shrink-0 text-micro uppercase track-wide text-muted hover:text-ink lg:hidden"
          >
            ← All
          </button>
          <input
            {...draftProps(title)}
            placeholder="Untitled note"
            className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none"
            aria-label="Note title"
          />
        </div>
        <Select
          className="h-10 w-auto max-w-[160px] text-micro sm:h-8"
          value={note.projectId ?? ''}
          onChange={(e) => void updateNote(note.id, { projectId: e.target.value || null })}
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'write', label: 'Write' },
            { value: 'read', label: 'Read' },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-quiet">
        {mode === 'write' ? (
          <textarea
            ref={areaRef}
            {...draftProps(body)}
            placeholder={'# Heading\n\nMarkdown works here.\n\n- a list\n- another item'}
            className="h-full min-h-[50vh] w-full resize-none bg-transparent px-4 py-4 text-body leading-relaxed outline-none placeholder:text-faint"
            style={{ fontFamily: 'var(--font-body)' }}
          />
        ) : (
          <div
            className="prose-note px-4 py-4"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(body.value || '_This note is empty._'),
            }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
        <span className="tabular text-micro text-faint">
          {wordCount(body.value)} words · saved{' '}
          {relativeDay(toISODate(note.updatedAt)).toLowerCase()}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {mode === 'write' && (
            <Button size="sm" variant="ghost" onClick={() => void selectionToTask()}>
              <IconPlus className="h-3.5 w-3.5" />
              Selection → task
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            aria-label="Delete note"
            title="Delete note"
            onClick={() => {
              void deleteNote(note.id)
              setParams({})
              toast('Note deleted')
            }}
          >
            <IconTrash className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function Notes() {
  const notes = useNotes()
  const { projectMap } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const selected = params.get('note')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notes
    return notes.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(q))
  }, [notes, query])

  useEffect(() => {
    if (!selected && filtered.length && window.innerWidth >= 1024) {
      setParams({ note: filtered[0].id }, { replace: true })
    }
  }, [selected, filtered, setParams])

  const newNote = async () => {
    const note = await createNote({ title: 'Untitled note' })
    setParams({ note: note.id })
  }

  return (
    <Page
      wide
      title="Notes"
      subtitle={`${notes.length} across all projects`}
      actions={
        <Button variant="primary" onClick={() => void newNote()}>
          <IconPlus className="h-4 w-4" />
          New note
        </Button>
      }
    >
      {notes.length === 0 ? (
        <EmptyState
          icon={<IconNotes className="h-6 w-6" />}
          title="Nothing written yet"
          body="Meeting notes, decisions, drafts, reference material — one searchable place, whatever project it belongs to."
          action={
            <Button variant="primary" onClick={() => void newNote()}>
              <IconPlus className="h-4 w-4" />
              Start a note
            </Button>
          }
        />
      ) : (
        <div className="grid min-h-[60vh] grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <div className={cn('flex min-h-0 min-w-0 flex-col gap-2', selected && 'hidden lg:flex')}>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all notes…"
              className="h-10 sm:h-8"
            />
            <div className="flex flex-col gap-1 overflow-y-auto scroll-quiet">
              {filtered.length === 0 && (
                <p className="px-2 py-3 text-micro text-faint">Nothing matches “{query}”.</p>
              )}
              {filtered.map((note) => {
                const project = note.projectId ? projectMap.get(note.projectId) : undefined
                const active = note.id === selected
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setParams({ note: note.id })}
                    className={cn(
                      project ? `accent-${project.accent}` : '',
                      'rounded-md border px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'border-accent bg-accent-soft/50'
                        : 'border-transparent hover:bg-surface-2',
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {project && <span className="h-[7px] w-[7px] shrink-0 bg-accent" />}
                      <span className="min-w-0 flex-1 truncate text-body text-ink">
                        {note.title}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-micro text-faint">
                      {firstLine(note.body, 60) || 'Empty'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div
            className={cn(
              'card flex min-h-0 min-w-0 flex-col overflow-hidden',
              !selected && 'hidden lg:flex',
            )}
          >
            <EditorPane id={selected} />
          </div>
        </div>
      )}
    </Page>
  )
}

/** Resolves the selected note and remounts the editor whenever it changes, so
 *  a half-typed draft is always flushed to the note it belongs to. */
function EditorPane({ id }: { id: string | null }) {
  const note = useNote(id ?? undefined)

  if (!id) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <p className="text-micro text-faint">Pick a note, or start a new one.</p>
      </div>
    )
  }
  if (!note) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <EmptyState title="Note not found" body="It may have been deleted." />
      </div>
    )
  }
  return <Editor key={note.id} note={note} />
}
