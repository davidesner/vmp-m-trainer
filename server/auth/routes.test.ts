import { eq } from 'drizzle-orm'
import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, type Db } from '../db/client.js'
import { users } from '../db/schema.js'
import { hashPassword } from './password.js'
import { buildApp } from '../index.js'
import { _resetRateLimit } from './rateLimit.js'
import type { Captcha } from './captcha.js'

/** Captcha stub: token 'good' passes, 'down' simulates an outage, anything else fails. */
function fakeCaptcha(): Captcha & { calls: { token: string; ip?: string }[] } {
  const calls: { token: string; ip?: string }[] = []
  return {
    siteKey: 'site-key',
    calls,
    async verify(token, ip) {
      calls.push({ token, ip })
      return token === 'good' ? 'ok' : token === 'down' ? 'unavailable' : 'failed'
    },
  }
}

async function setup(captcha?: Captcha): Promise<{ db: Db; app: ReturnType<typeof buildApp>['app'] }> {
  const db = createDb(':memory:')
  await db.applyMigrations()
  await db.db.insert(users).values({
    id: 'u1',
    email: 'a@b.c',
    passwordHash: await hashPassword('hunter2'),
    createdAt: new Date().toISOString(),
  })
  return { db, app: buildApp({ db, cookieSecure: false, captcha }).app }
}

function register(app: ReturnType<typeof buildApp>['app'], body: unknown, ip = '9.9.9.9') {
  return app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
}

describe('auth routes', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { ctx = await setup() })

  it('POST /api/auth/login sets a cookie on success', async () => {
    const res = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c', password: 'hunter2' }),
    })
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie')
    expect(cookie).toMatch(/^sid=[a-f0-9]{64}/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('POST /api/auth/login rejects bad password', async () => {
    const res = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c', password: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/auth/login rejects unknown email with the same 401', async () => {
    const res = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nope@b.c', password: 'hunter2' }),
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/me returns 401 without cookie', async () => {
    const res = await ctx.app.request('/api/me')
    expect(res.status).toBe(401)
  })

  it('GET /api/me returns user when cookie is valid (round trip)', async () => {
    const login = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c', password: 'hunter2' }),
    })
    const cookie = login.headers.get('set-cookie')!.split(';')[0]  // "sid=..."
    const res = await ctx.app.request('/api/me', { headers: { cookie } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'u1', email: 'a@b.c', guest: false, hasPassword: true })
  })

  it('POST /api/auth/logout clears cookie and invalidates session', async () => {
    const login = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c', password: 'hunter2' }),
    })
    const cookie = login.headers.get('set-cookie')!.split(';')[0]
    const out = await ctx.app.request('/api/auth/logout', { method: 'POST', headers: { cookie } })
    expect(out.status).toBe(204)
    expect(out.headers.get('set-cookie')).toMatch(/sid=;.*Max-Age=0/i)
    const me = await ctx.app.request('/api/me', { headers: { cookie } })
    expect(me.status).toBe(401)
  })
})

describe('registration', () => {
  beforeEach(() => _resetRateLimit())

  it('GET /api/auth/config reports signup disabled when no captcha is configured', async () => {
    const { app } = await setup()
    const res = await app.request('/api/auth/config')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ signupEnabled: false, captchaSiteKey: null })
  })

  it('GET /api/auth/config reports signup enabled with the captcha site key', async () => {
    const { app } = await setup(fakeCaptcha())
    expect(await (await app.request('/api/auth/config')).json())
      .toMatchObject({ signupEnabled: true, captchaSiteKey: 'site-key' })
  })

  it('rejects registration when signup is disabled', async () => {
    const { app } = await setup()
    const res = await register(app, { email: 'new@b.c', password: 'password1', captchaToken: 'good' })
    expect(res.status).toBe(403)
  })

  it('creates a user, logs them in, and the session round-trips', async () => {
    const captcha = fakeCaptcha()
    const { app } = await setup(captcha)
    const res = await register(app, { email: 'New@B.c', password: 'password1', captchaToken: 'good' })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ email: 'new@b.c' })  // normalized to lowercase
    expect(captcha.calls).toEqual([{ token: 'good', ip: '9.9.9.9' }])
    const cookie = res.headers.get('set-cookie')!.split(';')[0]
    const me = await app.request('/api/me', { headers: { cookie } })
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/i)
    expect(await me.json()).toMatchObject({ email: 'new@b.c' })
  })

  it('rejects a missing captcha token with 400 without calling the verifier', async () => {
    const captcha = fakeCaptcha()
    const { app } = await setup(captcha)
    const res = await register(app, { email: 'new@b.c', password: 'password1' })
    expect(res.status).toBe(400)
    expect(captcha.calls).toEqual([])
  })

  it('rejects a failed captcha with 403 and creates no user', async () => {
    const { app, db } = await setup(fakeCaptcha())
    const res = await register(app, { email: 'new@b.c', password: 'password1', captchaToken: 'bad' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'captcha failed' })
    expect(await db.db.select().from(users).where(eq(users.email, 'new@b.c'))).toEqual([])
  })

  it('returns 503 when the captcha service is unreachable', async () => {
    const { app } = await setup(fakeCaptcha())
    const res = await register(app, { email: 'new@b.c', password: 'password1', captchaToken: 'down' })
    expect(res.status).toBe(503)
  })

  it('rejects a short password with 400 without calling the verifier', async () => {
    const captcha = fakeCaptcha()
    const { app } = await setup(captcha)
    const res = await register(app, { email: 'new@b.c', password: 'short', captchaToken: 'good' })
    expect(res.status).toBe(400)
    expect(captcha.calls).toEqual([])
  })

  it('rejects an address without @ so it cannot collide with guest placeholders', async () => {
    const { app } = await setup(fakeCaptcha())
    const res = await register(app, { email: 'guest:g1', password: 'password1', captchaToken: 'good' })
    expect(res.status).toBe(400)
  })

  it('rejects a duplicate email with 409', async () => {
    const { app } = await setup(fakeCaptcha())
    const res = await register(app, { email: 'a@b.c', password: 'password1', captchaToken: 'good' })
    expect(res.status).toBe(409)
  })

  it('does not reveal a duplicate email without a valid captcha', async () => {
    const { app } = await setup(fakeCaptcha())
    const res = await register(app, { email: 'a@b.c', password: 'password1', captchaToken: 'bad' })
    expect(res.status).toBe(403)
  })

  it('rate limits repeated registration attempts', async () => {
    const { app } = await setup(fakeCaptcha())
    for (let i = 0; i < 5; i++) {
      await register(app, { email: 'new@b.c', password: 'password1', captchaToken: 'bad' }, '5.5.5.5')
    }
    const res = await register(app, { email: 'new@b.c', password: 'password1', captchaToken: 'good' }, '5.5.5.5')
    expect(res.status).toBe(429)
  })
})

describe('rate limit', () => {
  beforeEach(() => _resetRateLimit())
  it('returns 429 after 5 failed attempts', async () => {
    const ctx = await setup()
    for (let i = 0; i < 5; i++) {
      const res = await ctx.app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
        body: JSON.stringify({ email: 'a@b.c', password: 'wrong' }),
      })
      expect(res.status).toBe(401)
    }
    const res = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ email: 'a@b.c', password: 'wrong' }),
    })
    expect(res.status).toBe(429)
  })
})
