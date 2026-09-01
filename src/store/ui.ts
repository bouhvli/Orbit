import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from '../lib/id'

export interface Toast {
  id: string
  message: string
  action?: { label: string; run: () => void }
}

interface UIState {
  paletteOpen: boolean
  setPalette: (open: boolean) => void
  togglePalette: () => void

  quickAddOpen: boolean
  setQuickAdd: (open: boolean) => void

  toasts: Toast[]
  toast: (message: string, action?: Toast['action']) => void
  dismissToast: (id: string) => void


  /** Detail overlays, addressed by entity id. */
  openTaskId: string | null
  openTask: (id: string | null) => void
  openMeetingId: string | null
  openMeeting: (id: string | null) => void
}

export const useUI = create<UIState>((set, get) => ({
  paletteOpen: false,
  setPalette: (paletteOpen) => set({ paletteOpen }),
  togglePalette: () => set({ paletteOpen: !get().paletteOpen }),

  quickAddOpen: false,
  setQuickAdd: (quickAddOpen) => set({ quickAddOpen }),

  toasts: [],
  toast: (message, action) => {
    const id = uid('t')
    set({ toasts: [...get().toasts, { id, message, action }] })
    window.setTimeout(() => get().dismissToast(id), 5000)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  openTaskId: null,
  openTask: (openTaskId) => set({ openTaskId }),
  openMeetingId: null,
  openMeeting: (openMeetingId) => set({ openMeetingId }),
}))

export type FocusMode = 'focus' | 'break'

interface FocusState {
  taskId: string | null
  projectId: string | null
  mode: FocusMode
  /** epoch ms the current interval ends; null when idle */
  endsAt: number | null
  paused: boolean
  /** ms remaining, captured while paused */
  remaining: number | null
  /** completed focus intervals in the current sitting */
  rounds: number
  start: (opts: { taskId?: string | null; projectId?: string | null; minutes: number }) => void
  pause: () => void
  resume: () => void
  stop: () => void
  switchMode: (mode: FocusMode, minutes: number) => void
  setTarget: (opts: { taskId?: string | null; projectId?: string | null }) => void
}

export const useFocus = create<FocusState>()(
  persist(
    (set, get) => ({
      taskId: null,
      projectId: null,
      mode: 'focus',
      endsAt: null,
      paused: false,
      remaining: null,
      rounds: 0,
      start: ({ taskId = null, projectId = null, minutes }) =>
        set({
          taskId,
          projectId,
          mode: 'focus',
          endsAt: Date.now() + minutes * 60_000,
          paused: false,
          remaining: null,
        }),
      pause: () => {
        const { endsAt } = get()
        if (!endsAt) return
        set({ paused: true, remaining: Math.max(0, endsAt - Date.now()), endsAt: null })
      },
      resume: () => {
        const { remaining } = get()
        if (remaining == null) return
        set({ paused: false, endsAt: Date.now() + remaining, remaining: null })
      },
      stop: () => set({ endsAt: null, paused: false, remaining: null, mode: 'focus' }),
      switchMode: (mode, minutes) =>
        set((s) => ({
          mode,
          endsAt: Date.now() + minutes * 60_000,
          paused: false,
          remaining: null,
          rounds: mode === 'break' ? s.rounds + 1 : s.rounds,
        })),
      setTarget: ({ taskId = null, projectId = null }) => set({ taskId, projectId }),
    }),
    { name: 'orbit:focus' },
  ),
)

export const focusIsActive = (s: FocusState) => s.endsAt !== null || s.paused
