import { Hono } from 'hono'
import type { AppEnv } from '../types.js'
import type { Db } from '../db/client.js'
import { attempts } from '../db/schema.js'
import { requireAuth } from '../auth/middleware.js'

const MODES = ['test', 'practice'] as const
const TEST_IDS = ['M', 'C', 'S'] as const

export function attemptsRoutes(opts: { db: Db }) {
  const r = new Hono<AppEnv>()
  r.use('*', requireAuth())

  r.post('/', async c => {
    const body = await c.req.json().catch(() => null) as {
      testId?: unknown; questionId?: unknown; correct?: unknown; mode?: unknown
    } | null
    if (!body) return c.json({ error: 'bad request' }, 400)
    if (typeof body.testId !== 'string' || !TEST_IDS.includes(body.testId as typeof TEST_IDS[number])) {
      return c.json({ error: 'bad testId' }, 400)
    }
    if (typeof body.questionId !== 'number' || !Number.isFinite(body.questionId)) {
      return c.json({ error: 'bad questionId' }, 400)
    }
    if (typeof body.correct !== 'boolean') return c.json({ error: 'bad correct' }, 400)
    if (typeof body.mode !== 'string' || !MODES.includes(body.mode as typeof MODES[number])) {
      return c.json({ error: 'bad mode' }, 400)
    }

    const user = c.get('user')!
    await opts.db.db.insert(attempts).values({
      userId: user.id,
      testId: body.testId as typeof TEST_IDS[number],
      questionId: body.questionId,
      correct: body.correct,
      mode: body.mode as typeof MODES[number],
      at: new Date().toISOString(),
    })
    return c.body(null, 201)
  })

  return r
}
