import { createDb } from './db/client'
import { buildApp } from './index'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL not set on Vercel')

const db = createDb(url, process.env.DATABASE_AUTH_TOKEN)

// Migrations are run via the build step (`pnpm db:migrate`) before deploy.
// We do NOT run migrations per-request — that would slow cold starts.

const { app } = buildApp({ db, cookieSecure: true })

export default app
