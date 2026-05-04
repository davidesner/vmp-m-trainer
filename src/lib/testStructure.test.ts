import { describe, it, expect } from 'vitest'
import { sampleTestQuestions } from './testStructure'
import type { Question, TestSegment } from '../types'

function makeQ(id: number, group: Question['group']): Question {
  return {
    id, zkratka: 'PP1', group, text: `q${id}`, image: null,
    options: [{ key: 'a', text: 'a' }, { key: 'b', text: 'b' }, { key: 'c', text: 'c' }],
    correct: 'a',
  }
}

describe('sampleTestQuestions', () => {
  const segments: TestSegment[] = [
    { groups: ['plavebni-provoz'], count: 2 },
    { groups: ['nocni-denni-signalizace'], count: 1 },
  ]

  const questions: Question[] = [
    ...Array.from({ length: 5 }, (_, i) => makeQ(100 + i, 'plavebni-provoz')),
    ...Array.from({ length: 3 }, (_, i) => makeQ(200 + i, 'nocni-denni-signalizace')),
    ...Array.from({ length: 2 }, (_, i) => makeQ(300 + i, 'zvukove-signaly')),
  ]

  it('returns exactly the requested count per segment', () => {
    const out = sampleTestQuestions(questions, segments, () => 0)
    expect(out).toHaveLength(3)
  })

  it('respects group restrictions per segment', () => {
    const out = sampleTestQuestions(questions, segments, () => 0)
    const ppCount = out.filter(q => q.group === 'plavebni-provoz').length
    const nsCount = out.filter(q => q.group === 'nocni-denni-signalizace').length
    expect(ppCount).toBe(2)
    expect(nsCount).toBe(1)
  })

  it('does not duplicate questions across segments', () => {
    const out = sampleTestQuestions(questions, segments, () => 0.5)
    const ids = out.map(q => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses provided RNG deterministically', () => {
    let i = 0
    const rng = () => [0.1, 0.5, 0.9][i++ % 3]
    const a = sampleTestQuestions(questions, segments, rng)
    i = 0
    const b = sampleTestQuestions(questions, segments, rng)
    expect(a.map(q => q.id)).toEqual(b.map(q => q.id))
  })

  it('throws when not enough questions in a segment', () => {
    const tooMany: TestSegment[] = [{ groups: ['plavebni-provoz'], count: 100 }]
    expect(() => sampleTestQuestions(questions, tooMany, () => 0)).toThrow(/not enough/i)
  })
})
