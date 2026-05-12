import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import type { AppEnv } from '../types'
import type { Db } from '../db/client'
import { lookupSession, maybeExtendSession } from './sessions'

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
        c.set('user', { id: row.user.id, email: row.user.email })
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
