# Orbit

A personal work command center. One place for the projects, tasks, meetings and
notes you are juggling, built to answer a single question every time you open it:

> **What do I actually need to do right now, across everything?**

No feed, no second inbox, nothing to scroll. Local-first: every byte lives in
this browser on this device.

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # production bundle in dist/
pnpm preview    # serve dist/ — the service worker only runs in a real build
pnpm typecheck  # app + service worker
```

---

## What is in it

| Route | What it does |
| --- | --- |
| `/` | **Today** — schedule, what slipped, what is due, grouped by project. Quick capture at the top, a small momentum strip underneath. |
| `/projects` | Every project as a card: health, open/overdue counts, progress, next meeting. |
| `/projects/:id` | **Project workspace** — Overview, Tasks (list or board), Meetings, Docs. |
| `/tasks` | Global task view, filterable by today / week / overdue / someday, grouped by project or by date. |
| `/meetings` | Week agenda, plus upcoming and past lists. |
| `/notes` | All notes across all projects, searchable, Markdown. |
| `/review` | Weekly review — what got done, where things stand, what is carrying over. |
| `/focus` | One task, a timer, nothing else. Notifications pause. |
| `/settings` | Theme, accent colour, reminders, focus intervals, install, export/import, sample data. |

### The workflows that matter

- **Quick capture** — type one line, hit enter, sort it later. It understands
  `#project`, `!high` / `!low`, `today` / `tomorrow` / `friday` / `in 3d` / `12/03`,
  and `every week` / `every weekday`. Anything it does not recognise stays in the
  title, so capture never silently eats words.
- **Meeting notes → tasks** — write notes normally; start a line with `[ ]` (or
  `TODO:`) and Orbit offers it as a follow-up task, linked back to the meeting.
  One click each, or *Add all*. `Line → task` converts whatever line the caret is on.
- **Note → task** — select text in a note and turn it into a task linked to that note.
- **Pull into Today** — bring a task onto Today without lying about its due date.
- **Project health** — automatic by default (anything overdue → *at risk*; open work
  untouched for two weeks → *stalled*), or set by hand.

### Colour

Buttons are underlined links rather than boxes — the only chrome is the
underline, colour-coded by intent (accent for primary, red for destructive).
The capture button is the one exception: it keeps its shape, but transparent,
with just an accent border and glyph.

One palette of eight accents serves two jobs. **Settings → Accent colour** sets
the app's own accent — nav, buttons, focus timer, capture. Each **project** picks
its own from the same palette, and that wins inside the project, so a task row
always carries the colour of the work it belongs to.

Mechanically each accent is an `.accent-<key>` class in `index.css` that sets
`--accent`, `--accent-ink` and `--accent-soft`, with separate values for light
and dark. The app accent goes on `<body>` rather than `<html>` — the dark
overrides are written `.dark .accent-x`, so they need `.dark` on an *ancestor*
to match. Project scopes are just the same class further down the tree.

### Mobile first

The phone is the primary target; the desktop rail is the adaptation, not the
other way round.

- **Bottom tab bar** for the five things worth a permanent slot — Today,
  Projects, Tasks, Agenda, Notes — with everything else (Focus, Weekly review,
  Settings, jump-to-project) behind **More**. No hamburger drawer.
- **Capture is a thumb button**, fixed above the tab bar, because friction-free
  capture is the whole point.
- **Detail views are bottom sheets** on a phone and side panels on a desktop —
  same component, `placement` decides.
- **No hover-only controls.** Row actions use `.row-actions`, which is always
  visible under `(hover: none)` and reveals on hover with a pointer. Anything
  that only existed on hover has a touch path: *Pull into Today* lives in the
  task sheet, and board cards get ◀ ▶ steppers because HTML5 drag-and-drop does
  not fire on touch.
- **Fingertip sizing first**: controls are 40–48px by default and tighten at
  `sm:`. Small marks (checkboxes, switches) get a 44px hit area from the `.tap`
  utility without changing how they look.
- **App-shell layout.** The root is pinned with `fixed inset-0` — *not* sized in
  `dvh`, which iOS standalone can report short of the real screen and leave a
  dead strip under the tab bar. The top bar and tab bar are flex children of
  that root and only `<main>` scrolls, so the bars are pinned structurally
  rather than by `position: fixed`, which drifts during iOS rubber-banding and
  jumps when the keyboard opens.
- **No zoom.** The viewport is locked (`maximum-scale=1, user-scalable=no`),
  with `text-size-adjust: 100%` and `touch-action: manipulation` so iOS neither
  rescales type on rotation nor waits for a double-tap.
- **Date and time inputs** are forced to obey their box: Safari sizes them from
  their *value*, so a `w-full` one still overflows its container on iOS until
  you give it `appearance: none; min-width: 0; max-width: 100%`.
- **Safe areas**: each bar carries its own inset padding, so the *background*
  bleeds under the notch and home indicator while the *content* stays clear.
  Horizontal insets are handled too, for a notch in landscape. Top-anchored
  sheets (search, capture) pad for the notch as well. The type scale steps down
  one notch below 480px.
- Verified in a real browser at 320px, 390px and 1440px.

### Keyboard

The phone never depends on these, but they are there on a desktop.

| Key | Action |
| --- | --- |
| `c` | Capture anything |
| `⌘K` / `Ctrl+K`, `/` | Search everything (tasks, projects, meetings, notes) + commands |
| `↑` `↓` `↵` | Move and open in the palette |
| `⌘⇧↵` | In meeting notes: turn the current line into a task |
| `Esc` | Close whatever is open |

---

## How it is built

- **React 19 + TypeScript + Vite**, `react-router` for routing.
- **Dexie (IndexedDB)** as the store, with `dexie-react-hooks`' `useLiveQuery`
  driving the UI — mutate the database and every view that reads it updates.
  There is no separate client cache to keep in sync.
- **Zustand** only for ephemeral UI state (palette, sheets, focus timer).
- **Tailwind CSS v4**, configured in `src/index.css` via `@theme`.
- **PWA**: `vite-plugin-pwa` in `injectManifest` mode — Workbox generates the
  precache manifest, `src/sw.ts` is our own worker. See *Install it* below.

```
src/
  db/        types, Dexie schema, mutations (actions.ts), live queries, seed data
  lib/       dates, markdown, quick-capture parser, notifications, draft buffering, pwa
  store/     zustand: UI overlays + focus session
  components/ shell, primitives, palette, capture, task/meeting sheets
  routes/    one file per screen
  sw.ts      service worker (own tsconfig — it is a worker, not a DOM script)
```

### Three decisions worth knowing about

**Text fields are buffered, not written per keystroke.** `lib/useDraft.ts` holds
the text locally and persists on a short debounce, plus on blur and unmount.
Writing every keystroke straight to Dexie makes an input controlled by an async
round-trip, and characters typed quickly are dropped. Editors that can swap the
underlying record are remounted with a `key`, so a pending edit always flushes to
the record it was typed into.

**Class conflicts are resolved, not hoped for.** `cn()` runs `tailwind-merge`,
so a per-instance `h-10 w-[150px]` reliably beats the base `h-11 w-full` instead
of depending on the order Tailwind happened to emit. The custom scales from
`index.css` are registered with it.

**Activity is logged, not derived.** Mutations append to an `activity` table.
That is what powers the project timeline and the weekly review, and it means
"what happened" survives edits to the things it happened to.

### Install it

Orbit is a real installable PWA, not a page with a manifest bolted on.

- **Install** from the browser's install button, or from Settings → Install.
  Chrome hands the page a deferred prompt and the button uses it; Safari never
  fires that event, so iOS gets the *Share → Add to Home Screen* instructions
  instead. Once installed the button says so rather than lying.
- **Offline from the first launch.** The entire build is precached (about 20
  entries, including the font), so an installed Orbit opens with no connection at
  all — even on a device that has never loaded a given page. Data was already
  local, so nothing degrades offline.
- **Updates are offered, not forced.** A new worker downloads in the background
  and the page shows *"A new version of Orbit is ready — Reload"*. It does not
  reload underneath you, because a silent reload can discard a debounced edit
  that has not been flushed yet.
- **App shortcuts** (long-press the icon): Capture, Agenda, Focus. Capture lands
  on `/?capture=1`, which opens the capture sheet and cleans the parameter out of
  the URL.
- **iOS**: `apple-mobile-web-app-capable`, a PNG touch icon, and a translucent
  status bar with `env(safe-area-inset-*)` respected on the top bar, tab bar,
  capture button and toasts.
- Icons are generated from `assets/icon-source.jpg` — 192/512 `any` plus 192/512
  `maskable` (artwork scaled to 72% so Android's adaptive mask cannot crop it),
  a 180px Apple touch icon and two favicons. The source JPEG's compression noise
  is flattened to the exact background colour first, so the large flat area
  compresses properly. The big icons are deliberately *excluded from the
  precache* — the installer and the OS keep their own copy, and precaching them
  would nearly double the offline payload.

The worker is **off in development** — a service worker plus HMR is a confusing
combination. Test it with `pnpm build && pnpm preview`, or run the dev server
with `VITE_PWA_DEV=true pnpm dev`.

### Notifications

Reminders (morning digest, meeting heads-up, due-soon nudge) run on an in-app
loop while Orbit is open, and de-duplicate through `localStorage`. Install it as
an app to keep it running in the background. The "welcome back" note after a
couple of quiet days is shown in-app rather than pushed — it should feel
supportive, not like a debt collector. Everything is switchable in Settings.

### Your data

There is no account and no server. Settings → Export writes a single JSON file
with everything; Import replaces the contents from one. Deleting is deliberate
and irreversible.

---

## Typeface

[Departure Mono](https://departuremono.com) by Helena Zhang, licensed under the
SIL Open Font License 1.1 — the licence ships at
`public/fonts/DepartureMono-OFL.txt` and is linked from Settings.

It is drawn on an 11px pixel grid, so the whole type scale is built on multiples
of 5.5px (11 / 16.5 / 22 / 33 / 44) and the geometry is kept crisp to match:
1px hairlines, 2–5px radii, hard offset shadows, square checkboxes. Hierarchy
comes from size, case and colour rather than weight, because the family has a
single weight. If long notes read better in a system sans, Settings → Reading
typeface swaps the note body only.

---

## Not built yet

- Sync across devices (would mean adding a backend — deliberately out of scope for v1).
- Calendar import; meetings are entered by hand.
- Sub-projects, tags, attachments.
- Scheduled push when the app is fully closed. Reminders run while Orbit is
  open (installed apps stay open far longer); true background push needs a push
  service and a server to send from, which v1 deliberately does not have.
