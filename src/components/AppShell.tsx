import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSettings, useWorkspace } from '../db/queries'
import { updateSettings } from '../db/actions'
import { focusIsActive, useFocus, useUI } from '../store/ui'
import { HealthDot, IconButton, Kbd, Overlay, cn } from './ui'
import {
  IconFocus,
  IconMeetings,
  IconMoon,
  IconNotes,
  IconOrbit,
  IconPlus,
  IconProjects,
  IconSearch,
  IconSettings,
  IconSpark,
  IconSun,
  IconTasks,
  IconToday,
} from './icons'

/** The five things worth a permanent slot at the bottom of a phone screen. */
const TABS = [
  { to: '/', label: 'Today', icon: IconToday, end: true },
  { to: '/projects', label: 'Projects', icon: IconProjects },
  { to: '/tasks', label: 'Tasks', icon: IconTasks },
  { to: '/meetings', label: 'Agenda', icon: IconMeetings },
  { to: '/notes', label: 'Notes', icon: IconNotes },
]

/** Everything else, one tap away behind "More". */
const SECONDARY = [
  { to: '/focus', label: 'Focus mode', icon: IconFocus, hint: 'One task, a timer, nothing else' },
  { to: '/review', label: 'Weekly review', icon: IconSpark, hint: 'What got done this week' },
  { to: '/settings', label: 'Settings', icon: IconSettings, hint: 'Reminders, theme, your data' },
]

function useThemeCycle() {
  const settings = useSettings()
  return {
    theme: settings.theme,
    cycle: () => {
      const next =
        settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'system' : 'light'
      void updateSettings({ theme: next })
    },
  }
}

function ThemeButton() {
  const { theme, cycle } = useThemeCycle()
  return (
    <IconButton label={`Theme: ${theme}`} onClick={cycle}>
      {theme === 'dark' ? (
        <IconMoon className="h-4 w-4" />
      ) : theme === 'light' ? (
        <IconSun className="h-4 w-4" />
      ) : (
        <span className="text-micro">AUTO</span>
      )}
    </IconButton>
  )
}

/* ------------------------------------------------------------------- mobile */

function BottomTabs() {
  return (
    <nav
      aria-label="Main"
      /* A flex child of the shell rather than `fixed`: on iOS a fixed bar drifts
         during rubber-band scrolling and jumps when the keyboard opens. */
      className="z-30 shrink-0 border-t border-line bg-canvas lg:hidden"
    >
      <div className="flex items-stretch">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 transition-colors',
                isActive ? 'text-accent' : 'text-faint',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'absolute inset-x-3 top-0 h-[2px] bg-accent transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <Icon className="h-[22px] w-[22px]" />
                <span className="w-full truncate text-center text-micro">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function CaptureButton() {
  const setQuickAdd = useUI((s) => s.setQuickAdd)
  return (
    <button
      type="button"
      onClick={() => setQuickAdd(true)}
      aria-label="Capture anything"
      /* Anchored to the scroll area, which already ends where the tab bar
         begins — no duplicating the bar's height in a magic offset. */
      className="absolute bottom-4 right-3 z-30 grid h-13 w-13 place-items-center rounded-lg border-2 border-accent bg-canvas/80 text-accent backdrop-blur transition-transform active:translate-y-px lg:hidden"
    >
      <IconPlus className="h-5 w-5" />
    </button>
  )
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings()
  const { summaries } = useWorkspace()
  const focus = useFocus()
  const navigate = useNavigate()
  const active = summaries.filter((s) => s.project.status === 'active')

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  return (
    <Overlay open={open} onClose={onClose} placement="bottom">
      <div className="flex flex-col gap-4 px-4 pb-6 pt-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-body uppercase tracking-[0.14em]">
            <IconOrbit className="h-4 w-4 text-accent" />
            Orbit
          </span>
          <div className="flex items-center gap-1">
            <span className="tabular text-micro text-faint">
              {settings.openStreak > 1 ? `${settings.openStreak}-day streak` : 'Day one'}
            </span>
            <ThemeButton />
          </div>
        </div>

        {focusIsActive(focus) && (
          <button
            type="button"
            onClick={() => go('/focus')}
            className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent-soft px-3 py-2.5 text-micro uppercase track-wide text-accent-ink"
          >
            <IconFocus className="h-4 w-4" />
            Focus session running
          </button>
        )}

        <div className="flex flex-col">
          {SECONDARY.map(({ to, label, icon: Icon, hint }) => (
            <button
              key={to}
              type="button"
              onClick={() => go(to)}
              className="flex items-center gap-3 rounded-md px-1 py-3 text-left active:bg-surface-2"
            >
              <Icon className="h-5 w-5 shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block text-body text-ink">{label}</span>
                <span className="block truncate text-micro text-faint">{hint}</span>
              </span>
            </button>
          ))}
        </div>

        {active.length > 0 && (
          <div>
            <div className="label-micro mb-1.5">Jump to a project</div>
            <div className="flex flex-col">
              {active.map(({ project, health, open: openCount }) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => go(`/projects/${project.id}`)}
                  className={cn(
                    `accent-${project.accent}`,
                    'flex items-center gap-2.5 rounded-md px-1 py-2.5 text-left active:bg-surface-2',
                  )}
                >
                  <HealthDot health={health} />
                  <span className="min-w-0 flex-1 truncate text-body text-ink">{project.name}</span>
                  <span className="tabular shrink-0 text-micro text-faint">{openCount} open</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Overlay>
  )
}

function MobileTopBar() {
  const togglePalette = useUI((s) => s.togglePalette)
  const [more, setMore] = useState(false)

  return (
    <>
      <header className="z-30 shrink-0 border-b border-line bg-canvas lg:hidden">
        <div className="flex min-h-13 items-center gap-1 px-2">
          <span className="flex items-center gap-2 px-2 text-body uppercase tracking-[0.14em]">
            <IconOrbit className="h-4 w-4 text-accent" />
            Orbit
          </span>
          <div className="flex-1" />
          <IconButton label="Search everything" onClick={togglePalette}>
            <IconSearch className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton label="More" onClick={() => setMore(true)}>
            <span className="text-body leading-none">⋯</span>
          </IconButton>
        </div>
      </header>
      <MoreSheet open={more} onClose={() => setMore(false)} />
    </>
  )
}

/* ------------------------------------------------------------------ desktop */

function RailItem({
  to,
  label,
  icon: Icon,
  end,
  badge,
}: {
  to: string
  label: string
  icon: typeof IconToday
  end?: boolean
  badge?: number
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-body transition-colors',
          isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:bg-surface-2/70 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-accent transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1 truncate">{label}</span>
          {badge ? <span className="tabular text-micro text-faint">{badge}</span> : null}
        </>
      )}
    </NavLink>
  )
}

function Rail() {
  const { summaries, tasks } = useWorkspace()
  const settings = useSettings()
  const focus = useFocus()
  const navigate = useNavigate()
  const { togglePalette, setQuickAdd } = useUI()

  const openCount = tasks.filter((t) => t.status !== 'done').length
  const active = summaries.filter((s) => s.project.status === 'active')

  return (
    <div className="flex h-full flex-col gap-4 px-3 py-4">
      <div className="flex items-center gap-2 px-1.5">
        <IconOrbit className="h-5 w-5 text-accent" />
        <span className="text-body uppercase tracking-[0.14em]">Orbit</span>
      </div>

      <div className="flex gap-1.5 px-0.5">
        <button
          type="button"
          onClick={() => setQuickAdd(true)}
          className="flex h-8 flex-1 items-center gap-2 rounded-md border-2 border-accent bg-transparent px-2 text-micro uppercase track-wide text-accent transition-colors hover:brightness-110"
        >
          <IconPlus className="h-3.5 w-3.5" />
          Capture
        </button>
        <IconButton
          label="Search everything"
          onClick={togglePalette}
          className="border border-line bg-surface"
        >
          <IconSearch className="h-4 w-4" />
        </IconButton>
      </div>

      <nav className="flex flex-col gap-0.5">
        {TABS.map((item) => (
          <RailItem
            key={item.to}
            {...item}
            label={item.to === '/meetings' ? 'Meetings' : item.label}
            badge={item.to === '/tasks' ? openCount : undefined}
          />
        ))}
        <RailItem to="/focus" label="Focus" icon={IconFocus} />
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-quiet">
        <div className="label-micro mb-1.5 px-2.5">Projects</div>
        <div className="flex flex-col gap-0.5">
          {active.length === 0 && (
            <p className="px-2.5 text-micro leading-relaxed text-faint">No active projects yet.</p>
          )}
          {active.map(({ project, health, open }) => (
            <NavLink
              key={project.id}
              to={`/projects/${project.id}`}
              className={({ isActive }) =>
                cn(
                  `accent-${project.accent} flex items-center gap-2 rounded-md px-2.5 py-1.5 text-body transition-colors`,
                  isActive
                    ? 'bg-surface-2 text-ink'
                    : 'text-muted hover:bg-surface-2/70 hover:text-ink',
                )
              }
            >
              <HealthDot health={health} />
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              <span className="tabular text-micro text-faint">{open || ''}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        {focusIsActive(focus) && (
          <button
            type="button"
            onClick={() => navigate('/focus')}
            className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent-soft px-2.5 py-1.5 text-micro uppercase track-wide text-accent-ink"
          >
            <IconFocus className="h-3.5 w-3.5" />
            Focus running
          </button>
        )}
        <div className="flex items-center justify-between px-1">
          <span className="tabular text-micro text-faint">
            {settings.openStreak > 1 ? `${settings.openStreak}-day streak` : 'Day one'}
          </span>
          <div className="flex items-center gap-0.5">
            <ThemeButton />
            <NavLink to="/settings">
              {({ isActive }) => (
                <IconButton label="Settings" className={cn(isActive && 'bg-surface-2 text-ink')}>
                  <IconSettings className="h-4 w-4" />
                </IconButton>
              )}
            </NavLink>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------- shell */

export function AppShell() {
  const location = useLocation()
  const bare = location.pathname === '/focus'

  return (
    /*
     * App-shell layout: the root is pinned to the viewport and the bars are
     * flex children, so they are structurally pinned; only <main> scrolls
     * (a `position: fixed` bar drifts during iOS rubber-banding and jumps
     * when the keyboard opens). No `viewport-fit=cover`, so iOS keeps the
     * bars clear of the notch and home indicator on its own — no manual
     * safe-area padding to keep in sync.
     */
    <div className="app-shell flex overflow-hidden bg-canvas">
      <aside
        className={cn(
          'hidden h-full w-[232px] shrink-0 overflow-y-auto border-r border-line bg-canvas-tint scroll-quiet lg:block',
          bare && 'lg:hidden',
        )}
      >
        <Rail />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {!bare && <MobileTopBar />}
        <div className="relative min-h-0 flex-1">
          <main
            data-app-scroll
            className={cn(
              'h-full overflow-y-auto overscroll-contain scroll-quiet',
              // clearance for the floating capture button
              !bare && 'pb-20 lg:pb-0',
            )}
          >
            <Outlet />
          </main>
          {!bare && <CaptureButton />}
        </div>
        {!bare && <BottomTabs />}
      </div>
    </div>
  )
}

/** Page frame used by every route except Focus. */
export function Page({
  title,
  subtitle,
  actions,
  children,
  wide,
}: {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-5 sm:px-6 sm:py-7 lg:px-8',
        wide ? 'max-w-6xl' : 'max-w-4xl',
      )}
    >
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-head text-ink sm:text-head">{title}</h1>
          {subtitle && <div className="mt-1 text-micro text-muted">{subtitle}</div>}
        </div>
        {actions && (
          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 no-scrollbar sm:mx-0 sm:shrink-0 sm:overflow-visible sm:px-0">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

export function ShortcutHint() {
  return (
    <span className="hidden items-center gap-1 text-micro text-faint sm:inline-flex">
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </span>
  )
}
