import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import { createDb } from './client.js'
import { getDatabaseAuthToken, getDatabaseUrl } from '../env.js'

const url = getDatabaseUrl()
if (!url) {
  console.error('No database URL set — expected DATABASE_URL or TURSO_DATABASE_URL')
  process.exit(1)
}

const { applyMigrations } = createDb(url, getDatabaseAuthToken())
await applyMigrations()
console.log('Migrations applied:', url)
