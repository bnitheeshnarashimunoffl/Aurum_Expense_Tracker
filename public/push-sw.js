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
      // The large icon, drawn in full colour, so a Meridian notification is
      // recognisable in a stack of others before a word of it is read.
      icon: '/icons/pwa-192.png',
      // The badge is a DIFFERENT image on purpose, and this is Android-only
      // behaviour worth spelling out: the status-bar badge is not drawn in
      // colour. Android takes its alpha channel and stamps it in one system
      // tint. pwa-192.png is deliberately opaque — iOS home-screen icons may not
      // be transparent — so using it here painted a solid filled blob in the
      // status bar with no mark visible at all. badge-96.png is the same
      // sun-over-a-horizon motif drawn as white on nothing, which is what that
      // masking step actually wants. iOS ignores `badge` entirely, so nothing
      // there changes either way.
      badge: '/icons/badge-96.png',
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

/**
 * Confines a notification's destination to this app.
 *
 * The payload is written by Meridian's own dispatcher and only ever contains
 * literals like "/kindle", so this is defence in depth — but the worker will
 * happily openWindow() anything it is handed, and "//somewhere.else" is a
 * protocol-relative URL that a bare startsWith('/') check waves through. One
 * function is cheaper than trusting that the payload can never change.
 */
function safePath(value) {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : '/'
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = safePath(event.notification.data && event.notification.data.url)

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
