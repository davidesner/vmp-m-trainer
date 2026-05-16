import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import { createDb } from '../db/client.js'
import { users } from '../db/schema.js'
import { hashPassword } from '../auth/password.js'
import { buildApp } from '../index.js'
import { feedbackRoutes } from './feedback.js'
import { loadUser } from '../auth/middleware.js'
import { _resetRateLimit } from '../auth/rateLimit.js'
import type { AppEnv } from '../types.js'

async function setup() {
  _resetRateLimit()
  const db = createDb(':memory:')
  await db.applyMigrations()
  await db.db.insert(users).values({
    id: 'u1', email: 'a@b.c',
    passwordHash: await hashPassword('hunter2'),
    createdAt: new Date().toISOString(),
  })
  const app = buildApp({ db, cookieSecure: false }).app
  const login = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'hunter2' }),
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  return { db, cookie }
}

function buildWithFakeIssue(db: Awaited<ReturnType<typeof setup>>['db'], createIssue: NonNullable<Parameters<typeof feedbackRoutes>[0]>['createIssue']) {
  const app = new Hono<AppEnv>()
  app.use('/api/*', loadUser(db))
  app.route('/api/feedback', feedbackRoutes({ createIssue }))
  return app
}

describe('POST /api/feedback', () => {
  beforeEach(() => { _resetRateLimit() })

  it('401 without cookie', async () => {
    const ctx = await setup()
    const app = buildWithFakeIssue(ctx.db, async () => ({ ok: true, url: 'x' }))
    const res = await app.request('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ qid: 1, message: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  it('400 on bad qid', async () => {
    const ctx = await setup()
    const app = buildWithFakeIssue(ctx.db, async () => ({ ok: true, url: 'x' }))
    const res = await app.request('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify({ qid: 'nope', message: 'wrong' }),
    })
    expect(res.status).toBe(400)
  })

  it('400 on empty message', async () => {
    const ctx = await setup()
    const app = buildWithFakeIssue(ctx.db, async () => ({ ok: true, url: 'x' }))
    const res = await app.request('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify({ qid: 1, message: '   ' }),
    })
    expect(res.status).toBe(400)
  })

  it('creates issue and returns url', async () => {
    const ctx = await setup()
    const createIssue = vi.fn(async (_input: { title: string; body: string }) => ({
      ok: true as const,
      url: 'https://github.com/x/y/issues/1',
    }))
    const app = buildWithFakeIssue(ctx.db, createIssue)
    const res = await app.request('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify({ qid: 42, message: 'tohle je špatně' }),
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ url: 'https://github.com/x/y/issues/1' })
    expect(createIssue).toHaveBeenCalledOnce()
    const call = createIssue.mock.calls[0][0]
    expect(call.title).toContain('#42')
    expect(call.body).toContain('tohle je špatně')
    expect(call.body).toContain('#42')
    expect(call.body).not.toContain('a@b.c')
  })

  it('502 when GitHub call fails', async () => {
    const ctx = await setup()
    const app = buildWithFakeIssue(ctx.db, async () => ({ ok: false, status: 500, error: 'boom' }))
    const res = await app.request('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify({ qid: 1, message: 'wrong' }),
    })
    expect(res.status).toBe(502)
  })

  it('429 after rate limit exceeded', async () => {
    const ctx = await setup()
    const app = buildWithFakeIssue(ctx.db, async () => ({ ok: true, url: 'x' }))
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: ctx.cookie },
        body: JSON.stringify({ qid: 1, message: 'wrong' }),
      })
      expect(res.status).toBe(201)
    }
    const res = await app.request('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify({ qid: 1, message: 'wrong' }),
    })
    expect(res.status).toBe(429)
  })
})
