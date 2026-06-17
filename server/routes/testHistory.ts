import { Hono } from 'hono'
import type { AppEnv } from '../types.js'
import type { Db } from '../db/client.js'
import { testHistory } from '../db/schema.js'
import { requireAuth } from '../auth/middleware.js'

const TEST_IDS = ['M', 'C'] as const

export function testHistoryRoutes(opts: { db: Db }) {
  const r = new Hono<AppEnv>()
  r.use('*', requireAuth())

  r.post('/', async c => {
    const body = await c.req.json().catch(() => null) as {
      testId?: unknown; score?: unknown; total?: unknown; durationSec?: unknown;
      perGroup?: unknown; questionIds?: unknown;
    } | null
    if (!body) return c.json({ error: 'bad request' }, 400)
    if (typeof body.testId !== 'string' || !TEST_IDS.includes(body.testId as typeof TEST_IDS[number])) {
      return c.json({ error: 'bad testId' }, 400)
    }
    if (typeof body.score !== 'number' || typeof body.total !== 'number' ||
        typeof body.durationSec !== 'number') return c.json({ error: 'bad numbers' }, 400)
    if (typeof body.perGroup !== 'object' || body.perGroup === null) {
      return c.json({ error: 'bad perGroup' }, 400)
    }
    if (!Array.isArray(body.questionIds)) return c.json({ error: 'bad questionIds' }, 400)

    const user = c.get('user')!
    await opts.db.db.insert(testHistory).values({
      userId: user.id,
      testId: body.testId as typeof TEST_IDS[number],
      at: new Date().toISOString(),
      score: body.score,
      total: body.total,
      durationSec: body.durationSec,
      perGroup: JSON.stringify(body.perGroup),
      questionIds: JSON.stringify(body.questionIds),
    })
    return c.body(null, 201)
  })

  return r
}
