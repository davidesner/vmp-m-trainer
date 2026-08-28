import { Hono } from 'hono'
import { and, eq, desc } from 'drizzle-orm'
import type { AppEnv } from '../types.js'
import type { Db } from '../db/client.js'
import { attempts, testHistory } from '../db/schema.js'
import { requireAuth } from '../auth/middleware.js'

const TEST_IDS = ['M', 'C', 'S'] as const
type TestId = typeof TEST_IDS[number]

function parseTestId(v: string | undefined): TestId | null {
  if (!v) return null
  return TEST_IDS.includes(v as TestId) ? (v as TestId) : null
}

export interface ProgressRoutesOptions { db: Db }

export function progressRoutes(opts: ProgressRoutesOptions) {
  const r = new Hono<AppEnv>()
  r.use('*', requireAuth())

  r.get('/', async c => {
    const user = c.get('user')!
    const testIdParam = c.req.query('testId')
    const testId = parseTestId(testIdParam)
    if (testIdParam && !testId) return c.json({ error: 'bad testId' }, 400)

    const attemptsWhere = testId
      ? and(eq(attempts.userId, user.id), eq(attempts.testId, testId))
      : eq(attempts.userId, user.id)
    const historyWhere = testId
      ? and(eq(testHistory.userId, user.id), eq(testHistory.testId, testId))
      : eq(testHistory.userId, user.id)

    const a = await opts.db.db
      .select()
      .from(attempts)
      .where(attemptsWhere)
      .orderBy(attempts.at)
    const h = await opts.db.db
      .select()
      .from(testHistory)
      .where(historyWhere)
      .orderBy(desc(testHistory.at))
      .limit(50)

    return c.json({
      attempts: a.map(x => ({
        id: x.id,
        testId: x.testId,
        questionId: x.questionId,
        correct: x.correct,
        mode: x.mode,
        at: x.at,
      })),
      testHistory: h.map(x => ({
        id: x.id,
        testId: x.testId,
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
    const testIdParam = c.req.query('testId')
    const testId = parseTestId(testIdParam)
    if (testIdParam && !testId) return c.json({ error: 'bad testId' }, 400)

    if (testId) {
      await opts.db.db.delete(attempts).where(and(eq(attempts.userId, user.id), eq(attempts.testId, testId)))
      await opts.db.db.delete(testHistory).where(and(eq(testHistory.userId, user.id), eq(testHistory.testId, testId)))
    } else {
      await opts.db.db.delete(attempts).where(eq(attempts.userId, user.id))
      await opts.db.db.delete(testHistory).where(eq(testHistory.userId, user.id))
    }
    return c.body(null, 204)
  })

  r.post('/import', async c => {
    const body = await c.req.json().catch(() => null) as {
      testId?: unknown
      questions?: Record<string, { attempts: { at: string; correct: boolean; mode: string }[] }>
      testHistory?: { at: string; score: number; total: number; durationSec: number; perGroup: object; questionIds: number[] }[]
    } | null
    if (!body) return c.json({ error: 'bad request' }, 400)
    const testId = typeof body.testId === 'string' && TEST_IDS.includes(body.testId as TestId)
      ? (body.testId as TestId) : 'M'

    const user = c.get('user')!
    const attemptRows: typeof attempts.$inferInsert[] = []
    for (const [qid, rec] of Object.entries(body.questions ?? {})) {
      const questionId = Number(qid)
      if (!Number.isFinite(questionId)) continue
      for (const a of rec.attempts ?? []) {
        if (a.mode !== 'test' && a.mode !== 'practice') continue
        attemptRows.push({
          userId: user.id,
          testId,
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
        testId,
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
