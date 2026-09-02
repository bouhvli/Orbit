export type FontKey =
  | 'departure'
  | 'system'
  | 'betania-patmos'
  | 'doto'
  | 'englebert'
  | 'google-sans'
  | 'roboto'
  | 'rubik'

export interface FontOption {
  key: FontKey
  label: string
  /** CSS `font-family` value, fallback stack included. */
  stack: string
}

/**
 * Every font selectable for headings, body text, or dates & numbers. The
 * Google-hosted faces are loaded via the <link> in index.html; Departure and
 * System need no network fetch.
 */
export const FONTS: FontOption[] = [
  {
    key: 'departure',
    label: 'Departure Mono',
    stack: "'Departure Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace",
  },
  {
    key: 'system',
    label: 'System',
    stack: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  { key: 'betania-patmos', label: 'Betania Patmos', stack: "'Betania Patmos', serif" },
  { key: 'doto', label: 'Doto', stack: "'Doto', sans-serif" },
  { key: 'englebert', label: 'Englebert', stack: "'Englebert', serif" },
  { key: 'google-sans', label: 'Google Sans', stack: "'Google Sans', ui-sans-serif, sans-serif" },
  { key: 'roboto', label: 'Roboto', stack: "'Roboto', ui-sans-serif, sans-serif" },
  { key: 'rubik', label: 'Rubik', stack: "'Rubik', ui-sans-serif, sans-serif" },
]

export const FONT_MAP: Record<FontKey, FontOption> = Object.fromEntries(
  FONTS.map((f) => [f.key, f]),
) as Record<FontKey, FontOption>
