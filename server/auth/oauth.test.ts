import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createDb } from '../db/client.js'
import { oauthIdentities, sessions, users } from '../db/schema.js'
import { buildApp } from '../index.js'
import { hashPassword } from './password.js'
import { _resetRateLimit } from './rateLimit.js'

type App = ReturnType<typeof buildApp>['app']

const CREDS = {
  google: { clientId: 'g-client', clientSecret: 'g-secret' },
  seznam: { clientId: 's-client', clientSecret: 's-secret' },
}

interface ProviderAccount { status?: number; tokenStatus?: number; body: Record<string, unknown> }

/** Fake provider endpoints: records every request and answers with the given account. */
function mockProviders(initial: ProviderAccount) {
  let account = initial
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    if (url === 'https://oauth2.googleapis.com/token' || url === 'https://login.szn.cz/api/v1/oauth/token') {
      if (account.tokenStatus) return new Response('{"error":"invalid_grant"}', { status: account.tokenStatus })
      return Response.json({ access_token: 'at-123', token_type: 'bearer', expires_in: 3600 })
    }
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo' || url === 'https://login.szn.cz/api/v1/user') {
      return Response.json(account.body, { status: account.status ?? 200 })
    }
    return new Response('unexpected', { status: 500 })
  })
  return {
    fetchMock: fetchMock as unknown as typeof fetch,
    calls,
    setAccount: (next: ProviderAccount) => { account = next },
  }
}

async function setup(account: ProviderAccount, oauth: typeof CREDS | object = CREDS) {
  const db = createDb(':memory:')
  await db.applyMigrations()
  await db.db.insert(users).values({
    id: 'pw-user',
    email: 'anna@example.com',
    passwordHash: await hashPassword('hunter22'),
    createdAt: new Date().toISOString(),
  })
  const mock = mockProviders(account)
  const { app } = buildApp({
    db, cookieSecure: false, oauth, appUrl: 'https://vmp.test', fetch: mock.fetchMock,
  })
  return { db, app, ...mock }
}

function cookieValue(res: Response, name: string): string | undefined {
  const all = res.headers.getSetCookie()
  const hit = all.find(c => c.startsWith(`${name}=`))
  return hit?.split(';')[0].slice(name.length + 1)
}

/** Runs start -> callback the way a browser would, returning the callback response. */
async function signInVia(app: App, provider: 'google' | 'seznam', extraCookie = '') {
  const start = await app.request(`/api/auth/oauth/${provider}`)
  expect(start.status).toBe(302)
  const location = new URL(start.headers.get('location')!)
  const state = location.searchParams.get('state')!
  const flow = cookieValue(start, 'oauth_flow')!
  const cookie = [`oauth_flow=${flow}`, extraCookie].filter(Boolean).join('; ')
  const res = await app.request(`/api/auth/oauth/${provider}/callback?code=the-code&state=${state}`, { headers: { cookie } })
  return { res, start, location, flow }
}

async function me(app: App, res: Response) {
  const sid = cookieValue(res, 'sid')
  expect(sid).toMatch(/^[a-f0-9]{64}$/)
  return (await app.request('/api/me', { headers: { cookie: `sid=${sid}` } })).json()
}

const GOOGLE_NEW = { body: { sub: 'g-111', email: 'Nova@Gmail.com', email_verified: true } }

describe('OAuth start', () => {
  it('reports configured providers in /api/auth/config', async () => {
    const { app } = await setup(GOOGLE_NEW, { google: CREDS.google })
    expect(await (await app.request('/api/auth/config')).json())
      .toEqual({ signupEnabled: false, captchaSiteKey: null, sso: { google: true, seznam: false } })
  })

  it('redirects to Google with state and an S256 PKCE challenge', async () => {
    const { app } = await setup(GOOGLE_NEW)
    const { start, location, flow } = await signInVia(app, 'google')
    expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(location.searchParams.get('client_id')).toBe('g-client')
    expect(location.searchParams.get('redirect_uri')).toBe('https://vmp.test/api/auth/oauth/google/callback')
    expect(location.searchParams.get('response_type')).toBe('code')
    expect(location.searchParams.get('code_challenge_method')).toBe('S256')

    const [provider, state, verifier] = flow.split('.')
    expect(provider).toBe('google')
    expect(location.searchParams.get('state')).toBe(state)
    expect(location.searchParams.get('code_challenge'))
      .toBe(createHash('sha256').update(verifier).digest('base64url'))
    const setCookie = start.headers.getSetCookie().find(c => c.startsWith('oauth_flow='))!
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/Path=\/api\/auth\/oauth/)
  })

  it('redirects to Seznam with the identity scope', async () => {
    const { app } = await setup(GOOGLE_NEW)
    const { location } = await signInVia(app, 'seznam')
    expect(location.origin + location.pathname).toBe('https://login.szn.cz/api/v1/oauth/auth')
    expect(location.searchParams.get('scope')).toBe('identity')
    expect(location.searchParams.get('client_id')).toBe('s-client')
  })

  it('sends an unconfigured provider back to /login', async () => {
    const { app } = await setup(GOOGLE_NEW, {})
    const res = await app.request('/api/auth/oauth/google')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/login?error=unavailable')
  })

  it('404s an unknown provider', async () => {
    const { app } = await setup(GOOGLE_NEW)
    expect((await app.request('/api/auth/oauth/facebook')).status).toBe(404)
  })
})

describe('OAuth callback', () => {
  beforeEach(() => _resetRateLimit())

  it('creates a password-less account on first Google sign-in and lands on /app', async () => {
    const { app, db, calls } = await setup(GOOGLE_NEW)
    const { res, flow } = await signInVia(app, 'google')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/app')
    const sidCookie = res.headers.getSetCookie().find(c => c.startsWith('sid='))!
    expect(sidCookie).toMatch(/HttpOnly/i)
    expect(sidCookie).toMatch(/SameSite=Lax/i)
    expect(sidCookie).toMatch(/Max-Age=2592000/)
    expect(await me(app, res)).toMatchObject({ email: 'nova@gmail.com', guest: false })

    // Token exchange carries the code, redirect URI and the PKCE verifier from the flow cookie.
    const token = new URLSearchParams(String(calls[0].init?.body))
    expect(token.get('code')).toBe('the-code')
    expect(token.get('code_verifier')).toBe(flow.split('.')[2])
    expect(token.get('redirect_uri')).toBe('https://vmp.test/api/auth/oauth/google/callback')
    expect(token.get('client_secret')).toBe('g-secret')
    expect((calls[1].init?.headers as Record<string, string>).authorization).toBe('Bearer at-123')

    const [user] = await db.db.select().from(users).where(eq(users.email, 'nova@gmail.com'))
    expect(user.passwordHash).toBe('')
    const ids = await db.db.select().from(oauthIdentities)
    expect(ids).toEqual([expect.objectContaining({ provider: 'google', providerUserId: 'g-111', userId: user.id })])
  })

  it('matches a returning user by provider id even when the email changed', async () => {
    const { app, db, setAccount } = await setup(GOOGLE_NEW)
    const first = await me(app, (await signInVia(app, 'google')).res)

    setAccount({ body: { sub: 'g-111', email: 'renamed@gmail.com', email_verified: true } })
    const second = await me(app, (await signInVia(app, 'google')).res)
    expect(second.id).toBe(first.id)
    expect(await db.db.select().from(users)).toHaveLength(2)  // pw-user + the Google user, no duplicate
  })

  it('links a verified Google email to the existing password account', async () => {
    const { app, db } = await setup({ body: { sub: 'g-222', email: 'ANNA@example.com', email_verified: true } })
    const { res } = await signInVia(app, 'google')
    expect(await me(app, res)).toEqual({ id: 'pw-user', email: 'anna@example.com', guest: false })
    expect(await db.db.select().from(users)).toHaveLength(1)
    expect(await db.db.select().from(oauthIdentities)).toEqual([
      expect.objectContaining({ provider: 'google', providerUserId: 'g-222', userId: 'pw-user' }),
    ])
    // The password keeps working after linking.
    const login = await app.request('/api/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'anna@example.com', password: 'hunter22' }),
    })
    expect(login.status).toBe(200)
  })

  it('does not link an unverified email; the new account gets no email at all', async () => {
    const { app, db } = await setup({ body: { sub: 'g-333', email: 'anna@example.com', email_verified: false } })
    const { res } = await signInVia(app, 'google')
    const user = await me(app, res)
    expect(user.id).not.toBe('pw-user')
    expect(user).toMatchObject({ email: null, guest: false })
    const [row] = await db.db.select().from(users).where(eq(users.id, user.id))
    expect(row.email).toBe('google:g-333')
  })

  it('links a Seznam mailbox address (trusted) to an existing account', async () => {
    const { app, db, calls } = await setup({ body: { oauth_user_id: 'sz-1', email: 'Pepa@Seznam.cz' } })
    await db.db.insert(users).values({
      id: 'sz-pw', email: 'pepa@seznam.cz', passwordHash: await hashPassword('hunter22'), createdAt: new Date().toISOString(),
    })
    const { res, flow } = await signInVia(app, 'seznam')
    expect(await me(app, res)).toMatchObject({ id: 'sz-pw', email: 'pepa@seznam.cz' })

    // Seznam's token endpoint takes a JSON body.
    const body = JSON.parse(String(calls[0].init?.body))
    expect(body).toMatchObject({ grant_type: 'authorization_code', code: 'the-code', code_verifier: flow.split('.')[2] })
    expect((calls[1].init?.headers as Record<string, string>).authorization).toBe('bearer at-123')
  })

  it('does not trust an external email from Seznam for linking', async () => {
    const { app } = await setup({ body: { oauth_user_id: 42, email: 'anna@example.com' } })
    const user = await me(app, (await signInVia(app, 'seznam')).res)
    expect(user.id).not.toBe('pw-user')
    expect(user.email).toBeNull()
  })

  it('handles a Seznam account without an email', async () => {
    const { app, db } = await setup({ body: { oauth_user_id: 'sz-9', email: null } })
    const user = await me(app, (await signInVia(app, 'seznam')).res)
    expect(user).toMatchObject({ email: null, guest: false })
    const [row] = await db.db.select().from(users).where(eq(users.id, user.id))
    expect(row.email).toBe('seznam:sz-9')
  })

  it('rejects a mismatched state without calling the provider', async () => {
    const { app, calls } = await setup(GOOGLE_NEW)
    const start = await app.request('/api/auth/oauth/google')
    const flow = cookieValue(start, 'oauth_flow')!
    const res = await app.request('/api/auth/oauth/google/callback?code=c&state=forged', {
      headers: { cookie: `oauth_flow=${flow}` },
    })
    expect(res.headers.get('location')).toBe('/login?error=state')
    expect(cookieValue(res, 'sid')).toBeUndefined()
    expect(calls).toHaveLength(0)
  })

  it('rejects a callback without the flow cookie', async () => {
    const { app, calls } = await setup(GOOGLE_NEW)
    const res = await app.request('/api/auth/oauth/google/callback?code=c&state=s')
    expect(res.headers.get('location')).toBe('/login?error=state')
    expect(calls).toHaveLength(0)
  })

  it('rejects a flow cookie started for the other provider', async () => {
    const { app } = await setup(GOOGLE_NEW)
    const start = await app.request('/api/auth/oauth/seznam')
    const state = new URL(start.headers.get('location')!).searchParams.get('state')
    const res = await app.request(`/api/auth/oauth/google/callback?code=c&state=${state}`, {
      headers: { cookie: `oauth_flow=${cookieValue(start, 'oauth_flow')}` },
    })
    expect(res.headers.get('location')).toBe('/login?error=state')
  })

  it('reports a cancelled consent screen', async () => {
    const { app, calls } = await setup(GOOGLE_NEW)
    const start = await app.request('/api/auth/oauth/google')
    const state = new URL(start.headers.get('location')!).searchParams.get('state')
    const res = await app.request(`/api/auth/oauth/google/callback?error=access_denied&state=${state}`, {
      headers: { cookie: `oauth_flow=${cookieValue(start, 'oauth_flow')}` },
    })
    expect(res.headers.get('location')).toBe('/login?error=cancelled')
    expect(calls).toHaveLength(0)
  })

  it('reports a failed token exchange', async () => {
    const { app, db } = await setup({ tokenStatus: 400, body: {} })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res } = await signInVia(app, 'google')
    expect(res.headers.get('location')).toBe('/login?error=provider')
    expect(cookieValue(res, 'sid')).toBeUndefined()
    expect(await db.db.select().from(oauthIdentities)).toHaveLength(0)
  })

  it('reports a profile without a stable id', async () => {
    const { app } = await setup({ body: { email: 'x@gmail.com', email_verified: true } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { res } = await signInVia(app, 'google')
    expect(res.headers.get('location')).toBe('/login?error=provider')
  })

  it('clears the flow cookie so a callback cannot be replayed', async () => {
    const { app } = await setup(GOOGLE_NEW)
    const { res } = await signInVia(app, 'google')
    expect(res.headers.getSetCookie().find(c => c.startsWith('oauth_flow='))).toMatch(/Max-Age=0/i)
  })

  it('replaces a guest session when the guest signs in with Google', async () => {
    const { app, db } = await setup(GOOGLE_NEW)
    const guest = await app.request('/api/auth/guest', { method: 'POST' })
    const guestSid = cookieValue(guest, 'sid')!
    const { res } = await signInVia(app, 'google', `sid=${guestSid}`)
    expect(await me(app, res)).toMatchObject({ email: 'nova@gmail.com', guest: false })
    expect(await db.db.select().from(sessions).where(eq(sessions.id, guestSid))).toHaveLength(0)
  })
})

describe('password login against SSO-only accounts', () => {
  beforeEach(() => _resetRateLimit())

  it('never accepts a password for an account created via SSO', async () => {
    const { app } = await setup(GOOGLE_NEW)
    await signInVia(app, 'google')
    for (const password of ['', 'x', 'hunter22']) {
      const res = await app.request('/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'nova@gmail.com', password }),
      })
      // '' is rejected as a bad request before the lookup; anything else fails verification.
      expect([400, 401]).toContain(res.status)
      expect(cookieValue(res, 'sid')).toBeUndefined()
    }
  })
})
