import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import type { AppEnv } from '../types'
import type { Db } from '../db/client'
import { users } from '../db/schema'
import { verifyPassword } from './password'
import { createSession, deleteSession } from './sessions'
import { COOKIE_NAME } from './middleware'
import { checkRateLimit } from './rateLimit'

export interface AuthRoutesOptions {
  db: Db
  cookieSecure: boolean
}

export function authRoutes(opts: AuthRoutesOptions) {
  const r = new Hono<AppEnv>()

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
    setCookie(c, COOKIE_NAME, sid, {
      httpOnly: true,
      secure: opts.cookieSecure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 30 * 86400,
    })
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
