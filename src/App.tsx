import { useEffect } from 'react'
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CommandPalette } from './components/CommandPalette'
import { MeetingSheet } from './components/MeetingSheet'
import { Onboarding } from './components/Onboarding'
import { QuickCaptureModal } from './components/QuickCapture'
import { TaskSheet } from './components/TaskSheet'
import { Toaster } from './components/Toaster'
import { touchOpenStreak } from './db/actions'
import { useSettings } from './db/queries'
import { startNotificationLoop } from './lib/notify'
import { initServiceWorker, reloadWithUpdate } from './lib/pwa'
import { useUI } from './store/ui'
import { Focus } from './routes/Focus'
import { Meetings } from './routes/Meetings'
import { Notes } from './routes/Notes'
import { ProjectWorkspace } from './routes/ProjectWorkspace'
import { Projects } from './routes/Projects'
import { Review } from './routes/Review'
import { Settings } from './routes/Settings'
import { Tasks } from './routes/Tasks'
import { Today } from './routes/Today'

const SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

function useTheme() {
  const { theme, readingFont, accent } = useSettings()

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      root.classList.toggle('dark', dark)
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#121116' : '#f7f4ee')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--font-read',
      readingFont === 'sans' ? SANS : "'Departure Mono', ui-monospace, monospace",
    )
  }, [readingFont])

  // The accent class lives on <body>, not <html>: the dark overrides are written
  // as `.dark .accent-x`, so they need `.dark` on an *ancestor* to match.
  useEffect(() => {
    const { classList } = document.body
    // snapshot first: DOMTokenList is live, so removing while iterating skips entries
    for (const c of [...classList]) if (c.startsWith('accent-')) classList.remove(c)
    classList.add(`accent-${accent}`)
  }, [accent])
}

/** App-wide keyboard layer. Stays out of the way while you are typing. */
function useShortcuts() {
  const { togglePalette, setQuickAdd, setPalette } = useUI()

  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const node = el as HTMLElement | null
      if (!node) return false
      const tag = node.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable
    }

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        togglePalette()
        return
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'c') {
        e.preventDefault()
        setQuickAdd(true)
      } else if (e.key === '/') {
        e.preventDefault()
        setPalette(true)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePalette, setQuickAdd, setPalette])
}

/** `/?capture=1` — the manifest's "Capture" app shortcut lands here. */
function useAppShortcuts() {
  const [params, setParams] = useSearchParams()
  const setQuickAdd = useUI((s) => s.setQuickAdd)

  useEffect(() => {
    if (params.get('capture') === null) return
    setQuickAdd(true)
    const next = new URLSearchParams(params)
    next.delete('capture')
    setParams(next, { replace: true })
  }, [params, setParams, setQuickAdd])
}

export default function App() {
  const toast = useUI((s) => s.toast)
  useTheme()
  useShortcuts()
  useAppShortcuts()

  useEffect(() => {
    void touchOpenStreak()
    return startNotificationLoop()
  }, [])

  // Offer the update rather than forcing it — a silent reload could drop an
  // edit that has not been flushed to IndexedDB yet.
  useEffect(() => {
    initServiceWorker({
      onNeedRefresh: () =>
        toast('A new version of Orbit is ready.', {
          label: 'Reload',
          run: () => void reloadWithUpdate(),
        }),
    })
  }, [toast])

  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Today />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectWorkspace />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/review" element={<Review />} />
          <Route path="/focus" element={<Focus />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      <CommandPalette />
      <QuickCaptureModal />
      <TaskSheet />
      <MeetingSheet />
      <Onboarding />
      <Toaster />
    </>
  )
}
