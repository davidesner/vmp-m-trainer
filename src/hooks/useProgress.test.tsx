import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProgress } from './useProgress'

describe('useProgress', () => {
  beforeEach(() => { localStorage.clear() })

  it('initializes empty', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.store.questions).toEqual({})
    expect(result.current.store.testHistory).toEqual([])
  })

  it('records an attempt and persists to localStorage', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.recordAttempt(42, true, 'practice')
    })
    expect(result.current.store.questions[42].attempts).toHaveLength(1)
    expect(result.current.store.questions[42].attempts[0].correct).toBe(true)
    const raw = JSON.parse(localStorage.getItem('vmp:progress')!)
    expect(raw.questions[42].attempts).toHaveLength(1)
  })

  it('records test history', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.recordTestHistory({
        at: new Date().toISOString(),
        score: 32, total: 35, durationSec: 1800,
        perGroup: {} as any, questionIds: [1,2,3],
      })
    })
    expect(result.current.store.testHistory).toHaveLength(1)
  })

  it('reset clears storage', () => {
    const { result } = renderHook(() => useProgress())
    act(() => { result.current.recordAttempt(1, true, 'practice') })
    act(() => { result.current.reset() })
    expect(result.current.store.questions).toEqual({})
    // After reset, localStorage key should be absent or contain empty state.
    // The save effect may re-fire with the empty store after reset, so we check
    // that either the key is absent or the stored data is empty — both are valid.
    const raw = localStorage.getItem('vmp:progress')
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      expect(parsed.questions).toEqual({})
      expect(parsed.testHistory).toEqual([])
    }
  })
})
