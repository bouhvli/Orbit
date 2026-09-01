import { useCallback, useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

/* ----------------------------------------------------------- installability */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const installListeners = new Set<() => void>()
const notifyInstall = () => installListeners.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Chrome fires this instead of showing its own bar; hold it for our button.
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    notifyInstall()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notifyInstall()
  })
}

/** Running from the home screen / app window rather than a browser tab. */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // iOS Safari predates display-mode
    (navigator as { standalone?: boolean }).standalone === true
  )
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports as a Mac, but a Mac has no touch screen
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * Whether we can show an install button. Safari never fires
 * `beforeinstallprompt`, so iOS gets written instructions instead.
 */
export function useInstall() {
  const canPrompt = useSyncExternalStore(
    (fn) => {
      installListeners.add(fn)
      return () => installListeners.delete(fn)
    },
    () => deferredPrompt !== null,
    () => false,
  )

  const install = useCallback(async () => {
    if (!deferredPrompt) return 'unavailable' as const
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    notifyInstall()
    return outcome
  }, [])

  return { canPrompt, install, installed: isStandalone(), ios: isIOS() }
}

/* ------------------------------------------------------------ worker updates */

let applyUpdate: ((reload?: boolean) => Promise<void>) | undefined

/**
 * Registers the worker. Updates are offered rather than applied: a silent
 * reload could discard a debounced edit that has not been flushed yet.
 */
export function initServiceWorker(handlers: {
  onNeedRefresh: () => void
  onOfflineReady?: () => void
}) {
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh: handlers.onNeedRefresh,
    onOfflineReady: handlers.onOfflineReady,
  })
}

/** Activates the waiting worker and reloads. */
export const reloadWithUpdate = () => applyUpdate?.(true)
