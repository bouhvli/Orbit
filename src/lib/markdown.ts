import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ breaks: true, gfm: true })

/** Markdown -> sanitised HTML. Notes are local, but sanitise anyway. */
export function renderMarkdown(src: string): string {
  const html = marked.parse(src ?? '', { async: false }) as string
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

/** First meaningful line, used as a preview and as an auto-title. */
export function firstLine(src: string, max = 120): string {
  const line = (src ?? '')
    .split('\n')
    .map((l) => l.replace(/^[#>\-*\s]+/, '').trim())
    .find(Boolean)
  if (!line) return ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

export function wordCount(src: string): number {
  return (src ?? '').trim().split(/\s+/).filter(Boolean).length
}
