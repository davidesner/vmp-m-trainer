import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import path from 'node:path'
import fs from 'node:fs'
import { createDb } from './db/client.js'
import { buildApp } from './index.js'
import { getDatabaseAuthToken, getDatabaseUrl, getCaptcha } from './env.js'

const url = getDatabaseUrl() ?? 'file:./data/app.db'
const cookieSecure = process.env.SESSION_COOKIE_SECURE === 'true'
const port = Number(process.env.PORT ?? 3001)

const db = createDb(url, getDatabaseAuthToken())
await db.applyMigrations()

const { app } = buildApp({ db, cookieSecure, captcha: getCaptcha() })

// Serve built SPA + static assets from dist/ if it exists (production).
const distDir = path.resolve('dist')
if (fs.existsSync(distDir)) {
  app.use('/*', serveStatic({ root: './dist' }))
  // SPA fallback: an empty shell, since dist/index.html carries the prerendered landing page for "/" only.
  app.get('*', serveStatic({ path: './dist/spa.html' }))
}

serve({ fetch: app.fetch, port }, info => {
  console.log(`API listening on http://localhost:${info.port}`)
})
