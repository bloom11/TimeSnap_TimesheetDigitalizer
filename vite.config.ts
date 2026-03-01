import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/TimeSnap_TimesheetDigitalizer/', 
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
          // Ho aggiunto la favicon e l'apple-touch-icon corretta dai tuoi nuovi asset
          includeAssets: ['favicon.png', 'icons/icon-180x180.png'],
          manifest: {
            name: 'TimeSnap - Timesheet Digitizer -2',
            short_name: 'TimeSnap',
            description: 'An AI-powered Progressive Web App (PWA) that digitizes physical timesheets. It uses advanced Vision AI to extract work hours and sync with Excel files.',
            theme_color: '#3b82f6', // Usiamo il blu del tuo logo
            background_color: '#ffffff',
            display: 'standalone',
            start_url: './', // Cruciale per GitHub Pages
            icons: [
              {
                src: 'icons/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'icons/icon-384x384.png',
                sizes: '384x384',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'icons/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'icons/icon-192x192-maskable.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable'
              },
              {
                src: 'icons/icon-512x512-maskable.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
              }
            ]
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, 
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