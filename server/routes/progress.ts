import { Hono } from 'hono'
import { and, eq, desc } from 'drizzle-orm'
import type { AppEnv } from '../types'
import type { Db } from '../db/client'
import { attempts, testHistory } from '../db/schema'
import { requireAuth } from '../auth/middleware'

export interface ProgressRoutesOptions { db: Db }

export function progressRoutes(opts: ProgressRoutesOptions) {
  const r = new Hono<AppEnv>()
  r.use('*', requireAuth())

  r.get('/', async c => {
    const user = c.get('user')!
    const a = await opts.db.db
      .select()
      .from(attempts)
      .where(eq(attempts.userId, user.id))
      .orderBy(attempts.at)
    const h = await opts.db.db
      .select()
      .from(testHistory)
      .where(eq(testHistory.userId, user.id))
      .orderBy(desc(testHistory.at))
      .limit(50)

    return c.json({
      attempts: a.map(x => ({
        id: x.id,
        questionId: x.questionId,
        correct: x.correct,
        mode: x.mode,
        at: x.at,
      })),
      testHistory: h.map(x => ({
        id: x.id,
        at: x.at,
        score: x.score,
        total: x.total,
        durationSec: x.durationSec,
        perGroup: JSON.parse(x.perGroup),
        questionIds: JSON.parse(x.questionIds),
      })),
    })
  })

  r.delete('/', async c => {
    const user = c.get('user')!
    await opts.db.db.delete(attempts).where(eq(attempts.userId, user.id))
    await opts.db.db.delete(testHistory).where(eq(testHistory.userId, user.id))
    return c.body(null, 204)
  })

  return r
}
