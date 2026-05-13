import { Hono } from 'hono'
import { and, eq, desc } from 'drizzle-orm'
import type { AppEnv } from '../types.js'
import type { Db } from '../db/client.js'
import { attempts, testHistory } from '../db/schema.js'
import { requireAuth } from '../auth/middleware.js'

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

  r.post('/import', async c => {
    const body = await c.req.json().catch(() => null) as {
      questions?: Record<string, { attempts: { at: string; correct: boolean; mode: string }[] }>
      testHistory?: { at: string; score: number; total: number; durationSec: number; perGroup: object; questionIds: number[] }[]
    } | null
    if (!body) return c.json({ error: 'bad request' }, 400)

    const user = c.get('user')!
    const attemptRows: typeof attempts.$inferInsert[] = []
    for (const [qid, rec] of Object.entries(body.questions ?? {})) {
      const questionId = Number(qid)
      if (!Number.isFinite(questionId)) continue
      for (const a of rec.attempts ?? []) {
        if (a.mode !== 'test' && a.mode !== 'practice') continue
        attemptRows.push({
          userId: user.id,
          questionId,
          correct: Boolean(a.correct),
          mode: a.mode,
          at: a.at,
        })
      }
    }
    if (attemptRows.length) {
      await opts.db.db.insert(attempts).values(attemptRows)
    }

    for (const h of body.testHistory ?? []) {
      await opts.db.db.insert(testHistory).values({
        userId: user.id,
        at: h.at,
        score: h.score,
        total: h.total,
        durationSec: h.durationSec,
        perGroup: JSON.stringify(h.perGroup),
        questionIds: JSON.stringify(h.questionIds),
      })
    }
    return c.body(null, 201)
  })

  return r
}
