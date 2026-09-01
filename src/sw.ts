/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

/**
 * Orbit's service worker.
 *
 * Orbit is local-first: the data already lives in IndexedDB, so the only thing
 * the worker has to guarantee is that the shell itself is available offline —
 * including the very first launch after install, which is why the whole build
 * is precached rather than cached as you happen to visit pages.
 */

// Every built asset, injected at build time with its revision hash.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Single-page app: any navigation resolves to the precached shell.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  }),
)

/**
 * Updates are offered, never forced. A silent reload could discard a debounced
 * edit that has not been flushed yet, so the page asks first and posts this
 * message when the user agrees.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

/** Bring the existing window forward rather than opening a second one. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})
