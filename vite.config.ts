/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,woff2,svg,png,webp,jpg}'],
        // Данные, документы и фото врачей правит админка на сервере — в прекэш сборки не попадают.
        globIgnores: ['data/**', 'docs/**', 'doctors/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Админка живёт под тем же доменом — SW киоска её страницы не подменяет.
        navigateFallbackDenylist: [/^\/admin/],
        cleanupOutdatedCaches: true,
        // Киоск — одна вкладка без перезапусков: новый SW должен вставать сразу.
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/data/') && url.pathname.endsWith('.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'kiosk-data', networkTimeoutSeconds: 3 },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/doctors/') && url.pathname.endsWith('.webp'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'kiosk-photos' },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/docs/') && url.pathname.endsWith('.pdf'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'kiosk-docs' },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    // Сервер админки — в node; веб-админка — в jsdom, как сайт.
    environmentMatchGlobs: [
      ['tests/admin/web/**', 'jsdom'],
      ['tests/admin/**', 'node'],
    ],
    globals: true,
    setupFiles: ['tests/setup.ts'],
  },
});
