import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb } from '../db/client.js'
import { users, sessions } from '../db/schema.js'
import { hashPassword } from './password.js'
import { createSession } from './sessions.js'
import { buildApp } from '../index.js'
import { _resetRateLimit } from './rateLimit.js'

async function setup() {
  _resetRateLimit()
  const db = createDb(':memory:')
  await db.applyMigrations()
  await db.db.insert(users).values({
    id: 'u1', email: 'a@b.c',
    passwordHash: await hashPassword('hunter2'),
    createdAt: new Date().toISOString(),
  })
  await db.db.insert(users).values({
    id: 'g1', email: 'guest:g1', passwordHash: '', isGuest: true,
    createdAt: new Date().toISOString(),
  })
  const app = buildApp({ db, cookieSecure: false, signupCode: 'CODE' }).app
  return { db, app }
}

function login(app: Awaited<ReturnType<typeof setup>>['app'], body: unknown, cookie?: string) {
  return app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
}

describe('guest auth context', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { ctx = await setup() })

  it('existing users default to is_guest = false', async () => {
    const [u] = await ctx.db.db.select().from(users).where(eq(users.id, 'u1'))
    expect(u.isGuest).toBe(false)
  })

  it('/api/me reports guest: true and hides the placeholder email', async () => {
    const sid = await createSession(ctx.db.db, 'g1')
    const res = await ctx.app.request('/api/me', { headers: { cookie: `sid=${sid}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'g1', email: null, guest: true })
  })

  it('/api/me reports guest: false for a registered user', async () => {
    const sid = await createSession(ctx.db.db, 'u1')
    const res = await ctx.app.request('/api/me', { headers: { cookie: `sid=${sid}` } })
    expect(await res.json()).toEqual({ id: 'u1', email: 'a@b.c', guest: false })
  })

  it('login cannot authenticate a guest row', async () => {
    const res = await login(ctx.app, { email: 'guest:g1', password: '' })
    expect(res.status).toBe(400) // empty password is already a bad request
    const res2 = await login(ctx.app, { email: 'guest:g1', password: 'anything' })
    expect(res2.status).toBe(401)
    expect(await ctx.db.db.select().from(sessions)).toHaveLength(0)
  })
})
