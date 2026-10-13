import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb } from '../db/client.js'
import { attempts, testHistory } from '../db/schema.js'
import { buildApp } from '../index.js'
import { _resetRateLimit } from '../auth/rateLimit.js'

async function setup() {
  _resetRateLimit()
  const db = createDb(':memory:')
  await db.applyMigrations()
  const app = buildApp({ db, cookieSecure: false }).app
  const g = await app.request('/api/auth/guest', { method: 'POST' })
  const cookie = g.headers.get('set-cookie')!.split(';')[0]
  const { id } = await g.json() as { id: string }
  return { db, app, cookie, guestId: id }
}

describe('guest permissions', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { ctx = await setup() })

  it.each([
    ['GET', '/api/progress?testId=M'],
    ['DELETE', '/api/progress?testId=M'],
    ['POST', '/api/progress/import'],
  ])('%s %s -> 403', async (method, url) => {
    const res = await ctx.app.request(url, {
      method,
      headers: { cookie: ctx.cookie, 'content-type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ testId: 'M', questions: {}, testHistory: [] }) : undefined,
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'account required' })
  })

  it('still 401 on progress without any session', async () => {
    expect((await ctx.app.request('/api/progress')).status).toBe(401)
  })

  it('records attempts under the guest id', async () => {
    const res = await ctx.app.request('/api/attempts', {
      method: 'POST',
      headers: { cookie: ctx.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ testId: 'M', questionId: 3, correct: true, mode: 'practice' }),
    })
    expect(res.status).toBe(201)
    expect(await ctx.db.db.select().from(attempts).where(eq(attempts.userId, ctx.guestId))).toHaveLength(1)
  })

  it('records test history under the guest id', async () => {
    const res = await ctx.app.request('/api/test-history', {
      method: 'POST',
      headers: { cookie: ctx.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ testId: 'M', score: 30, total: 35, durationSec: 900, perGroup: {}, questionIds: [1, 2] }),
    })
    expect(res.status).toBe(201)
    expect(await ctx.db.db.select().from(testHistory).where(eq(testHistory.userId, ctx.guestId))).toHaveLength(1)
  })

  it('guest DELETE does not remove recorded attempts', async () => {
    await ctx.app.request('/api/attempts', {
      method: 'POST',
      headers: { cookie: ctx.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ testId: 'M', questionId: 3, correct: true, mode: 'practice' }),
    })
    await ctx.app.request('/api/progress', { method: 'DELETE', headers: { cookie: ctx.cookie } })
    expect(await ctx.db.db.select().from(attempts)).toHaveLength(1)
  })
})
