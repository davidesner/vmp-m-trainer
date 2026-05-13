import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, type Db } from '../db/client.js'
import { users, attempts, testHistory } from '../db/schema.js'
import { hashPassword } from '../auth/password.js'
import { buildApp } from '../index.js'

async function setup() {
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
  return { db, app, cookie }
}

describe('POST /api/attempts', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { ctx = await setup() })

  it('401 without cookie', async () => {
    const res = await ctx.app.request('/api/attempts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 1, correct: true, mode: 'test' }),
    })
    expect(res.status).toBe(401)
  })

  it('inserts an attempt', async () => {
    const res = await ctx.app.request('/api/attempts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify({ questionId: 7, correct: false, mode: 'practice' }),
    })
    expect(res.status).toBe(201)
    const rows = await ctx.db.db.select().from(attempts)
    expect(rows).toHaveLength(1)
    expect(rows[0].questionId).toBe(7)
    expect(rows[0].correct).toBe(false)
    expect(rows[0].mode).toBe('practice')
    expect(rows[0].userId).toBe('u1')
  })

  it('400 on bad mode', async () => {
    const res = await ctx.app.request('/api/attempts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify({ questionId: 7, correct: false, mode: 'bogus' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/test-history', () => {
  it('inserts a test history entry', async () => {
    const ctx = await setup()
    const res = await ctx.app.request('/api/test-history', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify({
        score: 30, total: 35, durationSec: 1500,
        perGroup: { 'plavebni-provoz': { correct: 14, total: 16 } },
        questionIds: [1, 2, 3],
      }),
    })
    expect(res.status).toBe(201)
    const rows = await ctx.db.db.select().from(testHistory)
    expect(rows).toHaveLength(1)
    expect(rows[0].score).toBe(30)
    expect(JSON.parse(rows[0].questionIds)).toEqual([1, 2, 3])
  })
})
