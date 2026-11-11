import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['owl.svg'],
      manifest: {
        name: 'OWL Phone Simulator',
        short_name: 'OWL',
        description: 'A retro QWERTY phone simulator with a working mini-OS.',
        theme_color: '#0b1120',
        background_color: '#05070d',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Bump this on every release so clients cannot mix old and new assets.
        cacheId: 'owl-v5',
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/en\.wikipedia\.org\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'wikipedia', expiration: { maxEntries: 40, maxAgeSeconds: 86400 } }
          }
        ]
      }
    })
  ],
  // The sandbox preview serves the app from *.e2b.app, so both the dev server
  // and `vite preview` must accept that host and bind to all interfaces.
  // For the reader API in `npm run dev` use `vercel dev` (or deploy); this
  // static dev server has no serverless runtime.
  server: { host: '0.0.0.0', port: 5173, strictPort: false, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: false, allowedHosts: true },
  optimizeDeps: { exclude: ['jsmediatags'] },
  build: {
    target: 'es2019',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Keep the browser-only ID3 reader in a stable, lazy-loaded chunk.
        // Let Rollup group React and shared dependencies automatically: the
        // former manual React/vendor split produced a circular chunk graph.
        chunkFileNames: 'assets/[name]-[hash].js'
      }
    }
  }
});
