import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { AppEnv } from '../types.js'
import type { Db } from '../db/client.js'
import { lookupSession, maybeExtendSession } from './sessions.js'

export const COOKIE_NAME = 'sid'

/**
 * Loads user onto context if a valid session cookie is present.
 * Never rejects requests — that's the requireAuth middleware's job.
 */
export function loadUser(db: Db): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const sid = getCookie(c, COOKIE_NAME)
    if (sid) {
      const row = await lookupSession(db.db, sid)
      if (row) {
        const guest = row.user.isGuest
        // Guests and SSO accounts without a trusted email store a placeholder without '@'.
        const email = guest || !row.user.email.includes('@') ? null : row.user.email
        c.set('user', { id: row.user.id, email, guest })
        c.set('sid', sid)
        await maybeExtendSession(db.db, sid, new Date(row.session.expiresAt))
      }
    }
    await next()
  }
}

export function requireAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!c.get('user')) return c.json({ error: 'unauthorized' }, 401)
    await next()
  }
}

/** Like requireAuth, but guests are refused: stored data is only shown to account holders. */
export function requireRegistered(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'unauthorized' }, 401)
    if (user.guest) return c.json({ error: 'account required' }, 403)
    await next()
  }
}
