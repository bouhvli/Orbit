import type { AccentKey } from '../db/types'

/**
 * The one accent palette, used for both the app's own colour and per-project
 * marks. Each key maps to an `.accent-<key>` class in index.css, which sets
 * `--accent`, `--accent-ink` and `--accent-soft` for light and dark.
 */
export const ACCENTS: { key: AccentKey; label: string }[] = [
  { key: 'indigo', label: 'Indigo' },
  { key: 'violet', label: 'Violet' },
  { key: 'sky', label: 'Sky' },
  { key: 'teal', label: 'Teal' },
  { key: 'lime', label: 'Lime' },
  { key: 'amber', label: 'Amber' },
  { key: 'clay', label: 'Clay' },
  { key: 'rose', label: 'Rose' },
]

export const ACCENT_KEYS = ACCENTS.map((a) => a.key)

export const accentClass = (key: AccentKey) => `accent-${key}`
