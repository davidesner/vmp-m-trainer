import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client.js'
import { sessions, users } from '../db/schema.js'

export const SESSION_TTL_MS = 30 * 86400_000  // 30 days
export const SLIDE_WINDOW_MS = 7 * 86400_000  // extend if expiring within 7 days

export async function createSession(
  db: Db['db'],
  userId: string,
  expiresAt: Date = new Date(Date.now() + SESSION_TTL_MS),
): Promise<string> {
  const id = randomBytes(32).toString('hex')
  await db.insert(sessions).values({ id, userId, expiresAt: expiresAt.toISOString() })
  return id
}

export async function lookupSession(db: Db['db'], sid: string) {
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sid))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  if (new Date(row.session.expiresAt).getTime() <= Date.now()) return null
  return row
}

export async function deleteSession(db: Db['db'], sid: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sid))
}

export async function maybeExtendSession(
  db: Db['db'],
  sid: string,
  currentExpiresAt: Date,
): Promise<void> {
  if (currentExpiresAt.getTime() - Date.now() > SLIDE_WINDOW_MS) return
  const next = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  await db.update(sessions).set({ expiresAt: next }).where(eq(sessions.id, sid))
}
