import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
)

export interface Db {
  db: ReturnType<typeof drizzle<typeof schema>>
  client: Client
  applyMigrations: () => Promise<void>
}

export function createDb(url: string, authToken?: string): Db {
  const client = createClient({ url, authToken })
  const db = drizzle(client, { schema })
  return {
    db,
    client,
    applyMigrations: () => migrate(db, { migrationsFolder }),
  }
}
