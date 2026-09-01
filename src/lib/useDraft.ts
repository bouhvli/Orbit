import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Local buffer for a text field whose source of truth is IndexedDB.
 *
 * Writing every keystroke straight to Dexie makes the input controlled by an
 * async round-trip: type quickly and characters land after the value snaps back,
 * so they are lost. Instead we hold the text locally, ignore incoming values
 * while there are unsaved edits, and persist on a short debounce (plus on blur
 * and unmount).
 *
 * Editors that can swap the underlying record must be remounted with a `key`,
 * so a pending edit is always flushed to the record it was typed into.
 */
export function useDraft(remote: string, commit: (next: string) => void, delay = 350) {
  const [value, setValue] = useState(remote)
  const valueRef = useRef(remote)
  const dirty = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const commitRef = useRef(commit)
  commitRef.current = commit

  useEffect(() => {
    if (dirty.current) return
    setValue(remote)
    valueRef.current = remote
  }, [remote])

  const flush = useCallback(() => {
    if (timer.current !== undefined) {
      window.clearTimeout(timer.current)
      timer.current = undefined
    }
    if (!dirty.current) return
    dirty.current = false
    commitRef.current(valueRef.current)
  }, [])

  const onChange = useCallback(
    (next: string) => {
      valueRef.current = next
      dirty.current = true
      setValue(next)
      if (timer.current !== undefined) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, delay)
    },
    [delay, flush],
  )

  useEffect(() => () => flush(), [flush])

  return { value, onChange, flush }
}

/** Props for a plain <input>/<textarea>, wired to a draft. */
export function draftProps(draft: ReturnType<typeof useDraft>) {
  return {
    value: draft.value,
    onChange: (e: { target: { value: string } }) => draft.onChange(e.target.value),
    onBlur: draft.flush,
  }
}
