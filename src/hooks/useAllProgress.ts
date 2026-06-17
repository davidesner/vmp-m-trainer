// Hook pro Stats stránku: načte VŠECHEN progress (nezfiltrovaný per kategorie)
// + všechny bundle. Vrací mapy {testId -> ProgressStore} + {testId -> Bundle}.

import { useEffect, useState } from 'react'
import type { ProgressStore, QuestionsBundle, AnswerMode, QuestionProgress, AttemptRecord, TestHistoryEntry } from '../types'
import { TESTS, TEST_IDS, type TestId } from '../lib/tests'

interface ServerAttempt {
  id: number
  testId: TestId
  questionId: number
  correct: boolean
  mode: AnswerMode
  at: string
}

interface ServerTestHistoryEntry extends TestHistoryEntry {
  testId: TestId
}

interface ServerProgress {
  attempts: ServerAttempt[]
  testHistory: ServerTestHistoryEntry[]
}

function foldAttempts(rows: ServerAttempt[]): ProgressStore['questions'] {
  const out: ProgressStore['questions'] = {}
  for (const a of rows) {
    const cur: QuestionProgress = out[a.questionId] ?? { attempts: [], lastSeen: '' }
    const rec: AttemptRecord = { at: a.at, correct: a.correct, mode: a.mode }
    cur.attempts.push(rec)
    cur.lastSeen = a.at > cur.lastSeen ? a.at : cur.lastSeen
    out[a.questionId] = cur
  }
  return out
}

export interface AllProgressResult {
  bundles: Partial<Record<TestId, QuestionsBundle>>
  progressByTest: Record<TestId, ProgressStore>
  loading: boolean
  error: Error | null
}

const emptyStore: ProgressStore = { questions: {}, testHistory: [] }

export function useAllProgress(): AllProgressResult {
  const [bundles, setBundles] = useState<Partial<Record<TestId, QuestionsBundle>>>({})
  const [progressByTest, setProgressByTest] = useState<Record<TestId, ProgressStore>>(() => {
    const o = {} as Record<TestId, ProgressStore>
    for (const id of TEST_IDS) o[id] = emptyStore
    return o
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        // Bundles
        const bundleEntries = await Promise.all(TEST_IDS.map(async id => {
          const res = await fetch(TESTS[id].dataUrl)
          if (!res.ok) throw new Error(`HTTP ${res.status} loading ${TESTS[id].dataUrl}`)
          return [id, await res.json() as QuestionsBundle] as const
        }))

        // All progress, no testId filter
        const progRes = await fetch('/api/progress', { credentials: 'same-origin' })
        if (!progRes.ok) throw new Error(`HTTP ${progRes.status} loading progress`)
        const progBody = await progRes.json() as ServerProgress

        const byTest: Record<TestId, ProgressStore> = {} as Record<TestId, ProgressStore>
        for (const id of TEST_IDS) {
          const attempts = progBody.attempts.filter(a => a.testId === id)
          const history = progBody.testHistory.filter(t => t.testId === id)
          byTest[id] = { questions: foldAttempts(attempts), testHistory: history }
        }

        if (cancelled) return
        setBundles(Object.fromEntries(bundleEntries))
        setProgressByTest(byTest)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(e as Error)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return { bundles, progressByTest, loading, error }
}
