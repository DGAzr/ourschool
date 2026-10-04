/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const pdfjsRoot = dirname(
  createRequire(import.meta.url).resolve('pdfjs-dist/package.json')
)
const pdfjsDirectories = ['wasm', 'cmaps', 'standard_fonts', 'iccs']

// PDF.js needs these decoder/font assets for scanned and international PDFs.
// Keep their documented filenames in both production and development.
const pdfjsAssets = () => ({
  name: 'pdfjs-assets',
  generateBundle(this: {
    emitFile: (asset: {
      type: 'asset'
      fileName: string
      source: Buffer
    }) => void
  }) {
    for (const directory of pdfjsDirectories) {
      for (const file of readdirSync(join(pdfjsRoot, directory))) {
        this.emitFile({
          type: 'asset',
          fileName: `pdfjs/${directory}/${file}`,
          source: readFileSync(join(pdfjsRoot, directory, file)),
        })
      }
    }
  },
  configureServer(server: import('vite').ViteDevServer) {
    server.middlewares.use((request, response, next) => {
      const parts = request.url?.split('?')[0].split('/') ?? []
      if (
        parts.length !== 4 ||
        parts[1] !== 'pdfjs' ||
        !pdfjsDirectories.includes(parts[2]) ||
        parts[3] === '..' ||
        parts[3] === '.'
      ) {
        next()
        return
      }
      const file = join(pdfjsRoot, parts[2], parts[3])
      if (!existsSync(file)) {
        next()
        return
      }
      response.setHeader(
        'Content-Type',
        file.endsWith('.wasm')
          ? 'application/wasm'
          : file.endsWith('.js')
            ? 'text/javascript'
            : 'application/octet-stream'
      )
      response.end(readFileSync(file))
    })
  },
})

export default defineConfig({
  plugins: [react(), pdfjsAssets()],
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
