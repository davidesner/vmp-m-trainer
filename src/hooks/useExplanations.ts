import { useCallback, useRef, useState } from 'react'
import type { ExplanationMeta } from '../types'
import { useActiveTest } from './useActiveTest'
import { TESTS, type TestId } from '../lib/tests'

export interface ExplanationFetchResult {
  status: 'hit' | 'miss'
  html?: string
  meta?: ExplanationMeta
}

/** `testOverride` loads another category's explanations than the active one (e.g. landing page samples). */
export function useExplanations(testOverride?: TestId) {
  const { activeTest: currentTest } = useActiveTest()
  const activeTest = testOverride ?? currentTest
  const [cache, setCache] = useState<Record<string, ExplanationFetchResult>>({})
  const cacheRef = useRef(cache)
  cacheRef.current = cache

  const fetchExplanation = useCallback(async (qid: number, force = false): Promise<ExplanationFetchResult> => {
    const key = `${activeTest}:${qid}`
    if (!force && cacheRef.current[key]) return cacheRef.current[key]
    const base = TESTS[activeTest].explanationsBase
    try {
      const htmlRes = await fetch(`${base}/q-${qid}.html`, { cache: 'no-store' })
      if (htmlRes.status === 404) {
        const r: ExplanationFetchResult = { status: 'miss' }
        setCache(c => ({ ...c, [key]: r }))
        return r
      }
      if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status}`)
      const html = await htmlRes.text()
      let meta: ExplanationMeta | undefined
      try {
        const metaRes = await fetch(`${base}/q-${qid}.meta.json`, { cache: 'no-store' })
        if (metaRes.ok) meta = await metaRes.json()
      } catch { /* meta optional */ }
      const r: ExplanationFetchResult = { status: 'hit', html, meta }
      setCache(c => ({ ...c, [key]: r }))
      return r
    } catch {
      const r: ExplanationFetchResult = { status: 'miss' }
      setCache(c => ({ ...c, [key]: r }))
      return r
    }
  }, [activeTest])

  return { fetchExplanation, cache }
}
