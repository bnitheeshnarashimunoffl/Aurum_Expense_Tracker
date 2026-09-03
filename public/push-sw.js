/* eslint-disable no-undef */
// Meridian — the push half of the service worker.
//
// This file is imported INTO the Workbox service worker that vite-plugin-pwa
// generates (see `workbox.importScripts` in vite.config.ts) rather than replacing
// it. That matters: the generated worker is what precaches the app shell and
// serves index.html for every client-side route, which is what lets Loom open
// with no network at all. Rewriting the whole worker to add two event listeners
// would have put that at risk for no benefit.
//
// It runs when Meridian is closed — that is the entire point — so it can rely on
// nothing except what arrives in the push payload.

const FALLBACK = {
  title: 'Meridian',
  body: 'Something is waiting for you.',
  url: '/',
  tag: 'meridian',
}

self.addEventListener('push', (event) => {
  let payload = FALLBACK
  try {
    // A push with no data at all is legal, and some services send one to wake a
    // worker. Falling back keeps that from surfacing as a crash in the console.
    payload = event.data ? { ...FALLBACK, ...event.data.json() } : FALLBACK
  } catch (_err) {
    payload = FALLBACK
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      // Both icons are the app's own mark, so a Meridian notification is
      // recognisable in a stack of others before a word of it is read.
      icon: '/icons/pwa-192.png',
      badge: '/icons/pwa-192.png',
      // Tagging by module means a second water reminder REPLACES the first rather
      // than stacking a column of identical nudges someone has to swipe through.
      tag: payload.tag,
      renotify: true,
      // Never steal focus. Every one of these is a nudge, not an alarm.
      requireInteraction: false,
      data: { url: payload.url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      // Prefer an already-open Meridian: opening a second window when one is
      // sitting behind the lock screen is how a PWA ends up with three copies of
      // itself. Focus it and tell the app where to go.
      for (const client of clientList) {
        if (new URL(client.url).origin !== self.location.origin) continue
        await client.focus()
        if ('navigate' in client) {
          try {
            await client.navigate(target)
            return
          } catch (_err) {
            // Some browsers (notably iOS) reject navigate() on a focused client.
            // The message below is the fallback the app listens for.
          }
        }
        client.postMessage({ type: 'meridian:navigate', url: target })
        return
      }

      await self.clients.openWindow(target)
    })()
  )
})
