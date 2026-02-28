import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/TimeSnap_TimesheetDigitalizer/', // Set to repository name for GitHub Pages
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        VitePWA({
          registerType: 'prompt',
          injectRegister: 'auto',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
          manifest: {
            name: 'TimeSnap - Timesheet Digitizer',
            short_name: 'TimeSnap',
            description: 'Scan physical timesheets, extract hours using AI, and sync with Excel files automatically.',
            theme_color: '#ffffff',
            background_color: '#ffffff',
            display: 'standalone',
            icons: [
              {
                src: 'pwa-192x192.svg',
                sizes: '192x192',
                type: 'image/svg+xml'
              },
              {
                src: 'pwa-512x512.svg',
                sizes: '512x512',
                type: 'image/svg+xml'
              }
            ]
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // 15MB for larger assets
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                  cacheableResponse: { statuses: [0, 200] }
                }
              },
              {
                urlPattern: /^https:\/\/unpkg\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'unpkg-cache',
                  expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
                  cacheableResponse: { statuses: [0, 200] }
                }
              },
              {
                urlPattern: /^https:\/\/tesseract\.projectnaptha\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'tesseract-models',
                  expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
                  cacheableResponse: { statuses: [0, 200] }
                }
              },
              {
                urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'jsdelivr-cache',
                  expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
                  cacheableResponse: { statuses: [0, 200] }
                }
              }
            ]
          }
        })
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
