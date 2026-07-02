/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    // Vite 8 added strict host checking; allow all hosts so the dev container
    // remains reachable through Colima's SSH port-forward tunnel.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.PROXY_TARGET || 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
