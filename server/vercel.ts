import { createDb } from './db/client'
import { buildApp } from './index'
import { getDatabaseAuthToken, getDatabaseUrl } from './env'

const url = getDatabaseUrl()
if (!url) {
  throw new Error('No database URL set — expected DATABASE_URL or TURSO_DATABASE_URL')
}

const db = createDb(url, getDatabaseAuthToken())

// Migrations are run via the build step (`pnpm db:migrate`) before deploy.
// We do NOT run migrations per-request — that would slow cold starts.

const { app } = buildApp({ db, cookieSecure: true })

export default app
