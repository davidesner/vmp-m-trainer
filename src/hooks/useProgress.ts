import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProgressStore, AnswerMode, TestHistoryEntry } from '../types'

const KEY = 'vmp:progress'
const VERSION_KEY = 'vmp:version'
const VERSION = 1

const empty: ProgressStore = { questions: {}, testHistory: [] }

function load(): ProgressStore {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as ProgressStore
    return { questions: parsed.questions ?? {}, testHistory: parsed.testHistory ?? [] }
  } catch {
    return empty
  }
}

function save(store: ProgressStore) {
  localStorage.setItem(KEY, JSON.stringify(store))
  localStorage.setItem(VERSION_KEY, String(VERSION))
}

export function useProgress() {
  const [store, setStore] = useState<ProgressStore>(() => load())
  // Track whether current state came from a reset so we skip the save effect
  const skipNextSave = useRef(false)

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    save(store)
  }, [store])

  const recordAttempt = useCallback((qid: number, correct: boolean, mode: AnswerMode) => {
    setStore(prev => {
      const cur = prev.questions[qid] ?? { attempts: [], lastSeen: '' }
      const at = new Date().toISOString()
      return {
        ...prev,
        questions: {
          ...prev.questions,
          [qid]: {
            attempts: [...cur.attempts, { at, correct, mode }],
            lastSeen: at,
          },
        },
      }
    })
  }, [])

  const recordTestHistory = useCallback((entry: TestHistoryEntry) => {
    setStore(prev => ({ ...prev, testHistory: [entry, ...prev.testHistory].slice(0, 50) }))
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem(KEY)
    localStorage.removeItem(VERSION_KEY)
    skipNextSave.current = true
    setStore({ questions: {}, testHistory: [] })
  }, [])

  return { store, recordAttempt, recordTestHistory, reset }
}
