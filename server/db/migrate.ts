import { createDb } from './client'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const { applyMigrations } = createDb(url, process.env.DATABASE_AUTH_TOKEN)
await applyMigrations()
console.log('Migrations applied:', url)
