import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const basePath = process.env.VDL_BASE_PATH?.replace(/^\/+|\/+$/g, '')
export default defineConfig({
  base: basePath ? `/${basePath}/` : '/',
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png', 'warehouse.webp'],
      manifest: {
        id: './',
        name: 'Juan Fran · Vanderlande Fleet & Site Control',
        short_name: 'JF · VDL Fleet',
        description: 'El centro de operaciones móvil de Juan Fran',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#141619',
        theme_color: '#141619',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,png,webp,gz}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
})
