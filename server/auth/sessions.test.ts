import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, type Db } from '../db/client.js'
import { users } from '../db/schema.js'
import {
  createSession,
  lookupSession,
  deleteSession,
  maybeExtendSession,
} from './sessions.js'

async function freshDb(): Promise<Db> {
  const handle = createDb(':memory:')
  await handle.applyMigrations()
  await handle.db.insert(users).values({
    id: 'u1',
    email: 'a@b.c',
    passwordHash: 'x',
    createdAt: new Date().toISOString(),
  })
  return handle
}

describe('sessions', () => {
  let h: Db
  beforeEach(async () => { h = await freshDb() })

  it('creates a session and looks it up', async () => {
    const sid = await createSession(h.db, 'u1')
    expect(sid).toMatch(/^[a-f0-9]{64}$/)  // 32 bytes hex
    const found = await lookupSession(h.db, sid)
    expect(found?.user.id).toBe('u1')
    expect(found?.user.email).toBe('a@b.c')
  })

  it('returns null for an unknown sid', async () => {
    expect(await lookupSession(h.db, 'nope')).toBeNull()
  })

  it('returns null for an expired session', async () => {
    const sid = await createSession(h.db, 'u1', new Date(Date.now() - 1000))
    expect(await lookupSession(h.db, sid)).toBeNull()
  })

  it('deletes a session', async () => {
    const sid = await createSession(h.db, 'u1')
    await deleteSession(h.db, sid)
    expect(await lookupSession(h.db, sid)).toBeNull()
  })

  it('extends a session when expiry is within the threshold', async () => {
    // Expires in 3 days — within the 7-day slide window
    const soon = new Date(Date.now() + 3 * 86400_000)
    const sid = await createSession(h.db, 'u1', soon)
    await maybeExtendSession(h.db, sid, soon)
    const found = await lookupSession(h.db, sid)
    const newExp = new Date(found!.session.expiresAt).getTime()
    expect(newExp - Date.now()).toBeGreaterThan(20 * 86400_000) // ~30 days
  })

  it('does not extend a session that is still far from expiry', async () => {
    const far = new Date(Date.now() + 25 * 86400_000)
    const sid = await createSession(h.db, 'u1', far)
    await maybeExtendSession(h.db, sid, far)
    const found = await lookupSession(h.db, sid)
    expect(new Date(found!.session.expiresAt).getTime()).toBe(far.getTime())
  })
})
