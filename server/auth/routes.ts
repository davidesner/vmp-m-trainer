import { Hono, type Context } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { AppEnv } from '../types.js'
import type { Db } from '../db/client.js'
import { attempts, oauthIdentities, sessions, testHistory, users } from '../db/schema.js'
import { hashPassword, verifyPassword } from './password.js'
import { createSession, deleteSession } from './sessions.js'
import { COOKIE_NAME, requireRegistered } from './middleware.js'
import { checkRateLimit } from './rateLimit.js'
import { OAUTH_PROVIDERS, oauthRoutes, type OAuthCredentials } from './oauth.js'
import { findOrCreateUserForIdentity } from './identities.js'
import type { Captcha } from './captcha.js'

export interface AuthRoutesOptions {
  db: Db
  cookieSecure: boolean
  /** Captcha every self-registration must pass. Undefined disables signup. */
  captcha?: Captcha
  /** Google/Seznam client credentials; providers without them stay disabled. */
  oauth?: OAuthCredentials
  /** Public origin for OAuth redirect URIs (APP_URL); defaults to the request origin. */
  appUrl?: string
  /** Injectable for tests (OAuth token and profile requests). */
  fetch?: typeof fetch
}

const SESSION_COOKIE = {
  httpOnly: true,
  sameSite: 'Lax',
  path: '/',
  maxAge: 30 * 86400,
} as const

// Guests are cheap to create and often share an IP (school, office NAT).
const GUEST_RATE_MAX = 20

export function authRoutes(opts: AuthRoutesOptions) {
  const r = new Hono<AppEnv>()
  const { captcha } = opts

  /** A guest signing in or registering leaves its session behind; its row stays as usage history. */
  async function dropGuestSession(c: Context<AppEnv>) {
    const sid = c.get('sid')
    if (sid && c.get('user')?.guest) await deleteSession(opts.db.db, sid)
  }

  async function signInAs(c: Context<AppEnv>, userId: string) {
    await dropGuestSession(c)
    const sid = await createSession(opts.db.db, userId)
    setCookie(c, COOKIE_NAME, sid, { ...SESSION_COOKIE, secure: opts.cookieSecure })
  }

  const oauth = opts.oauth ?? {}
  const sso = Object.fromEntries(OAUTH_PROVIDERS.map(p => [p, Boolean(oauth[p])]))

  // Lets the SPA decide whether to show the "create account" link, which captcha site key to render
  // and which SSO buttons work.
  r.get('/config', c => c.json({
    signupEnabled: Boolean(captcha), captchaSiteKey: captcha?.siteKey ?? null, sso,
  }))

  r.route('/oauth', oauthRoutes({
    credentials: oauth,
    cookieSecure: opts.cookieSecure,
    appUrl: opts.appUrl,
    fetch: opts.fetch,
    signIn: async (c, profile) => signInAs(c, await findOrCreateUserForIdentity(opts.db.db, profile)),
  }))

  r.post('/register', async c => {
    const forwardedIp = c.req.header('x-forwarded-for')?.split(',')[0].trim()
    const rl = checkRateLimit(`register:${forwardedIp ?? 'unknown'}`)
    if (!rl.allowed) {
      return c.json({ error: 'too many attempts' }, 429, { 'retry-after': String(rl.retryAfterSec) })
    }
    if (!captcha) return c.json({ error: 'registration disabled' }, 403)

    const body = await c.req.json().catch(() => null) as
      { email?: string; password?: string; captchaToken?: string } | null
    const email = body?.email?.trim().toLowerCase()
    const password = body?.password
    const captchaToken = body?.captchaToken
    if (!email || !password || typeof captchaToken !== 'string' || !captchaToken) {
      return c.json({ error: 'bad request' }, 400)
    }
    if (!email.includes('@')) return c.json({ error: 'invalid email' }, 400)
    if (password.length < 8) return c.json({ error: 'password too short' }, 400)

    // After the cheap checks, before touching the DB, so the 409 below can't be probed without solving a captcha.
    const verdict = await captcha.verify(captchaToken, forwardedIp)
    if (verdict === 'unavailable') return c.json({ error: 'captcha unavailable' }, 503)
    if (verdict !== 'ok') return c.json({ error: 'captcha failed' }, 403)

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

    await signInAs(c, id)
    return c.json({ id, email, guest: false, hasPassword: true }, 201)
  })

  r.post('/guest', async c => {
    const current = c.get('user')
    if (current) return c.json(current, 200)

    const forwardedIp = c.req.header('x-forwarded-for')?.split(',')[0].trim()
    const rl = checkRateLimit(`guest:${forwardedIp ?? 'unknown'}`, Date.now(), GUEST_RATE_MAX)
    if (!rl.allowed) {
      return c.json({ error: 'too many attempts' }, 429, { 'retry-after': String(rl.retryAfterSec) })
    }

    // Each guest is a DB row and a session, so creating one takes the same captcha as registering.
    // Without a configured captcha (local dev) guests stay open.
    if (captcha) {
      const body = await c.req.json().catch(() => null) as { captchaToken?: string } | null
      const captchaToken = body?.captchaToken
      if (typeof captchaToken !== 'string' || !captchaToken) return c.json({ error: 'bad request' }, 400)
      const verdict = await captcha.verify(captchaToken, forwardedIp)
      if (verdict === 'unavailable') return c.json({ error: 'captcha unavailable' }, 503)
      if (verdict !== 'ok') return c.json({ error: 'captcha failed' }, 403)
    }

    const id = randomUUID()
    await opts.db.db.insert(users).values({
      id,
      email: `guest:${id}`,
      passwordHash: '',
      isGuest: true,
      createdAt: new Date().toISOString(),
    })
    const sid = await createSession(opts.db.db, id)
    setCookie(c, COOKIE_NAME, sid, { ...SESSION_COOKIE, secure: opts.cookieSecure })
    return c.json({ id, email: null, guest: true, hasPassword: false }, 201)
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
    if (!user || user.isGuest) return c.json({ error: 'invalid credentials' }, 401)
    // SSO-only accounts have an empty hash, which verifyPassword never accepts.
    if (!(await verifyPassword(user.passwordHash, body.password))) {
      return c.json({ error: 'invalid credentials' }, 401)
    }

    await signInAs(c, user.id)
    return c.json({ id: user.id, email: user.email, guest: false, hasPassword: true })
  })

  r.post('/logout', async c => {
    const sid = c.get('sid')
    if (sid) await deleteSession(opts.db.db, sid)
    deleteCookie(c, COOKIE_NAME, { path: '/' })
    return c.body(null, 204)
  })

  return r
}

/** What an account without a password types to confirm its deletion. */
export const DELETE_CONFIRM_WORD = 'SMAZAT'

export function meRoute(opts: { db: Db }) {
  const r = new Hono<AppEnv>()
  r.get('/', c => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'unauthorized' }, 401)
    return c.json(user)
  })

  // Self-service erasure. Password accounts re-enter the password, SSO-only accounts type DELETE_CONFIRM_WORD.
  r.delete('/', requireRegistered(), async c => {
    const user = c.get('user')!
    const rl = checkRateLimit(`delete-account:${user.id}`)
    if (!rl.allowed) {
      return c.json({ error: 'too many attempts' }, 429, { 'retry-after': String(rl.retryAfterSec) })
    }
    const body = await c.req.json().catch(() => null) as { password?: unknown; confirm?: unknown } | null

    const row = await opts.db.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
    if (!row[0]) return c.json({ error: 'unauthorized' }, 401)
    const { passwordHash } = row[0]
    if (passwordHash) {
      if (typeof body?.password !== 'string' || !(await verifyPassword(passwordHash, body.password))) {
        return c.json({ error: 'invalid password' }, 403)
      }
    } else if (typeof body?.confirm !== 'string' || body.confirm.trim().toUpperCase() !== DELETE_CONFIRM_WORD) {
      return c.json({ error: 'invalid confirmation' }, 403)
    }

    // Children first and in one atomic batch, so nothing depends on SQLite enforcing ON DELETE CASCADE.
    const { db } = opts.db
    await db.batch([
      db.delete(sessions).where(eq(sessions.userId, user.id)),
      db.delete(attempts).where(eq(attempts.userId, user.id)),
      db.delete(testHistory).where(eq(testHistory.userId, user.id)),
      db.delete(oauthIdentities).where(eq(oauthIdentities.userId, user.id)),
      db.delete(users).where(eq(users.id, user.id)),
    ])
    deleteCookie(c, COOKIE_NAME, { path: '/' })
    return c.body(null, 204)
  })
  return r
}
