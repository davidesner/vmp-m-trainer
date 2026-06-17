import { useCallback, useEffect, useState } from 'react'
import type { ProgressStore, AnswerMode, TestHistoryEntry, QuestionProgress, AttemptRecord } from '../types'
import { useActiveTest } from './useActiveTest'
import type { TestId } from '../lib/tests'

const empty: ProgressStore = { questions: {}, testHistory: [] }

interface ServerAttempt {
  id: number
  testId: TestId
  questionId: number
  correct: boolean
  mode: AnswerMode
  at: string
}

interface ServerProgress {
  attempts: ServerAttempt[]
  testHistory: TestHistoryEntry[]
}

function foldAttempts(server: ServerAttempt[]): ProgressStore['questions'] {
  const out: ProgressStore['questions'] = {}
  for (const a of server) {
    const cur: QuestionProgress = out[a.questionId] ?? { attempts: [], lastSeen: '' }
    const rec: AttemptRecord = { at: a.at, correct: a.correct, mode: a.mode }
    cur.attempts.push(rec)
    cur.lastSeen = a.at > cur.lastSeen ? a.at : cur.lastSeen
    out[a.questionId] = cur
  }
  return out
}

async function postWithRetry(url: string, body: unknown, attempts = 3): Promise<void> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (res.ok) return
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
    await new Promise(r => setTimeout(r, 250 * 2 ** i))
  }
  throw lastErr
}

export function useProgress() {
  const { activeTest } = useActiveTest()
  const [store, setStore] = useState<ProgressStore>(empty)

  // Load on mount / when activeTest changes
  useEffect(() => {
    let cancelled = false
    setStore(empty)
    void (async () => {
      try {
        const res = await fetch(`/api/progress?testId=${activeTest}`, { credentials: 'same-origin' })
        if (!res.ok) return
        const body = await res.json() as ServerProgress
        if (cancelled) return
        setStore({
          questions: foldAttempts(body.attempts),
          testHistory: body.testHistory,
        })
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [activeTest])

  const recordAttempt = useCallback(async (qid: number, correct: boolean, mode: AnswerMode) => {
    const at = new Date().toISOString()
    // optimistic update
    setStore(prev => {
      const cur = prev.questions[qid] ?? { attempts: [], lastSeen: '' }
      return {
        ...prev,
        questions: {
          ...prev.questions,
          [qid]: { attempts: [...cur.attempts, { at, correct, mode }], lastSeen: at },
        },
      }
    })
    try {
      await postWithRetry('/api/attempts', { testId: activeTest, questionId: qid, correct, mode })
    } catch {
      // revert on persistent failure
      setStore(prev => {
        const cur = prev.questions[qid]
        if (!cur) return prev
        const trimmed = cur.attempts.slice(0, -1)
        return {
          ...prev,
          questions: { ...prev.questions, [qid]: { ...cur, attempts: trimmed } },
        }
      })
      console.warn('Failed to save attempt')
    }
  }, [activeTest])

  const recordTestHistory = useCallback(async (entry: TestHistoryEntry) => {
    setStore(prev => ({ ...prev, testHistory: [entry, ...prev.testHistory].slice(0, 50) }))
    try {
      await postWithRetry('/api/test-history', {
        testId: activeTest,
        score: entry.score,
        total: entry.total,
        durationSec: entry.durationSec,
        perGroup: entry.perGroup,
        questionIds: entry.questionIds,
      })
    } catch {
      console.warn('Failed to save test history')
    }
  }, [activeTest])

  const reset = useCallback(async () => {
    setStore(empty)
    try {
      await fetch(`/api/progress?testId=${activeTest}`, { method: 'DELETE', credentials: 'same-origin' })
    } catch {
      console.warn('Failed to reset on server')
    }
  }, [activeTest])

  return { store, recordAttempt, recordTestHistory, reset }
}
