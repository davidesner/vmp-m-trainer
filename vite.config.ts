/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

const explanationsRoot = path.resolve(__dirname, 'explanations')

function serveExplanations() {
  return {
    name: 'serve-explanations',
    configureServer(server: any) {
      server.middlewares.use('/explanations', (req: any, res: any, next: any) => {
        const url = (req.url || '').split('?')[0]
        const filePath = path.join(explanationsRoot, url)
        if (!filePath.startsWith(explanationsRoot)) { res.statusCode = 403; return res.end() }
        if (!existsSync(filePath)) { res.statusCode = 404; return res.end() }
        const ext = path.extname(filePath).toLowerCase()
        const ct = ext === '.html' ? 'text/html; charset=utf-8'
                 : ext === '.json' ? 'application/json'
                 : 'application/octet-stream'
        res.setHeader('Content-Type', ct)
        res.end(readFileSync(filePath))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), serveExplanations()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5400,
    strictPort: true,
  },
  preview: {
    port: 5400,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    passWithNoTests: true,
  },
})
