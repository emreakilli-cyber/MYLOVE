import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/** package.json'daki sürüm — arayüzde "sürüm etiketi" olarak gösterilir. */
const uygulamaSurumu: string = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
).version

/**
 * Derlemeyi tanımlayan kısa kimlik. Ana ekrana eklenmiş uygulamada hangi
 * sürümde olduğumuzu gözle görebilmek için arayüzde gösteriliyor.
 */
function derlemeKimligi(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'yerel'
  }
}

// GitHub Pages serves this repo from /MYLOVE/. Local dev and Capacitor builds
// want a relative base instead, so the deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  define: {
    __BUILD_ID__: JSON.stringify(derlemeKimligi()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_VERSION__: JSON.stringify(uygulamaSurumu),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'JurisCalendar',
        short_name: 'JurisCalendar',
        description:
          'Hukuk profesyonelleri için akıllı dijital takvim ve dosya yönetim sistemi',
        lang: 'tr',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F7F6F3',
        theme_color: '#16262E',
        categories: ['productivity', 'business'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Fonts and app shell are precached so the app opens with no network.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // Yeni service worker beklemeden devralsın: ana ekrana eklenmiş
        // uygulamada eski sürümde takılı kalmanın başlıca sebebi budur.
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
})
