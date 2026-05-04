import { describe, it, expect } from 'vitest'
import { estimatePass, coverage, groupAccuracy } from './passProbability'
import type { Question, QuestionsBundle, ProgressStore, GroupId } from '../types'

function makeQ(id: number, group: GroupId): Question {
  return {
    id, zkratka: 'PP1', group, text: `q${id}`, image: null,
    options: [{ key: 'a', text: 'a' }, { key: 'b', text: 'b' }, { key: 'c', text: 'c' }],
    correct: 'a',
  }
}

const GROUPS = [
  { id: 'plavebni-provoz' as const,             name: 'PP', zkratky: [] },
  { id: 'nocni-denni-signalizace' as const,     name: 'NS', zkratky: [] },
  { id: 'signalizace-rizeni-plavby' as const,   name: 'SR', zkratky: [] },
  { id: 'zvukove-signaly' as const,             name: 'ZS', zkratky: [] },
  { id: 'vytyceni-vodnich-cest' as const,       name: 'VV', zkratky: [] },
  { id: 'zaklady-konstrukce-plavidel' as const, name: 'KP', zkratky: [] },
  { id: 'zaklady-prvni-pomoci' as const,        name: 'PP1', zkratky: [] },
]

const TEST_STRUCTURE = [
  { groups: ['plavebni-provoz' as const], count: 16 },
  { groups: ['nocni-denni-signalizace' as const], count: 7 },
  { groups: ['signalizace-rizeni-plavby' as const, 'zvukove-signaly' as const, 'vytyceni-vodnich-cest' as const], count: 5 },
  { groups: ['zaklady-konstrukce-plavidel' as const], count: 3 },
  { groups: ['zaklady-prvni-pomoci' as const], count: 4 },
]

function makeBundle(): QuestionsBundle {
  const questions: Question[] = []
  let id = 1
  // Make plenty of questions per group so segments can sample
  const perGroupCount = { 'plavebni-provoz': 50, 'nocni-denni-signalizace': 30, 'signalizace-rizeni-plavby': 20, 'zvukove-signaly': 30, 'vytyceni-vodnich-cest': 0, 'zaklady-konstrukce-plavidel': 15, 'zaklady-prvni-pomoci': 15 }
  for (const [g, n] of Object.entries(perGroupCount)) {
    for (let i = 0; i < n; i++) questions.push(makeQ(id++, g as GroupId))
  }
  return {
    version: 'M-2015',
    scrapedAt: '2026-05-04',
    groups: GROUPS as any,
    testStructure: TEST_STRUCTURE,
    questions,
  }
}

describe('groupAccuracy', () => {
  it('returns 1/3 for unseen group (Laplace prior)', () => {
    const bundle = makeBundle()
    const acc = groupAccuracy('plavebni-provoz', bundle.questions, {})
    expect(acc).toBeCloseTo(1 / 3, 5)
  })

  it('smooths toward 1/3 with few attempts', () => {
    const bundle = makeBundle()
    const ppQ = bundle.questions.find(q => q.group === 'plavebni-provoz')!
    const progress: ProgressStore['questions'] = {
      [ppQ.id]: {
        attempts: [{ at: '2026-05-01', correct: false, mode: 'practice' }],
        lastSeen: '2026-05-01',
      },
    }
    // (0+1) / (1+3) = 0.25 — between 0 and 1/3
    expect(groupAccuracy('plavebni-provoz', bundle.questions, progress)).toBeCloseTo(0.25, 5)
  })

  it('approaches raw rate with many attempts', () => {
    const bundle = makeBundle()
    const ppQs = bundle.questions.filter(q => q.group === 'plavebni-provoz').slice(0, 20)
    const progress: ProgressStore['questions'] = {}
    for (const q of ppQs) {
      // 10 attempts each, 8 correct
      progress[q.id] = {
        attempts: Array.from({ length: 10 }, (_, i) => ({ at: `2026-05-${i+1}`, correct: i < 8, mode: 'practice' as const })),
        lastSeen: '2026-05-10',
      }
    }
    // total: 200 attempts, 160 correct → (160+1)/(200+3) = 0.793
    expect(groupAccuracy('plavebni-provoz', bundle.questions, progress)).toBeCloseTo(161 / 203, 4)
  })
})

describe('estimatePass', () => {
  it('returns near-zero pass probability with no progress', () => {
    const bundle = makeBundle()
    const r = estimatePass(bundle, {})
    expect(r.passProbability).toBeLessThan(0.01)
    expect(r.expectedScore).toBeCloseTo(35 / 3, 1)  // ~11.67
  })

  it('returns ~1.0 pass probability with perfect progress on all groups', () => {
    const bundle = makeBundle()
    const progress: ProgressStore['questions'] = {}
    for (const q of bundle.questions) {
      progress[q.id] = {
        attempts: Array.from({ length: 20 }, (_, i) => ({ at: `2026-05-${i+1}`, correct: true, mode: 'practice' as const })),
        lastSeen: '2026-05-20',
      }
    }
    const r = estimatePass(bundle, progress)
    expect(r.passProbability).toBeGreaterThan(0.95)
    expect(r.expectedScore).toBeGreaterThan(33)
  })

  it('expected score scales with accuracy', () => {
    const bundle = makeBundle()
    const progress: ProgressStore['questions'] = {}
    for (const q of bundle.questions) {
      // 80% accuracy: 8/10 correct
      progress[q.id] = {
        attempts: Array.from({ length: 10 }, (_, i) => ({ at: `2026-05-${i+1}`, correct: i < 8, mode: 'practice' as const })),
        lastSeen: '2026-05-10',
      }
    }
    const r = estimatePass(bundle, progress)
    // Expected score should be ~28 (35 × 0.8 with smoothing)
    expect(r.expectedScore).toBeGreaterThan(25)
    expect(r.expectedScore).toBeLessThan(30)
  })
})

describe('coverage', () => {
  it('returns zero coverage with no progress', () => {
    const bundle = makeBundle()
    const c = coverage(bundle, {})
    expect(c.overall.seen).toBe(0)
    expect(c.overall.total).toBe(bundle.questions.length)
    expect(c.overall.accuracy).toBeNull()
  })

  it('counts seen questions and accuracy', () => {
    const bundle = makeBundle()
    const ppQs = bundle.questions.filter(q => q.group === 'plavebni-provoz').slice(0, 10)
    const progress: ProgressStore['questions'] = {}
    for (const q of ppQs) {
      progress[q.id] = {
        attempts: [{ at: '2026-05-01', correct: true, mode: 'practice' }],
        lastSeen: '2026-05-01',
      }
    }
    const c = coverage(bundle, progress)
    expect(c.overall.seen).toBe(10)
    expect(c.perGroup['plavebni-provoz'].seen).toBe(10)
    expect(c.perGroup['plavebni-provoz'].accuracy).toBe(1)
    expect(c.perGroup['nocni-denni-signalizace'].seen).toBe(0)
    expect(c.perGroup['nocni-denni-signalizace'].accuracy).toBeNull()
  })
})
