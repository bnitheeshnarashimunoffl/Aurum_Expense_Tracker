import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Precached because neither is reachable through the manifest's icon list.
      // The badge in particular has to be there OFFLINE: a push can arrive on a
      // phone with no signal, and showNotification() fetches the badge at the
      // moment it draws — an uncached one silently falls back to Chrome's own
      // generic mark in the Android status bar.
      includeAssets: ['icons/apple-touch-icon-180.png', 'icons/badge-96.png'],
      manifest: {
        // A stable identity for the installed app, independent of start_url.
        // Without it Chrome derives the id FROM start_url, so changing that URL
        // later would read as a different app and install a second copy beside
        // the first. Android is the platform that cares; iOS ignores it.
        id: '/',
        name: 'Meridian',
        short_name: 'Meridian',
        description: 'Meridian — six small apps for one day: money, habits, study, timetable, training and notes.',
        start_url: '/',
        // Explicit, rather than inferred from start_url. Every module lives under
        // this origin, and an installed app whose scope is narrower drops out to
        // the browser the moment it navigates outside it.
        scope: '/',
        display: 'standalone',
        background_color: '#0B0D10',
        theme_color: '#C9A46A',
        lang: 'en',
        dir: 'ltr',
        categories: ['productivity', 'lifestyle'],
        // Android needs BOTH purposes. `any` is drawn as-is; `maskable` is cropped
        // to whatever shape the launcher uses — circle, squircle, rounded square —
        // and a non-maskable icon used that way loses its edges. Meridian's mark is
        // a disc occupying the middle ~59% of an opaque field, which sits well
        // inside the 80% safe zone, so the same file is correct for both. Declaring
        // only `maskable` would leave nothing for the contexts that want the plain
        // icon, and only `any` would get the mark cropped on most Android launchers.
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Push handlers, pulled into the generated worker rather than replacing
        // it (see public/push-sw.js for why). importScripts runs before any of
        // Workbox's own setup, so the `push` listener is registered the instant
        // the worker wakes — which for a push event is all the time it gets.
        importScripts: ['/push-sw.js'],
        // ...and kept OUT of the precache manifest. It is loaded as a worker
        // import, not fetched by the page, so precaching it would only pin a
        // stale copy behind the Workbox cache on the next deploy.
        globIgnores: ['**/push-sw.js'],
        // Loom is offline-first, so the app SHELL has to load with no network too —
        // not just its data. These are client-side routes with no file of their own,
        // so every navigation falls back to the precached index.html, which then
        // boots the router and reads Loom's data straight out of IndexedDB.
        navigateFallback: 'index.html',
        // Supabase calls must still go to the network (and fail normally when it is
        // gone) rather than being answered with the HTML shell.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//],
        // Cache-first for viewing already-loaded data offline (nice-to-have, not core to MVP).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1') || url.pathname.startsWith('/storage/v1'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
