import { useCallback, useRef, useState } from 'react'
import type { ExplanationMeta } from '../types'

export interface ExplanationFetchResult {
  status: 'hit' | 'miss'
  html?: string
  meta?: ExplanationMeta
}

export function useExplanations() {
  const [cache, setCache] = useState<Record<number, ExplanationFetchResult>>({})
  const cacheRef = useRef(cache)
  cacheRef.current = cache

  const fetchExplanation = useCallback(async (qid: number, force = false): Promise<ExplanationFetchResult> => {
    if (!force && cacheRef.current[qid]) return cacheRef.current[qid]
    try {
      const htmlRes = await fetch(`/explanations/q-${qid}.html`, { cache: 'no-store' })
      if (htmlRes.status === 404) {
        const r: ExplanationFetchResult = { status: 'miss' }
        setCache(c => ({ ...c, [qid]: r }))
        return r
      }
      if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status}`)
      const html = await htmlRes.text()
      let meta: ExplanationMeta | undefined
      try {
        const metaRes = await fetch(`/explanations/q-${qid}.meta.json`, { cache: 'no-store' })
        if (metaRes.ok) meta = await metaRes.json()
      } catch { /* meta optional */ }
      const r: ExplanationFetchResult = { status: 'hit', html, meta }
      setCache(c => ({ ...c, [qid]: r }))
      return r
    } catch {
      const r: ExplanationFetchResult = { status: 'miss' }
      setCache(c => ({ ...c, [qid]: r }))
      return r
    }
  }, [])

  return { fetchExplanation, cache }
}
