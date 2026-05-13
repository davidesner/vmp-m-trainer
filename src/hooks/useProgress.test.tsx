import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useProgress } from './useProgress'

interface MockState {
  attempts: { id?: number; questionId: number; correct: boolean; mode: 'test' | 'practice'; at: string }[]
  testHistory: { id?: number; at: string; score: number; total: number; durationSec: number; perGroup: object; questionIds: number[] }[]
}

function mockServer(initial: MockState) {
  let state: MockState = { attempts: [...initial.attempts], testHistory: [...initial.testHistory] }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    const method = init?.method ?? 'GET'
    if (url.endsWith('/api/progress') && method === 'GET') {
      return new Response(JSON.stringify(state), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.endsWith('/api/attempts') && method === 'POST') {
      const body = JSON.parse(init!.body as string)
      state.attempts.push({ ...body, at: new Date().toISOString() })
      return new Response(null, { status: 201 })
    }
    if (url.endsWith('/api/test-history') && method === 'POST') {
      const body = JSON.parse(init!.body as string)
      state.testHistory.unshift({ ...body, at: new Date().toISOString() })
      return new Response(null, { status: 201 })
    }
    if (url.endsWith('/api/progress') && method === 'DELETE') {
      state = { attempts: [], testHistory: [] }
      return new Response(null, { status: 204 })
    }
    return new Response('not found', { status: 404 })
  })
  return () => state
}

describe('useProgress (server-backed)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loads attempts and test history from the server on mount', async () => {
    mockServer({
      attempts: [{ questionId: 1, correct: true, mode: 'test', at: '2026-01-01T00:00:00Z' }],
      testHistory: [{ at: '2026-01-02T00:00:00Z', score: 30, total: 35, durationSec: 1500, perGroup: {}, questionIds: [1] }],
    })
    const { result } = renderHook(() => useProgress())
    await waitFor(() => expect(result.current.store.questions[1]).toBeTruthy())
    expect(result.current.store.questions[1].attempts).toHaveLength(1)
    expect(result.current.store.testHistory).toHaveLength(1)
  })

  it('recordAttempt POSTs to /api/attempts and updates store optimistically', async () => {
    const getState = mockServer({ attempts: [], testHistory: [] })
    const { result } = renderHook(() => useProgress())
    await waitFor(() => expect(result.current.store).toBeDefined())

    await act(async () => { await result.current.recordAttempt(42, true, 'test') })
    expect(result.current.store.questions[42]).toBeTruthy()
    expect(result.current.store.questions[42].attempts).toHaveLength(1)
    expect(getState().attempts).toHaveLength(1)
    expect(getState().attempts[0].questionId).toBe(42)
  })

  it('recordTestHistory POSTs to /api/test-history', async () => {
    const getState = mockServer({ attempts: [], testHistory: [] })
    const { result } = renderHook(() => useProgress())
    await waitFor(() => expect(result.current.store).toBeDefined())

    await act(async () => {
      await result.current.recordTestHistory({
        at: '2026-05-12T00:00:00Z', score: 30, total: 35, durationSec: 1500,
        perGroup: {} as never, questionIds: [1, 2, 3],
      })
    })
    expect(getState().testHistory).toHaveLength(1)
  })

  it('reset DELETEs /api/progress and clears local store', async () => {
    const getState = mockServer({
      attempts: [{ questionId: 1, correct: true, mode: 'test', at: '2026-01-01T00:00:00Z' }],
      testHistory: [],
    })
    const { result } = renderHook(() => useProgress())
    await waitFor(() => expect(result.current.store.questions[1]).toBeTruthy())
    await act(async () => { await result.current.reset() })
    expect(result.current.store.questions[1]).toBeUndefined()
    expect(getState().attempts).toHaveLength(0)
  })
})
