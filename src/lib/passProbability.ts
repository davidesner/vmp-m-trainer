import type { GroupId, Question, QuestionsBundle, ProgressStore } from '../types'

export interface PassEstimate {
  passProbability: number  // 0..1
  expectedScore: number    // 0..35
  variance: number
}

export interface CoverageStats {
  overall: { seen: number; total: number; accuracy: number | null }
  perGroup: Record<GroupId, { seen: number; total: number; accuracy: number | null }>
}

const PRIOR_PROB = 1 / 3
const PRIOR_WEIGHT = 3

/**
 * Per-group success probability with Laplace smoothing toward 1/3 (random guess).
 * (correct + 1) / (attempts + 3)
 */
export function groupAccuracy(group: GroupId, questions: Question[], progress: ProgressStore['questions']): number {
  let correct = 0
  let total = 0
  for (const q of questions) {
    if (q.group !== group) continue
    const p = progress[q.id]
    if (!p) continue
    correct += p.attempts.filter(a => a.correct).length
    total += p.attempts.length
  }
  return (correct + 1) / (total + PRIOR_WEIGHT)
}

/**
 * Standard normal CDF (Abramowitz & Stegun 26.2.17).
 * Used for normal approximation to the binomial-like distribution of test scores.
 */
function normCDF(z: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.sqrt(2)
  const t = 1 / (1 + p * x)
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

/**
 * Estimate the probability of passing the real test (≥ passingScore).
 *
 * Method: per-group accuracy with Laplace smoothing → expected score and
 * variance per segment (assuming each drawn question is independent with
 * probability equal to the segment's pool-weighted average accuracy) → normal
 * approximation with continuity correction for P(score ≥ passingScore).
 */
export function estimatePass(
  data: QuestionsBundle,
  progress: ProgressStore['questions'],
  passingScore = 30,
): PassEstimate {
  const groupAcc: Record<GroupId, number> = {} as Record<GroupId, number>
  for (const g of data.groups) {
    groupAcc[g.id] = groupAccuracy(g.id, data.questions, progress)
  }

  let E = 0
  let V = 0

  for (const seg of data.testStructure) {
    const pool = data.questions.filter(q => seg.groups.includes(q.group))
    if (pool.length === 0) continue

    const groupCount: Partial<Record<GroupId, number>> = {}
    for (const q of pool) groupCount[q.group] = (groupCount[q.group] ?? 0) + 1

    let p_seg = 0
    for (const g of seg.groups) {
      const c = groupCount[g] ?? 0
      const p_g = groupAcc[g] ?? PRIOR_PROB
      p_seg += (c / pool.length) * p_g
    }

    E += seg.count * p_seg
    V += seg.count * p_seg * (1 - p_seg)
  }

  const sd = Math.sqrt(V)
  const passProbability = sd === 0
    ? (E >= passingScore ? 1 : 0)
    : 1 - normCDF((passingScore - 0.5 - E) / sd)

  return { passProbability, expectedScore: E, variance: V }
}

/**
 * Coverage and accuracy stats per group + overall.
 * "Seen" means the question has at least one recorded attempt.
 */
export function coverage(data: QuestionsBundle, progress: ProgressStore['questions']): CoverageStats {
  const perGroup: Record<GroupId, { seen: number; total: number; accuracy: number | null; _correct: number; _attempts: number }> = {} as Record<GroupId, { seen: number; total: number; accuracy: number | null; _correct: number; _attempts: number }>
  for (const g of data.groups) {
    perGroup[g.id] = { seen: 0, total: 0, accuracy: null, _correct: 0, _attempts: 0 }
  }

  let totalSeen = 0
  let totalCorrect = 0
  let totalAttempts = 0

  for (const q of data.questions) {
    perGroup[q.group].total++
    const p = progress[q.id]
    if (p && p.attempts.length > 0) {
      perGroup[q.group].seen++
      totalSeen++
      const correct = p.attempts.filter(a => a.correct).length
      perGroup[q.group]._correct += correct
      perGroup[q.group]._attempts += p.attempts.length
      totalCorrect += correct
      totalAttempts += p.attempts.length
    }
  }

  const cleanedPerGroup: Record<GroupId, { seen: number; total: number; accuracy: number | null }> = {} as Record<GroupId, { seen: number; total: number; accuracy: number | null }>
  for (const g of data.groups) {
    const x = perGroup[g.id]
    cleanedPerGroup[g.id] = {
      seen: x.seen,
      total: x.total,
      accuracy: x._attempts > 0 ? x._correct / x._attempts : null,
    }
  }

  return {
    overall: {
      seen: totalSeen,
      total: data.questions.length,
      accuracy: totalAttempts > 0 ? totalCorrect / totalAttempts : null,
    },
    perGroup: cleanedPerGroup,
  }
}
