import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, type Db } from '../db/client.js'
import { users } from '../db/schema.js'
import { hashPassword } from './password.js'
import { buildApp } from '../index.js'
import { _resetRateLimit } from './rateLimit.js'

async function setup(): Promise<{ db: Db; app: ReturnType<typeof buildApp>['app'] }> {
  const db = createDb(':memory:')
  await db.applyMigrations()
  await db.db.insert(users).values({
    id: 'u1',
    email: 'a@b.c',
    passwordHash: await hashPassword('hunter2'),
    createdAt: new Date().toISOString(),
  })
  return { db, app: buildApp({ db, cookieSecure: false }).app }
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
    expect(await res.json()).toEqual({ id: 'u1', email: 'a@b.c' })
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
