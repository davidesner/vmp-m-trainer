import { config } from 'dotenv'
config({ path: '.env.local' })
config()
import { randomUUID } from 'node:crypto'
import readline from 'node:readline'
import { Writable } from 'node:stream'
import { eq } from 'drizzle-orm'
import { createDb } from '../db/client'
import { users } from '../db/schema'
import { hashPassword } from '../auth/password'

const email = process.argv[2]?.toLowerCase()
if (!email || !email.includes('@')) {
  console.error('Usage: pnpm user:add <email>')
  process.exit(1)
}

// Prompt for password without echoing it
function promptPassword(label: string): Promise<string> {
  return new Promise(resolve => {
    const mutedStdout = new Writable({
      write(_chunk, _enc, cb) { cb() },  // swallow keystrokes
    })
    const rl = readline.createInterface({ input: process.stdin, output: mutedStdout, terminal: true })
    process.stdout.write(label)
    rl.question('', answer => {
      process.stdout.write('\n')
      rl.close()
      resolve(answer)
    })
  })
}

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL not set'); process.exit(1) }

const db = createDb(url, process.env.DATABASE_AUTH_TOKEN)
await db.applyMigrations()

const existing = await db.db.select().from(users).where(eq(users.email, email)).limit(1)
if (existing[0]) {
  console.error(`User ${email} already exists.`)
  process.exit(1)
}

const password = await promptPassword('Password: ')
if (password.length < 8) { console.error('Password must be >= 8 chars'); process.exit(1) }
const confirm = await promptPassword('Confirm:  ')
if (password !== confirm) { console.error('Passwords do not match'); process.exit(1) }

await db.db.insert(users).values({
  id: randomUUID(),
  email,
  passwordHash: await hashPassword(password),
  createdAt: new Date().toISOString(),
})

console.log(`Created user ${email}.`)
process.exit(0)
