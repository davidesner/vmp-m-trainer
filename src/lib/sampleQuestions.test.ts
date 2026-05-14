import { describe, it, expect } from 'vitest'
import { sampleByMix, computeBucket } from './sampleQuestions'
import type { Question, ProgressStore } from '../types'

function makeQ(id: number): Question {
  return {
    id, zkratka: 'PP1', group: 'plavebni-provoz', text: `q${id}`, image: null,
    options: [{ key: 'a', text: 'a' }, { key: 'b', text: 'b' }, { key: 'c', text: 'c' }],
    correct: 'a',
  }
}

const NOW = new Date('2026-05-04T12:00:00Z').getTime()

describe('computeBucket', () => {
  it('returns "new" for unseen question', () => {
    expect(computeBucket(undefined, NOW)).toBe('new')
    expect(computeBucket({ attempts: [], lastSeen: '' }, NOW)).toBe('new')
  })

  it('returns "weak" when error rate > 0.4', () => {
    const p = {
      attempts: [
        { at: '2026-05-01T00:00:00Z', correct: false, mode: 'practice' as const },
        { at: '2026-05-02T00:00:00Z', correct: false, mode: 'practice' as const },
        { at: '2026-05-03T00:00:00Z', correct: true,  mode: 'practice' as const },
      ],
      lastSeen: '2026-05-03T00:00:00Z',
    }
    expect(computeBucket(p, NOW)).toBe('weak')
  })

  it('returns "stale" when last seen > 7 days ago', () => {
    const p = {
      attempts: [{ at: '2026-04-01T00:00:00Z', correct: true, mode: 'practice' as const }],
      lastSeen: '2026-04-01T00:00:00Z',
    }
    expect(computeBucket(p, NOW)).toBe('stale')
  })

  it('returns "known" when recent and high success', () => {
    const p = {
      attempts: [{ at: '2026-05-03T00:00:00Z', correct: true, mode: 'practice' as const }],
      lastSeen: '2026-05-03T00:00:00Z',
    }
    expect(computeBucket(p, NOW)).toBe('known')
  })
})

describe('sampleByMix', () => {
  const all: Question[] = Array.from({ length: 100 }, (_, i) => makeQ(i + 1))

  it('returns exactly N questions', () => {
    const out = sampleByMix(all, {} as ProgressStore['questions'], 'mix', 10, NOW, () => 0.5)
    expect(out).toHaveLength(10)
  })

  it('returns all unique', () => {
    const out = sampleByMix(all, {}, 'mix', 30, NOW, () => 0.3)
    expect(new Set(out.map(q => q.id)).size).toBe(out.length)
  })

  it('"random" picks from all uniformly (no progress influence)', () => {
    const progress = { 1: { attempts: [{ at: '2026-04-01', correct: false, mode: 'practice' }, { at: '2026-04-02', correct: false, mode: 'practice' }], lastSeen: '2026-04-02' } } as any
    let calls = 0
    const rng = () => { calls++; return 0.1 }
    const out = sampleByMix(all, progress, 'random', 10, NOW, rng)
    expect(out).toHaveLength(10)
    expect(calls).toBeGreaterThan(0)
  })

  it('"weak" prioritizes high-error questions, falls back to others if not enough', () => {
    const progress: ProgressStore['questions'] = {}
    for (let i = 1; i <= 5; i++) {
      progress[i] = {
        attempts: [
          { at: '2026-05-01T00:00:00Z', correct: false, mode: 'practice' },
          { at: '2026-05-02T00:00:00Z', correct: false, mode: 'practice' },
        ],
        lastSeen: '2026-05-02T00:00:00Z',
      }
    }
    const out = sampleByMix(all, progress, 'weak', 10, NOW, () => 0.5)
    const weakIds = out.filter(q => q.id <= 5)
    expect(weakIds.length).toBeGreaterThanOrEqual(5)
    expect(out).toHaveLength(10)
  })

  it('"weak" treats unseen (new) questions as weakness, not just high-error ones', () => {
    // 5 weak (id 1-5), 5 known (id 6-10), rest (id 11-100) are new (unseen).
    const progress: ProgressStore['questions'] = {}
    for (let i = 1; i <= 5; i++) progress[i] = {
      attempts: [
        { at: '2026-05-01T00:00:00Z', correct: false, mode: 'practice' },
        { at: '2026-05-02T00:00:00Z', correct: false, mode: 'practice' },
      ],
      lastSeen: '2026-05-02T00:00:00Z',
    }
    for (let i = 6; i <= 10; i++) progress[i] = {
      attempts: [{ at: '2026-05-03T00:00:00Z', correct: true, mode: 'practice' }],
      lastSeen: '2026-05-03T00:00:00Z',
    }

    const out = sampleByMix(all, progress, 'weak', 20, NOW, () => 0.5)
    expect(out).toHaveLength(20)
    // All 5 weak + 15 new should be picked before any of the 5 known.
    const knownPicked = out.filter(q => q.id >= 6 && q.id <= 10)
    expect(knownPicked).toHaveLength(0)
    const weakPicked = out.filter(q => q.id <= 5)
    const newPicked = out.filter(q => q.id >= 11)
    expect(weakPicked).toHaveLength(5)
    expect(newPicked).toHaveLength(15)
  })

  it('"weak" falls back to stale before known when weak+new is exhausted', () => {
    // 2 weak (id 1-2), 30 stale (id 3-32), 30 known (id 33-62), 38 new (id 63-100).
    const progress: ProgressStore['questions'] = {}
    for (let i = 1; i <= 2; i++) progress[i] = {
      attempts: [
        { at: '2026-05-01T00:00:00Z', correct: false, mode: 'practice' },
        { at: '2026-05-02T00:00:00Z', correct: false, mode: 'practice' },
      ],
      lastSeen: '2026-05-02T00:00:00Z',
    }
    for (let i = 3; i <= 32; i++) progress[i] = {
      attempts: [{ at: '2026-04-20T00:00:00Z', correct: true, mode: 'practice' }],
      lastSeen: '2026-04-20T00:00:00Z',
    }
    for (let i = 33; i <= 62; i++) progress[i] = {
      attempts: [{ at: '2026-05-03T00:00:00Z', correct: true, mode: 'practice' }],
      lastSeen: '2026-05-03T00:00:00Z',
    }
    // ids 63-100 are new

    // Ask for 60: should consume 2 weak + 38 new + 20 stale, with NO known.
    const out = sampleByMix(all, progress, 'weak', 60, NOW, () => 0.5)
    expect(out).toHaveLength(60)
    const knownPicked = out.filter(q => q.id >= 33 && q.id <= 62)
    expect(knownPicked).toHaveLength(0)
  })

  it('"mix" respects bucket targets and cascade-fills overflow proportionally', () => {
    // Pool: 100 questions
    // 30 weak (id 1-30), 30 known (id 31-60), 30 stale (id 61-90), 10 new (id 91-100)
    const progress: ProgressStore['questions'] = {}
    // 30 weak (id 1-30)
    for (let i = 1; i <= 30; i++) progress[i] = {
      attempts: [
        { at: '2026-05-01T00:00:00Z', correct: false, mode: 'practice' },
        { at: '2026-05-02T00:00:00Z', correct: false, mode: 'practice' },
      ],
      lastSeen: '2026-05-02T00:00:00Z',
    }
    // 30 known (id 31-60)
    for (let i = 31; i <= 60; i++) progress[i] = {
      attempts: [{ at: '2026-05-03T00:00:00Z', correct: true, mode: 'practice' }],
      lastSeen: '2026-05-03T00:00:00Z',
    }
    // 30 stale (id 61-90), seen > 7 days ago
    for (let i = 61; i <= 90; i++) progress[i] = {
      attempts: [{ at: '2026-04-20T00:00:00Z', correct: true, mode: 'practice' }],
      lastSeen: '2026-04-20T00:00:00Z',
    }
    // 10 new (id 91-100): no progress entry

    const out = sampleByMix(all, progress, 'mix', 100, NOW, () => 0.5)
    expect(out).toHaveLength(100)

    const buckets = { weak: 0, known: 0, stale: 0, new: 0 }
    for (const q of out) {
      if (q.id <= 30) buckets.weak++
      else if (q.id <= 60) buckets.known++
      else if (q.id <= 90) buckets.stale++
      else buckets.new++
    }

    // targets: weak=40, new=30, stale=15, known=15
    // available: weak=30 (<40), new=10 (<30), stale=30 (>15), known=30 (>15)
    // Take: weak=30, new=10, stale=15, known=15 → subtotal=70
    // Cascade fill 30 from FILL_ORDER [known, weak, stale, new]:
    //   known: 30-15=15 avail → take 15 (total=85)
    //   weak: 30-30=0 avail → skip
    //   stale: 30-15=15 avail → take 15 (total=100)
    // Final: weak=30, known=30, stale=30, new=10
    expect(buckets.weak).toBe(30)
    expect(buckets.new).toBe(10)
    expect(buckets.known).toBe(30)
    expect(buckets.stale).toBe(30)
  })
})
