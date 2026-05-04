import type { Question, ProgressStore, QuestionProgress, MixMode } from '../types'

export type Bucket = 'new' | 'weak' | 'stale' | 'known'

export type RNG = () => number

const DAY_MS = 86_400_000
const WEAK_ERROR_RATE_THRESHOLD = 0.4
const STALE_DAYS = 7

export function computeBucket(progress: QuestionProgress | undefined, nowMs: number): Bucket {
  if (!progress || !progress.attempts || progress.attempts.length === 0) return 'new'
  const errors = progress.attempts.filter(a => !a.correct).length
  const errorRate = errors / progress.attempts.length
  if (errorRate > WEAK_ERROR_RATE_THRESHOLD) return 'weak'
  const lastSeenMs = progress.lastSeen ? new Date(progress.lastSeen).getTime() : 0
  const daysSince = (nowMs - lastSeenMs) / DAY_MS
  if (!progress.lastSeen || daysSince > STALE_DAYS) return 'stale'
  return 'known'
}

function shuffle<T>(arr: T[], rng: RNG): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const TARGETS: Record<Bucket, number> = { weak: 0.40, new: 0.30, stale: 0.15, known: 0.15 }
const FILL_ORDER: Bucket[] = ['known', 'weak', 'stale', 'new']

export function sampleByMix(
  pool: Question[],
  progress: ProgressStore['questions'],
  mode: MixMode,
  count: number,
  nowMs: number,
  rng: RNG = Math.random,
): Question[] {
  if (count > pool.length) return shuffle(pool, rng)

  if (mode === 'random') {
    return shuffle(pool, rng).slice(0, count)
  }

  // Bucketize
  const buckets: Record<Bucket, Question[]> = { new: [], weak: [], stale: [], known: [] }
  for (const q of pool) buckets[computeBucket(progress[q.id], nowMs)].push(q)
  for (const b of Object.keys(buckets) as Bucket[]) buckets[b] = shuffle(buckets[b], rng)

  if (mode === 'weak') {
    const result: Question[] = []
    for (const q of buckets.weak) { if (result.length < count) result.push(q) }
    for (const b of FILL_ORDER) {
      for (const q of buckets[b]) {
        if (result.length >= count) break
        if (!result.includes(q)) result.push(q)
      }
    }
    return shuffle(result, rng).slice(0, count)
  }

  // mix
  const targetCounts: Record<Bucket, number> = {
    weak: Math.round(count * TARGETS.weak),
    new: Math.round(count * TARGETS.new),
    stale: Math.round(count * TARGETS.stale),
    known: Math.round(count * TARGETS.known),
  }
  // adjust rounding to ensure sum equals count
  const sumTargets = Object.values(targetCounts).reduce((s, v) => s + v, 0)
  if (sumTargets !== count) targetCounts.weak += (count - sumTargets)

  const taken: Question[] = []
  for (const b of ['weak', 'new', 'stale', 'known'] as Bucket[]) {
    const desired = targetCounts[b]
    taken.push(...buckets[b].slice(0, desired))
  }

  // cascade-fill from FILL_ORDER if any bucket was short
  if (taken.length < count) {
    const takenSet = new Set(taken)
    for (const b of FILL_ORDER) {
      for (const q of buckets[b]) {
        if (taken.length >= count) break
        if (!takenSet.has(q)) {
          taken.push(q)
          takenSet.add(q)
        }
      }
      if (taken.length >= count) break
    }
  }

  return shuffle(taken, rng).slice(0, count)
}
