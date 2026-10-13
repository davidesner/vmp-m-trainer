import { describe, it, expect, beforeEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb, type Db } from '../db/client.js'
import { attempts, oauthIdentities, sessions, testHistory, users } from '../db/schema.js'
import { buildApp } from '../index.js'
import { hashPassword } from './password.js'
import { createSession } from './sessions.js'
import { _resetRateLimit } from './rateLimit.js'

type App = ReturnType<typeof buildApp>['app']

const GOOGLE_ACCOUNT = { sub: 'g-777', email: 'sso@gmail.com', email_verified: true }

/** Fake Google endpoints, as in oauth.test.ts. */
function googleFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'at-123', token_type: 'bearer', expires_in: 3600 })
    }
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') return Response.json(GOOGLE_ACCOUNT)
    return new Response('unexpected', { status: 500 })
  }) as unknown as typeof fetch
}

function cookieValue(res: Response, name: string): string | undefined {
  const hit = res.headers.getSetCookie().find(c => c.startsWith(`${name}=`))
  return hit?.split(';')[0].slice(name.length + 1)
}

async function signInWithGoogle(app: App): Promise<string> {
  const start = await app.request('/api/auth/oauth/google')
  const state = new URL(start.headers.get('location')!).searchParams.get('state')!
  const flow = cookieValue(start, 'oauth_flow')!
  const res = await app.request(`/api/auth/oauth/google/callback?code=c&state=${state}`, {
    headers: { cookie: `oauth_flow=${flow}` },
  })
  expect(res.status).toBe(302)
  return cookieValue(res, 'sid')!
}

async function seedUser(db: Db, id: string, passwordHash: string, isGuest = false) {
  const now = new Date().toISOString()
  await db.db.insert(users).values({ id, email: isGuest ? `guest:${id}` : `${id}@example.com`, passwordHash, isGuest, createdAt: now })
  await db.db.insert(attempts).values({ userId: id, testId: 'M', questionId: 1, correct: true, mode: 'practice', at: now })
  await db.db.insert(testHistory).values({
    userId: id, testId: 'M', at: now, score: 20, total: 25, durationSec: 600, perGroup: '{}', questionIds: '[1]',
  })
}

async function setup() {
  const db = createDb(':memory:')
  await db.applyMigrations()
  const { app } = buildApp({
    db, cookieSecure: false, appUrl: 'https://vmp.test', fetch: googleFetch(),
    oauth: { google: { clientId: 'g', clientSecret: 's' } },
  })
  await seedUser(db, 'pw', await hashPassword('hunter22'))
  await seedUser(db, 'other', await hashPassword('other-pass'))
  return { db, app }
}

function del(app: App, sid: string | null, body?: unknown) {
  return app.request('/api/me', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', ...(sid ? { cookie: `sid=${sid}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function rowsFor(db: Db, userId: string) {
  const [u, s, a, t, o] = await Promise.all([
    db.db.select().from(users).where(eq(users.id, userId)),
    db.db.select().from(sessions).where(eq(sessions.userId, userId)),
    db.db.select().from(attempts).where(eq(attempts.userId, userId)),
    db.db.select().from(testHistory).where(eq(testHistory.userId, userId)),
    db.db.select().from(oauthIdentities).where(eq(oauthIdentities.userId, userId)),
  ])
  return { users: u.length, sessions: s.length, attempts: a.length, testHistory: t.length, identities: o.length }
}

const NOTHING = { users: 0, sessions: 0, attempts: 0, testHistory: 0, identities: 0 }

describe('DELETE /api/me', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => {
    _resetRateLimit()
    ctx = await setup()
  })

  it('reports hasPassword in /api/me so the SPA knows which confirmation to ask for', async () => {
    const sid = await createSession(ctx.db.db, 'pw')
    const me = await (await ctx.app.request('/api/me', { headers: { cookie: `sid=${sid}` } })).json()
    expect(me).toEqual({ id: 'pw', email: 'pw@example.com', guest: false, hasPassword: true })
  })

  it('deletes a password account with everything tied to it and clears the cookie', async () => {
    const sid = await createSession(ctx.db.db, 'pw')
    const otherDevice = await createSession(ctx.db.db, 'pw')
    const res = await del(ctx.app, sid, { password: 'hunter22' })
    expect(res.status).toBe(204)
    const cleared = res.headers.getSetCookie().find(c => c.startsWith('sid='))!
    expect(cleared).toMatch(/^sid=;/)
    expect(cleared).toMatch(/Max-Age=0/i)

    expect(await rowsFor(ctx.db, 'pw')).toEqual(NOTHING)
    // Every session is gone, including the other device.
    for (const s of [sid, otherDevice]) {
      expect((await ctx.app.request('/api/me', { headers: { cookie: `sid=${s}` } })).status).toBe(401)
    }
    // Other users are untouched.
    expect(await rowsFor(ctx.db, 'other')).toMatchObject({ users: 1, attempts: 1, testHistory: 1 })
  })

  it('does not rely on SQLite enforcing ON DELETE CASCADE', async () => {
    await ctx.db.client.execute('PRAGMA foreign_keys = OFF')
    const sid = await createSession(ctx.db.db, 'pw')
    await createSession(ctx.db.db, 'pw')
    expect((await del(ctx.app, sid, { password: 'hunter22' })).status).toBe(204)
    expect(await rowsFor(ctx.db, 'pw')).toEqual(NOTHING)
  })

  it('rejects a wrong or missing password and keeps the account', async () => {
    const sid = await createSession(ctx.db.db, 'pw')
    const wrong = await del(ctx.app, sid, { password: 'nope' })
    expect(wrong.status).toBe(403)
    expect(await wrong.json()).toEqual({ error: 'invalid password' })
    expect((await del(ctx.app, sid, {})).status).toBe(403)
    // The confirmation word is not a substitute for a password.
    expect((await del(ctx.app, sid, { confirm: 'SMAZAT' })).status).toBe(403)
    expect(await rowsFor(ctx.db, 'pw')).toMatchObject({ users: 1, sessions: 1, attempts: 1, testHistory: 1 })
  })

  it('rate-limits confirmation attempts per account', async () => {
    const sid = await createSession(ctx.db.db, 'pw')
    for (let i = 0; i < 5; i++) expect((await del(ctx.app, sid, { password: 'nope' })).status).toBe(403)
    const limited = await del(ctx.app, sid, { password: 'hunter22' })
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/)
    expect(await rowsFor(ctx.db, 'pw')).toMatchObject({ users: 1 })
  })

  it('rejects anonymous requests with 401 and guests with 403', async () => {
    expect((await del(ctx.app, null, { confirm: 'SMAZAT' })).status).toBe(401)
    expect((await del(ctx.app, 'not-a-session', { confirm: 'SMAZAT' })).status).toBe(401)

    await seedUser(ctx.db, 'guest1', '', true)
    const sid = await createSession(ctx.db.db, 'guest1')
    expect((await del(ctx.app, sid, { confirm: 'SMAZAT' })).status).toBe(403)
    expect(await rowsFor(ctx.db, 'guest1')).toMatchObject({ users: 1, sessions: 1 })
  })

  describe('SSO-only account', () => {
    it('needs the confirmation word instead of a password', async () => {
      const sid = await signInWithGoogle(ctx.app)
      const me = await (await ctx.app.request('/api/me', { headers: { cookie: `sid=${sid}` } })).json()
      expect(me).toMatchObject({ email: 'sso@gmail.com', hasPassword: false })

      const wrong = await del(ctx.app, sid, { confirm: 'smazat ucet' })
      expect(wrong.status).toBe(403)
      expect(await wrong.json()).toEqual({ error: 'invalid confirmation' })
      // An empty password must never pass for an account without one.
      expect((await del(ctx.app, sid, { password: '' })).status).toBe(403)
      expect(await rowsFor(ctx.db, me.id)).toMatchObject({ users: 1, identities: 1 })

      expect((await del(ctx.app, sid, { confirm: ' smazat ' })).status).toBe(204)
      expect(await rowsFor(ctx.db, me.id)).toEqual(NOTHING)
    })

    it('signing in again with the same Google account creates a fresh, empty account', async () => {
      const sid = await signInWithGoogle(ctx.app)
      const before = await (await ctx.app.request('/api/me', { headers: { cookie: `sid=${sid}` } })).json()
      await ctx.db.db.insert(attempts).values({
        userId: before.id, testId: 'M', questionId: 7, correct: false, mode: 'test', at: new Date().toISOString(),
      })
      expect((await del(ctx.app, sid, { confirm: 'SMAZAT' })).status).toBe(204)

      const again = await signInWithGoogle(ctx.app)
      const after = await (await ctx.app.request('/api/me', { headers: { cookie: `sid=${again}` } })).json()
      expect(after).toMatchObject({ email: 'sso@gmail.com', guest: false, hasPassword: false })
      expect(after.id).not.toBe(before.id)
      expect(await rowsFor(ctx.db, after.id)).toEqual({ users: 1, sessions: 1, attempts: 0, testHistory: 0, identities: 1 })
    })
  })
})
