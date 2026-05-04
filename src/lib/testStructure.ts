import type { Question, TestSegment } from '../types'

export type RNG = () => number

/**
 * Fisher-Yates shuffle returning a new array, using provided RNG.
 */
function shuffle<T>(arr: T[], rng: RNG): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Sample questions according to test structure segments.
 * Each segment requests N questions from a list of allowed groups.
 * Questions are not duplicated across segments.
 *
 * Throws if any segment cannot be satisfied.
 */
export function sampleTestQuestions(
  questions: Question[],
  segments: TestSegment[],
  rng: RNG = Math.random,
): Question[] {
  const used = new Set<number>()
  const result: Question[] = []
  for (const seg of segments) {
    const pool = questions.filter(q => seg.groups.includes(q.group) && !used.has(q.id))
    if (pool.length < seg.count) {
      throw new Error(
        `Not enough questions for segment groups=${seg.groups.join(',')}: have ${pool.length}, need ${seg.count}`,
      )
    }
    const picked = shuffle(pool, rng).slice(0, seg.count)
    for (const q of picked) used.add(q.id)
    result.push(...picked)
  }
  return result
}
