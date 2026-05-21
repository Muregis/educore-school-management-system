import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // Use custom manifest in public folder
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      devOptions: {
        // Avoid stale cached bundles and noisy Workbox logs during local development.
        enabled: command === 'build'
      }
    })
  ],
  build: {
    rollupOptions: {
      // external: ['qrcode']
    }
  }
}))
