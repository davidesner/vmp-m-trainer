import type { Question } from '../types'

export type RNG = () => number

const KEYS: Array<'a' | 'b' | 'c'> = ['a', 'b', 'c']

function shuffle<T>(arr: T[], rng: RNG): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Shuffle a question's options into a random order and re-letter them as a/b/c.
 * The originally-correct option keeps its content but lands in a random position;
 * `correct` is updated to that new position so equality checks still work.
 */
export function shuffleQuestionOptions(q: Question, rng: RNG = Math.random): Question {
  const originalCorrect = q.options.find(o => o.key === q.correct)
  if (!originalCorrect) return q
  const shuffled = shuffle(q.options, rng)
  const newOptions = shuffled.map((opt, i) => ({ key: KEYS[i], text: opt.text }))
  const newCorrectIdx = shuffled.findIndex(o => o.text === originalCorrect.text)
  return { ...q, options: newOptions, correct: KEYS[newCorrectIdx] }
}
