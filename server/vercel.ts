import { createDb } from './db/client.js'
import { buildApp } from './index.js'
import { getAppUrl, getDatabaseAuthToken, getDatabaseUrl, getOAuthCredentials, getSignupCode } from './env.js'

const url = getDatabaseUrl()
if (!url) {
  throw new Error('No database URL set — expected DATABASE_URL or TURSO_DATABASE_URL')
}

const db = createDb(url, getDatabaseAuthToken())

// Migrations are run via the build step (`pnpm db:migrate`) before deploy.
// We do NOT run migrations per-request — that would slow cold starts.

const { app } = buildApp({
  db, cookieSecure: true, signupCode: getSignupCode(), oauth: getOAuthCredentials(), appUrl: getAppUrl(),
})

export default app
