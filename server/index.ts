import { Hono } from 'hono'
import { logger } from 'hono/logger'
import type { AppEnv } from './types.js'
import type { Db } from './db/client.js'
import { loadUser } from './auth/middleware.js'
import { authRoutes, meRoute } from './auth/routes.js'
import { progressRoutes } from './routes/progress.js'
import { attemptsRoutes } from './routes/attempts.js'
import { testHistoryRoutes } from './routes/testHistory.js'
import { feedbackRoutes } from './routes/feedback.js'

export interface BuildAppOptions {
  db: Db
  cookieSecure: boolean
  /** Shared invite code required for self-registration. Unset disables signup. */
  signupCode?: string
}

export function buildApp(opts: BuildAppOptions) {
  const app = new Hono<AppEnv>()
  app.use('*', logger())
  app.use('/api/*', loadUser(opts.db))

  app.get('/api/health', c => c.json({ ok: true }))

  app.route('/api/auth', authRoutes(opts))
  app.route('/api/me', meRoute())
  app.route('/api/progress', progressRoutes(opts))
  app.route('/api/attempts', attemptsRoutes(opts))
  app.route('/api/test-history', testHistoryRoutes(opts))
  app.route('/api/feedback', feedbackRoutes())

  // For self-host: serve the built SPA. Skipped in dev (Vite serves it).
  // For Vercel: skipped (rewrites handle it).
  return { app, opts }
}
