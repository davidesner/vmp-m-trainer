import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAllProgress } from './useAllProgress'
import { TEST_IDS } from '../lib/tests'

afterEach(() => vi.restoreAllMocks())

function mockFetch() {
  const calls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = typeof input === 'string' ? input : (input as Request).url
    calls.push(url)
    if (url.startsWith('/data/')) {
      return new Response(JSON.stringify({ testId: 'M', name: 'M', questions: [], groups: [], testStructure: [], passing: { score: 1, total: 1 } }), { status: 200 })
    }
    if (url.startsWith('/api/progress')) return new Response(JSON.stringify({ attempts: [], testHistory: [] }), { status: 200 })
    return new Response('', { status: 404 })
  })
  return calls
}

describe('useAllProgress', () => {
  it('loads bundles without touching /api/progress when includeProgress is false', async () => {
    const calls = mockFetch()
    const { result } = renderHook(() => useAllProgress({ includeProgress: false }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(Object.keys(result.current.bundles)).toEqual(TEST_IDS)
    expect(calls.some(u => u.startsWith('/api/progress'))).toBe(false)
  })

  it('fetches /api/progress by default', async () => {
    const calls = mockFetch()
    const { result } = renderHook(() => useAllProgress())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(calls.some(u => u.startsWith('/api/progress'))).toBe(true)
  })
})
