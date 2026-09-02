import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'Meridian',
        short_name: 'Meridian',
        description: 'Meridian — a personal app shell, starting with the Aurum finance tracker.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0B0D10',
        theme_color: '#C9A46A',
        icons: [
          {
            src: '/icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
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
