import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useProgress } from './useProgress'
import { ActiveTestProvider } from './useActiveTest'
import { AuthProvider } from './useAuth'

interface MockState {
  attempts: { id?: number; testId?: string; questionId: number; correct: boolean; mode: 'test' | 'practice'; at: string }[]
  testHistory: { id?: number; testId?: string; at: string; score: number; total: number; durationSec: number; perGroup: object; questionIds: number[] }[]
}

function mockServer(initial: MockState) {
  let state: MockState = { attempts: [...initial.attempts], testHistory: [...initial.testHistory] }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    const method = init?.method ?? 'GET'
    if (url.startsWith('/api/progress') && !url.includes('/import') && method === 'GET') {
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
    if (url.startsWith('/api/progress') && method === 'DELETE') {
      state = { attempts: [], testHistory: [] }
      return new Response(null, { status: 204 })
    }
    return new Response('not found', { status: 404 })
  })
  return () => state
}

function wrapper({ children }: { children: ReactNode }) {
  return <ActiveTestProvider>{children}</ActiveTestProvider>
}

describe('useProgress (server-backed)', () => {
  beforeEach(() => {
    try { localStorage.removeItem('vmp.activeTestId') } catch { /* ignore */ }
  })
  afterEach(() => vi.restoreAllMocks())

  it('loads attempts and test history from the server on mount', async () => {
    mockServer({
      attempts: [{ questionId: 1, correct: true, mode: 'test', at: '2026-01-01T00:00:00Z' }],
      testHistory: [{ at: '2026-01-02T00:00:00Z', score: 30, total: 35, durationSec: 1500, perGroup: {}, questionIds: [1] }],
    })
    const { result } = renderHook(() => useProgress(), { wrapper })
    await waitFor(() => expect(result.current.store.questions[1]).toBeTruthy())
    expect(result.current.store.questions[1].attempts).toHaveLength(1)
    expect(result.current.store.testHistory).toHaveLength(1)
  })

  it('recordAttempt POSTs to /api/attempts and updates store optimistically', async () => {
    const getState = mockServer({ attempts: [], testHistory: [] })
    const { result } = renderHook(() => useProgress(), { wrapper })
    await waitFor(() => expect(result.current.store).toBeDefined())

    await act(async () => { await result.current.recordAttempt(42, true, 'test') })
    expect(result.current.store.questions[42]).toBeTruthy()
    expect(result.current.store.questions[42].attempts).toHaveLength(1)
    expect(getState().attempts).toHaveLength(1)
    expect(getState().attempts[0].questionId).toBe(42)
    expect(getState().attempts[0].testId).toBe('M')
  })

  it('recordTestHistory POSTs to /api/test-history', async () => {
    const getState = mockServer({ attempts: [], testHistory: [] })
    const { result } = renderHook(() => useProgress(), { wrapper })
    await waitFor(() => expect(result.current.store).toBeDefined())

    await act(async () => {
      await result.current.recordTestHistory({
        at: '2026-05-12T00:00:00Z', score: 30, total: 35, durationSec: 1500,
        perGroup: {} as never, questionIds: [1, 2, 3],
      })
    })
    expect(getState().testHistory).toHaveLength(1)
    expect(getState().testHistory[0].testId).toBe('M')
  })

  it('reset DELETEs /api/progress and clears local store', async () => {
    const getState = mockServer({
      attempts: [{ questionId: 1, correct: true, mode: 'test', at: '2026-01-01T00:00:00Z' }],
      testHistory: [],
    })
    const { result } = renderHook(() => useProgress(), { wrapper })
    await waitFor(() => expect(result.current.store.questions[1]).toBeTruthy())
    await act(async () => { await result.current.reset() })
    expect(result.current.store.questions[1]).toBeUndefined()
    expect(getState().attempts).toHaveLength(0)
  })
})

function mockAuthServer(me: object | null, delayMeMs = 0) {
  const calls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (url === '/api/auth/config') return new Response(JSON.stringify({ signupEnabled: false }), { status: 200 })
    if (url === '/api/me') {
      if (delayMeMs) await new Promise(r => setTimeout(r, delayMeMs))
      return me ? new Response(JSON.stringify(me), { status: 200 }) : new Response('', { status: 401 })
    }
    if (url.startsWith('/api/progress')) return new Response(JSON.stringify({ attempts: [], testHistory: [] }), { status: 200 })
    if (url === '/api/attempts' || url === '/api/test-history') return new Response(null, { status: 201 })
    return new Response('not found', { status: 404 })
  })
  return calls
}

function authWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider><ActiveTestProvider>{children}</ActiveTestProvider></AuthProvider>
}

describe('useProgress for guests', () => {
  afterEach(() => vi.restoreAllMocks())

  it('never fetches /api/progress for a guest, even while /api/me is pending', async () => {
    const calls = mockAuthServer({ id: 'g1', email: null, guest: true }, 30)
    renderHook(() => useProgress(), { wrapper: authWrapper })
    await waitFor(() => expect(calls).toContain('GET /api/me'))
    await new Promise(r => setTimeout(r, 80))
    expect(calls.some(c => c.includes('/api/progress'))).toBe(false)
  })

  it('records attempts and test history on the server without updating the store', async () => {
    const calls = mockAuthServer({ id: 'g1', email: null, guest: true })
    const { result } = renderHook(() => useProgress(), { wrapper: authWrapper })
    await waitFor(() => expect(calls).toContain('GET /api/me'))
    await act(async () => {
      await result.current.recordAttempt(5, false, 'practice')
      await result.current.recordTestHistory({ at: 'x', score: 1, total: 2, durationSec: 3, perGroup: {}, questionIds: [5] } as never)
    })
    expect(calls).toContain('POST /api/attempts')
    expect(calls).toContain('POST /api/test-history')
    expect(result.current.store).toEqual({ questions: {}, testHistory: [] })
  })

  it('reset is a no-op for a guest', async () => {
    const calls = mockAuthServer({ id: 'g1', email: null, guest: true })
    const { result } = renderHook(() => useProgress(), { wrapper: authWrapper })
    await waitFor(() => expect(calls).toContain('GET /api/me'))
    await act(async () => { await result.current.reset() })
    expect(calls.some(c => c.startsWith('DELETE'))).toBe(false)
  })

  it('still fetches /api/progress for a registered user once auth resolves', async () => {
    const calls = mockAuthServer({ id: 'u1', email: 'a@b.c', guest: false }, 30)
    renderHook(() => useProgress(), { wrapper: authWrapper })
    await waitFor(() => expect(calls.some(c => c.startsWith('GET /api/progress'))).toBe(true))
    expect(calls.indexOf('GET /api/me')).toBeLessThan(calls.findIndex(c => c.startsWith('GET /api/progress')))
  })
})
