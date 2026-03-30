import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        name: "Ethan's Dashboard",
        short_name: 'Dashboard',
        description: 'Personal dashboard with weather, stocks, news, and study tools',
        start_url: '/',
        display: 'standalone',
        background_color: '#020617',
        theme_color: '#020617',
        orientation: 'any',
        icons: [
          { src: '/icons/icon-192.png',          sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png',          sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            // Open-Meteo: weather + air quality + sunset
            urlPattern: /^https:\/\/(api|air-quality-api)\.open-meteo\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo',
              expiration: { maxAgeSeconds: 15 * 60 },
            },
          },
          {
            // rss2json: news feeds
            urlPattern: /^https:\/\/api\.rss2json\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'rss2json',
              expiration: { maxAgeSeconds: 30 * 60 },
            },
          },
          {
            // Yahoo Finance via CORS proxies
            urlPattern: /^https:\/\/(corsproxy\.io|api\.allorigins\.win)\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'yahoo-finance',
              expiration: { maxAgeSeconds: 5 * 60 },
            },
          },
          {
            // Google Fonts stylesheets + files
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
})
