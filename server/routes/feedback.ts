import { Hono } from 'hono'
import type { AppEnv } from '../types.js'
import { requireAuth } from '../auth/middleware.js'
import { checkRateLimit } from '../auth/rateLimit.js'

const MAX_MESSAGE_LEN = 4000

export interface FeedbackDeps {
  /** Override the GitHub API caller for tests. */
  createIssue?: (input: { title: string; body: string }) => Promise<{ ok: true; url: string } | { ok: false; status: number; error: string }>
}

export function feedbackRoutes(deps: FeedbackDeps = {}) {
  const r = new Hono<AppEnv>()
  r.use('*', requireAuth())

  r.post('/', async c => {
    const user = c.get('user')!

    const rl = checkRateLimit(`feedback:${user.id}`)
    if (!rl.allowed) {
      return c.json({ error: 'too many feedback submissions' }, 429, { 'retry-after': String(rl.retryAfterSec) })
    }

    const body = await c.req.json().catch(() => null) as { testId?: unknown; qid?: unknown; message?: unknown } | null
    if (!body) return c.json({ error: 'bad request' }, 400)
    const TEST_IDS = ['M', 'C'] as const
    if (typeof body.testId !== 'string' || !TEST_IDS.includes(body.testId as typeof TEST_IDS[number])) {
      return c.json({ error: 'bad testId' }, 400)
    }
    if (typeof body.qid !== 'number' || !Number.isFinite(body.qid) || body.qid <= 0) {
      return c.json({ error: 'bad qid' }, 400)
    }
    if (typeof body.message !== 'string') return c.json({ error: 'bad message' }, 400)
    const message = body.message.trim()
    if (message.length === 0) return c.json({ error: 'empty message' }, 400)
    if (message.length > MAX_MESSAGE_LEN) return c.json({ error: 'message too long' }, 400)

    const repo = process.env.GITHUB_FEEDBACK_REPO
    const token = process.env.GITHUB_FEEDBACK_TOKEN
    const caller = deps.createIssue ?? (repo && token ? defaultCreateIssue(repo, token) : null)
    if (!caller) {
      console.error('[feedback] GITHUB_FEEDBACK_REPO or GITHUB_FEEDBACK_TOKEN not configured')
      return c.json({ error: 'feedback not configured on server' }, 503)
    }

    const title = `[${body.testId}] Vysvětlení k otázce #${body.qid}: zpětná vazba`
    const issueBody = [
      `**Kategorie:** ${body.testId}`,
      `**Otázka:** #${body.qid}`,
      '',
      '**Zpětná vazba:**',
      '',
      message,
      '',
      '---',
      '_Reported via VMP Trenažér._',
    ].join('\n')

    const result = await caller({ title, body: issueBody })
    if (!result.ok) {
      console.error('[feedback] GitHub API error', result.status, result.error)
      return c.json({ error: 'failed to submit feedback' }, 502)
    }
    return c.json({ url: result.url }, 201)
  })

  return r
}

function defaultCreateIssue(repo: string, token: string) {
  return async (input: { title: string; body: string }) => {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${token}`,
        'accept': 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        'user-agent': 'vmp-m-trainer',
      },
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        labels: ['explanation-feedback'],
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false as const, status: res.status, error: text }
    }
    const json = await res.json() as { html_url?: string }
    return { ok: true as const, url: json.html_url ?? '' }
  }
}
