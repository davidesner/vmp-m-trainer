interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

const WINDOW_MS = 15 * 60_000  // 15 minutes
const MAX = 5

export interface CheckResult { allowed: boolean; retryAfterSec: number }

export function checkRateLimit(key: string, now = Date.now()): CheckResult {
  let b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS }
    buckets.set(key, b)
  }
  b.count += 1
  if (b.count > MAX) {
    return { allowed: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) }
  }
  return { allowed: true, retryAfterSec: 0 }
}

// Test helper
export function _resetRateLimit() { buckets.clear() }
