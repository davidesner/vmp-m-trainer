import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, type Db } from '../db/client'
import { users, attempts, testHistory } from '../db/schema'
import { hashPassword } from '../auth/password'
import { buildApp } from '../index'

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

describe('GET /api/progress', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { ctx = await setup() })

  it('401 without cookie', async () => {
    const res = await ctx.app.request('/api/progress')
    expect(res.status).toBe(401)
  })

  it('returns empty arrays for a new user', async () => {
    const res = await ctx.app.request('/api/progress', { headers: { cookie: ctx.cookie } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ attempts: [], testHistory: [] })
  })

  it('returns stored attempts and history', async () => {
    await ctx.db.db.insert(attempts).values({
      userId: 'u1', questionId: 42, correct: true, mode: 'test',
      at: '2026-05-12T10:00:00.000Z',
    })
    await ctx.db.db.insert(testHistory).values({
      userId: 'u1', at: '2026-05-12T11:00:00.000Z',
      score: 30, total: 35, durationSec: 1500,
      perGroup: JSON.stringify({}), questionIds: JSON.stringify([1, 2, 3]),
    })
    const res = await ctx.app.request('/api/progress', { headers: { cookie: ctx.cookie } })
    const body = await res.json() as { attempts: unknown[]; testHistory: unknown[] }
    expect(body.attempts).toHaveLength(1)
    expect((body.attempts[0] as { questionId: number }).questionId).toBe(42)
    expect((body.attempts[0] as { correct: boolean }).correct).toBe(true)
    expect(body.testHistory).toHaveLength(1)
    expect((body.testHistory[0] as { score: number }).score).toBe(30)
    expect((body.testHistory[0] as { questionIds: number[] }).questionIds).toEqual([1, 2, 3])
  })
})

describe('DELETE /api/progress', () => {
  it('wipes attempts and history for the user only', async () => {
    const ctx = await setup()
    // Seed another user's data to make sure we don't delete it
    await ctx.db.db.insert(users).values({
      id: 'u2', email: 'x@y.z', passwordHash: 'x',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.db.insert(attempts).values([
      { userId: 'u1', questionId: 1, correct: true,  mode: 'test',     at: 'now' },
      { userId: 'u2', questionId: 1, correct: false, mode: 'practice', at: 'now' },
    ])
    const res = await ctx.app.request('/api/progress', { method: 'DELETE', headers: { cookie: ctx.cookie } })
    expect(res.status).toBe(204)
    const after = await ctx.db.db.select().from(attempts)
    expect(after).toHaveLength(1)
    expect(after[0].userId).toBe('u2')
  })
})

describe('POST /api/progress/import', () => {
  it('imports legacy localStorage shape', async () => {
    const ctx = await setup()
    const payload = {
      questions: {
        '1': { attempts: [{ at: '2025-01-01T00:00:00Z', correct: true,  mode: 'test'     }], lastSeen: '2025-01-01T00:00:00Z' },
        '7': { attempts: [{ at: '2025-01-02T00:00:00Z', correct: false, mode: 'practice' }], lastSeen: '2025-01-02T00:00:00Z' },
      },
      testHistory: [
        { at: '2025-01-03T00:00:00Z', score: 30, total: 35, durationSec: 1500, perGroup: {}, questionIds: [1, 7] },
      ],
    }
    const res = await ctx.app.request('/api/progress/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify(payload),
    })
    expect(res.status).toBe(201)
    const a = await ctx.db.db.select().from(attempts)
    expect(a).toHaveLength(2)
    const h = await ctx.db.db.select().from(testHistory)
    expect(h).toHaveLength(1)
    expect(h[0].score).toBe(30)
  })
})
