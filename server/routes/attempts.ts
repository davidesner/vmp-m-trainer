import { Hono } from 'hono'
import type { AppEnv } from '../types'
import type { Db } from '../db/client'
import { attempts } from '../db/schema'
import { requireAuth } from '../auth/middleware'

const MODES = ['test', 'practice'] as const

export function attemptsRoutes(opts: { db: Db }) {
  const r = new Hono<AppEnv>()
  r.use('*', requireAuth())

  r.post('/', async c => {
    const body = await c.req.json().catch(() => null) as {
      questionId?: unknown; correct?: unknown; mode?: unknown
    } | null
    if (!body) return c.json({ error: 'bad request' }, 400)
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
      questionId: body.questionId,
      correct: body.correct,
      mode: body.mode as typeof MODES[number],
      at: new Date().toISOString(),
    })
    return c.body(null, 201)
  })

  return r
}
