/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PORT ?? '3001'
  const devPort = Number(env.VITE_DEV_PORT ?? 5400)

  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: {
      port: devPort,
      strictPort: true,
      proxy: {
        // Keep the browser's Host so the API builds OAuth redirect URIs on the Vite port, not its own.
        '/api': { target: `http://localhost:${apiPort}`, changeOrigin: false },
      },
    },
    preview: {
      port: devPort,
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
      passWithNoTests: true,
    },
  }
})
