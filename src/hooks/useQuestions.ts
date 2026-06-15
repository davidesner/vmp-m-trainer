import { useEffect, useState } from 'react'
import type { QuestionsBundle } from '../types'
import { TESTS } from '../lib/tests'
import { useActiveTest } from './useActiveTest'

export interface UseQuestionsResult {
  data: QuestionsBundle | null
  error: Error | null
  loading: boolean
}

export function useQuestions(): UseQuestionsResult {
  const { activeTest } = useActiveTest()
  const [data, setData] = useState<QuestionsBundle | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    const url = TESTS[activeTest].dataUrl
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading ${url} — run \`pnpm scrape ${activeTest}\``)
        return r.json() as Promise<QuestionsBundle>
      })
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e as Error); setLoading(false) } })
    return () => { cancelled = true }
  }, [activeTest])

  return { data, error, loading }
}
