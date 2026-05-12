import { Hono } from 'hono'
import { logger } from 'hono/logger'
import type { AppEnv } from './types'
import type { Db } from './db/client'
import { loadUser } from './auth/middleware'
import { authRoutes, meRoute } from './auth/routes'

export interface BuildAppOptions {
  db: Db
  cookieSecure: boolean
}

export function buildApp(opts: BuildAppOptions) {
  const app = new Hono<AppEnv>()
  app.use('*', logger())
  app.use('/api/*', loadUser(opts.db))

  app.get('/api/health', c => c.json({ ok: true }))

  app.route('/api/auth', authRoutes(opts))
  app.route('/api/me', meRoute())
  // Progress routes mounted in Task 10

  // For self-host: serve the built SPA. Skipped in dev (Vite serves it).
  // For Vercel: skipped (rewrites handle it).
  return { app, opts }
}
