import { useEffect, useState } from 'react'
import type { QuestionsBundle } from '../types'

export interface UseQuestionsResult {
  data: QuestionsBundle | null
  error: Error | null
  loading: boolean
}

export function useQuestions(): UseQuestionsResult {
  const [data, setData] = useState<QuestionsBundle | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/data/questions.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading questions.json — run \`pnpm scrape\``)
        return r.json() as Promise<QuestionsBundle>
      })
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e as Error); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  return { data, error, loading }
}
