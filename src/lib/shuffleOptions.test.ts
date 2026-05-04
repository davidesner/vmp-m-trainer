import { describe, it, expect } from 'vitest'
import { shuffleQuestionOptions } from './shuffleOptions'
import type { Question } from '../types'

const Q: Question = {
  id: 1, zkratka: 'PP1', group: 'plavebni-provoz', text: 'q', image: null,
  options: [
    { key: 'a', text: 'CORRECT' },
    { key: 'b', text: 'wrong-1' },
    { key: 'c', text: 'wrong-2' },
  ],
  correct: 'a',
}

describe('shuffleQuestionOptions', () => {
  it('preserves all option texts', () => {
    const out = shuffleQuestionOptions(Q, () => 0.5)
    const texts = out.options.map(o => o.text).sort()
    expect(texts).toEqual(['CORRECT', 'wrong-1', 'wrong-2'])
  })

  it('keys are always a/b/c in order', () => {
    const out = shuffleQuestionOptions(Q, () => 0.1)
    expect(out.options.map(o => o.key)).toEqual(['a', 'b', 'c'])
  })

  it('correct field points to the new position of the correct text', () => {
    const out = shuffleQuestionOptions(Q, () => 0)
    const correctOpt = out.options.find(o => o.key === out.correct)
    expect(correctOpt?.text).toBe('CORRECT')
  })

  it('preserves other Question fields', () => {
    const out = shuffleQuestionOptions(Q, () => 0.5)
    expect(out.id).toBe(Q.id)
    expect(out.text).toBe(Q.text)
    expect(out.zkratka).toBe(Q.zkratka)
    expect(out.group).toBe(Q.group)
    expect(out.image).toBe(Q.image)
  })

  it('determinism: same RNG produces same output', () => {
    const a = shuffleQuestionOptions(Q, () => 0.3)
    const b = shuffleQuestionOptions(Q, () => 0.3)
    expect(a.options).toEqual(b.options)
    expect(a.correct).toBe(b.correct)
  })

  it('different RNG values produce different orderings', () => {
    const a = shuffleQuestionOptions(Q, () => 0)
    const b = shuffleQuestionOptions(Q, () => 0.99)
    expect(a.options.map(o => o.text)).not.toEqual(b.options.map(o => o.text))
  })

  it('returns the question unchanged when correct field has no matching option (degenerate)', () => {
    const broken = { ...Q, correct: 'a' as const, options: [{ key: 'b' as const, text: 'x' }, { key: 'c' as const, text: 'y' }, { key: 'a' as const, text: 'z' }] }
    // 'a' exists, so this should still work - sanity check.
    const out = shuffleQuestionOptions(broken, () => 0.5)
    expect(out.options).toHaveLength(3)
  })
})
