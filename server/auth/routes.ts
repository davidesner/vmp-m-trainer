import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import { randomUUID, timingSafeEqual } from 'node:crypto'
import type { AppEnv } from '../types.js'
import type { Db } from '../db/client.js'
import { users } from '../db/schema.js'
import { hashPassword, verifyPassword } from './password.js'
import { createSession, deleteSession } from './sessions.js'
import { COOKIE_NAME } from './middleware.js'
import { checkRateLimit } from './rateLimit.js'

export interface AuthRoutesOptions {
  db: Db
  cookieSecure: boolean
  /** Shared invite code required to self-register. Empty/undefined disables signup. */
  signupCode?: string
}

const SESSION_COOKIE = {
  httpOnly: true,
  sameSite: 'Lax',
  path: '/',
  maxAge: 30 * 86400,
} as const

/** Constant-time string compare that doesn't leak length via early return. */
function codeMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function authRoutes(opts: AuthRoutesOptions) {
  const r = new Hono<AppEnv>()
  const signupEnabled = Boolean(opts.signupCode)

  // Lets the SPA decide whether to show the "create account" link.
  r.get('/config', c => c.json({ signupEnabled }))

  r.post('/register', async c => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const rl = checkRateLimit(`register:${ip}`)
    if (!rl.allowed) {
      return c.json({ error: 'too many attempts' }, 429, { 'retry-after': String(rl.retryAfterSec) })
    }
    if (!opts.signupCode) return c.json({ error: 'registration disabled' }, 403)

    const body = await c.req.json().catch(() => null) as
      { email?: string; password?: string; code?: string } | null
    const email = body?.email?.trim().toLowerCase()
    const password = body?.password
    const code = body?.code
    if (!email || !password || !code) return c.json({ error: 'bad request' }, 400)
    if (!email.includes('@')) return c.json({ error: 'invalid email' }, 400)
    if (password.length < 8) return c.json({ error: 'password too short' }, 400)
    if (!codeMatches(code, opts.signupCode)) return c.json({ error: 'invalid code' }, 403)

    const existing = await opts.db.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    if (existing[0]) return c.json({ error: 'email already registered' }, 409)

    const id = randomUUID()
    await opts.db.db.insert(users).values({
      id,
      email,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    })

    const sid = await createSession(opts.db.db, id)
    setCookie(c, COOKIE_NAME, sid, { ...SESSION_COOKIE, secure: opts.cookieSecure })
    return c.json({ id, email }, 201)
  })

  r.post('/login', async c => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const rl = checkRateLimit(`login:${ip}`)
    if (!rl.allowed) {
      return c.json({ error: 'too many attempts' }, 429, { 'retry-after': String(rl.retryAfterSec) })
    }
    const body = await c.req.json().catch(() => null) as { email?: string; password?: string } | null
    if (!body?.email || !body?.password) return c.json({ error: 'bad request' }, 400)

    const row = await opts.db.db
      .select()
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1)
    const user = row[0]
    if (!user) return c.json({ error: 'invalid credentials' }, 401)
    if (!(await verifyPassword(user.passwordHash, body.password))) {
      return c.json({ error: 'invalid credentials' }, 401)
    }

    const sid = await createSession(opts.db.db, user.id)
    setCookie(c, COOKIE_NAME, sid, { ...SESSION_COOKIE, secure: opts.cookieSecure })
    return c.json({ id: user.id, email: user.email })
  })

  r.post('/logout', async c => {
    const sid = c.get('sid')
    if (sid) await deleteSession(opts.db.db, sid)
    deleteCookie(c, COOKIE_NAME, { path: '/' })
    return c.body(null, 204)
  })

  return r
}

export function meRoute() {
  const r = new Hono<AppEnv>()
  r.get('/', c => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'unauthorized' }, 401)
    return c.json(user)
  })
  return r
}
