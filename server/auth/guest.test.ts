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
  const app = buildApp({
    db, cookieSecure: false,
    captcha: { siteKey: 'site-key', verify: async () => 'ok' },
  }).app
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
    expect(await res.json()).toEqual({ id: 'g1', email: null, guest: true, hasPassword: false })
  })

  it('/api/me reports guest: false for a registered user', async () => {
    const sid = await createSession(ctx.db.db, 'u1')
    const res = await ctx.app.request('/api/me', { headers: { cookie: `sid=${sid}` } })
    expect(await res.json()).toEqual({ id: 'u1', email: 'a@b.c', guest: false, hasPassword: true })
  })

  it('login cannot authenticate a guest row', async () => {
    const res = await login(ctx.app, { email: 'guest:g1', password: '' })
    expect(res.status).toBe(400) // empty password is already a bad request
    const res2 = await login(ctx.app, { email: 'guest:g1', password: 'anything' })
    expect(res2.status).toBe(401)
    expect(await ctx.db.db.select().from(sessions)).toHaveLength(0)
  })
})
function guest(
  app: Awaited<ReturnType<typeof setup>>['app'],
  opts: { cookie?: string; ip?: string; captchaToken?: string | null } = {},
) {
  const token = opts.captchaToken === undefined ? 'tok' : opts.captchaToken
  return app.request('/api/auth/guest', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': opts.ip ?? '7.7.7.7',
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    body: JSON.stringify(token === null ? {} : { captchaToken: token }),
  })
}

describe('POST /api/auth/guest', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { ctx = await setup() })

  it('creates a guest row and session cookie without registering', async () => {
    const res = await guest(ctx.app)
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string; email: null; guest: true }
    expect(body).toEqual({ id: expect.any(String), email: null, guest: true, hasPassword: false })
    expect(res.headers.get('set-cookie')).toMatch(/^sid=[a-f0-9]{64}/)
    const [row] = await ctx.db.db.select().from(users).where(eq(users.id, body.id))
    expect(row.isGuest).toBe(true)
    expect(row.email).toBe(`guest:${body.id}`)
    expect(row.passwordHash).toBe('')
  })

  it('returns the same guest when called again with its cookie', async () => {
    const first = await guest(ctx.app)
    const cookie = first.headers.get('set-cookie')!.split(';')[0]
    const { id } = await first.json() as { id: string }
    const second = await guest(ctx.app, { cookie })
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ id, email: null, guest: true, hasPassword: false })
    expect(await ctx.db.db.select().from(users).where(eq(users.isGuest, true))).toHaveLength(2) // g1 + this one
  })

  it('returns the registered user unchanged when a registered session exists', async () => {
    const sid = await createSession(ctx.db.db, 'u1')
    const res = await guest(ctx.app, { cookie: `sid=${sid}` })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'u1', email: 'a@b.c', guest: false, hasPassword: true })
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('allows 20 guests per IP per window, then 429', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await guest(ctx.app, { ip: '5.5.5.5' })).status).toBe(201)
    }
    const res = await guest(ctx.app, { ip: '5.5.5.5' })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toMatch(/^\d+$/)
    expect((await guest(ctx.app, { ip: '6.6.6.6' })).status).toBe(201)
  })

  it('login while holding a guest session deletes that session but keeps the guest row', async () => {
    const g = await guest(ctx.app)
    const cookie = g.headers.get('set-cookie')!.split(';')[0]
    const { id: guestId } = await g.json() as { id: string }
    const res = await login(ctx.app, { email: 'a@b.c', password: 'hunter2' }, cookie)
    expect(res.status).toBe(200)
    expect(await ctx.db.db.select().from(sessions).where(eq(sessions.userId, guestId))).toHaveLength(0)
    expect(await ctx.db.db.select().from(users).where(eq(users.id, guestId))).toHaveLength(1)
  })

  it('register while holding a guest session deletes that session', async () => {
    const g = await guest(ctx.app)
    const cookie = g.headers.get('set-cookie')!.split(';')[0]
    const { id: guestId } = await g.json() as { id: string }
    const res = await ctx.app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-forwarded-for': '8.8.8.8' },
      body: JSON.stringify({ email: 'new@b.c', password: 'longenough', captchaToken: 'token' }),
    })
    expect(res.status).toBe(201)
    expect(await ctx.db.db.select().from(sessions).where(eq(sessions.userId, guestId))).toHaveLength(0)
  })
})

describe('POST /api/auth/guest captcha', () => {
  beforeEach(() => _resetRateLimit())

  async function appWith(verdict: 'ok' | 'failed' | 'unavailable' | null) {
    const db = createDb(':memory:')
    await db.applyMigrations()
    const captcha = verdict === null ? undefined : { siteKey: 'site-key', verify: async () => verdict }
    return buildApp({ db, cookieSecure: false, captcha }).app
  }

  it('requires a captcha token when captcha is configured', async () => {
    const res = await guest(await appWith('ok'), { captchaToken: null })
    expect(res.status).toBe(400)
  })

  it('rejects a failed captcha', async () => {
    expect((await guest(await appWith('failed'))).status).toBe(403)
  })

  it('reports an unreachable captcha service', async () => {
    expect((await guest(await appWith('unavailable'))).status).toBe(503)
  })

  it('creates a guest without a token when captcha is not configured (local dev)', async () => {
    expect((await guest(await appWith(null), { captchaToken: null })).status).toBe(201)
  })
})
