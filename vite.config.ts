import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Our own worker, so notification clicks and the update handshake stay ours.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // The page decides when to activate an update; see src/lib/pwa.ts.
      registerType: 'prompt',
      injectRegister: null,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2,txt}'],
        // The large app icons are for the installer and the OS, which keep their
        // own copy — precaching them would double the offline payload for
        // nothing. The small favicons stay.
        globIgnores: ['**/icons/icon-*.png', '**/icons/apple-touch-icon.png'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        id: '/',
        name: 'Orbit — work command center',
        short_name: 'Orbit',
        description:
          'One place for the projects, tasks, meetings and notes you are juggling. Works offline.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        background_color: '#f7f4ee',
        theme_color: '#f7f4ee',
        lang: 'en',
        dir: 'ltr',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Capture something',
            short_name: 'Capture',
            url: '/?capture=1',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: "Today's agenda",
            short_name: 'Agenda',
            url: '/meetings',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Focus mode',
            short_name: 'Focus',
            url: '/focus',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      devOptions: {
        // Opt in with `VITE_PWA_DEV=true pnpm dev` when testing install/offline.
        enabled: env.VITE_PWA_DEV === 'true',
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
    ],
    //host: true,
    //so a phone on the same network can load it — a PWA can only be
    // tested properly on the device.
    server: { port: 5173, open: false, host: true },
    preview: { port: 4173, host: true },
  }
})
