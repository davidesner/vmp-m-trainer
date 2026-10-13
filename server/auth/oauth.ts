import { Hono, type Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { AppEnv } from '../types.js'

/**
 * "Pokračovat přes Google/Seznam": OAuth 2.0 authorization code flow with `state` and PKCE (S256).
 *
 *   GET /oauth/:provider           -> 302 to the provider, remembers state + verifier in a short-lived cookie
 *   GET /oauth/:provider/callback  -> exchanges the code, fetches the profile, signs in, 302 to /app
 *
 * Failures redirect to /login?error=<OAuthErrorCode>; the SPA turns the code into a Czech message.
 */

export const OAUTH_PROVIDERS = ['google', 'seznam'] as const
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]

export interface ProviderCredentials { clientId: string; clientSecret: string }
export type OAuthCredentials = Partial<Record<OAuthProvider, ProviderCredentials>>

export type OAuthErrorCode = 'cancelled' | 'state' | 'provider' | 'unavailable'

export class OAuthError extends Error {
  constructor(readonly code: OAuthErrorCode, detail: string) {
    super(detail)
  }
}

/** What we need from a provider account: a stable id and, if known, an email we can trust. */
export interface ProviderProfile {
  provider: OAuthProvider
  id: string
  email: string | null
  /** Only a verified email may be used to link to an existing account. */
  emailVerified: boolean
}

type Fetch = typeof fetch

interface ProviderDef {
  authUrl: string
  scope: string
  extraAuthParams?: Record<string, string>
  exchangeCode(args: {
    code: string; redirectUri: string; verifier: string; creds: ProviderCredentials; fetch: Fetch
  }): Promise<string>
  profile(accessToken: string, fetch: Fetch): Promise<ProviderProfile>
}

async function readJson(res: Response, what: string): Promise<Record<string, unknown>> {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new OAuthError('provider', `${what} failed: HTTP ${res.status} ${body.slice(0, 200)}`)
  }
  const json = await res.json().catch(() => null)
  if (!json || typeof json !== 'object') throw new OAuthError('provider', `${what}: response is not JSON`)
  return json as Record<string, unknown>
}

function accessTokenOf(json: Record<string, unknown>): string {
  if (typeof json.access_token !== 'string' || !json.access_token) {
    throw new OAuthError('provider', 'token response has no access_token')
  }
  return json.access_token
}

/**
 * Seznam's user endpoint has no "email verified" flag. Addresses on Seznam's own mail domains are the
 * account's mailbox, so they are trusted; anything else (an external address typed at signup) is not.
 */
const SEZNAM_MAIL_DOMAINS = new Set(['seznam.cz', 'email.cz', 'post.cz', 'spoluzaci.cz', 'stream.cz', 'firmy.cz'])

const PROVIDERS: Record<OAuthProvider, ProviderDef> = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email',
    extraAuthParams: { prompt: 'select_account' },
    async exchangeCode({ code, redirectUri, verifier, creds, fetch }) {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          code_verifier: verifier,
        }),
      })
      return accessTokenOf(await readJson(res, 'Google token exchange'))
    },
    async profile(accessToken, fetch) {
      const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      })
      const json = await readJson(res, 'Google userinfo')
      if (typeof json.sub !== 'string' || !json.sub) throw new OAuthError('provider', 'Google userinfo has no sub')
      const email = typeof json.email === 'string' ? json.email.trim().toLowerCase() : null
      return { provider: 'google', id: json.sub, email, emailVerified: Boolean(email) && json.email_verified === true }
    },
  },
  seznam: {
    authUrl: 'https://login.szn.cz/api/v1/oauth/auth',
    scope: 'identity',
    async exchangeCode({ code, redirectUri, verifier, creds, fetch }) {
      const res = await fetch('https://login.szn.cz/api/v1/oauth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          code_verifier: verifier,
        }),
      })
      return accessTokenOf(await readJson(res, 'Seznam token exchange'))
    },
    async profile(accessToken, fetch) {
      const res = await fetch('https://login.szn.cz/api/v1/user', {
        headers: { authorization: `bearer ${accessToken}`, accept: 'application/json' },
      })
      const json = await readJson(res, 'Seznam user')
      const rawId = json.oauth_user_id
      if ((typeof rawId !== 'string' && typeof rawId !== 'number') || rawId === '') {
        throw new OAuthError('provider', 'Seznam user has no oauth_user_id')
      }
      const email = typeof json.email === 'string' && json.email ? json.email.trim().toLowerCase() : null
      const domain = email?.split('@')[1]
      return { provider: 'seznam', id: String(rawId), email, emailVerified: Boolean(domain && SEZNAM_MAIL_DOMAINS.has(domain)) }
    },
  },
}

const FLOW_COOKIE = 'oauth_flow'
const FLOW_COOKIE_PATH = '/api/auth/oauth'
const FLOW_TTL_SEC = 10 * 60

function base64url(buf: Buffer): string {
  return buf.toString('base64url')
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

function isProvider(p: string): p is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(p)
}

export interface OAuthRoutesOptions {
  credentials: OAuthCredentials
  cookieSecure: boolean
  /** Public origin for redirect URIs; defaults to the request's origin. */
  appUrl?: string
  /** Injectable for tests. */
  fetch?: Fetch
  /** Finds or creates the local user for a provider account and starts its session. */
  signIn: (c: Context<AppEnv>, profile: ProviderProfile) => Promise<void>
}

export function oauthRoutes(opts: OAuthRoutesOptions) {
  const r = new Hono<AppEnv>()
  const doFetch: Fetch = opts.fetch ?? fetch

  function redirectUri(c: Context<AppEnv>, provider: OAuthProvider): string {
    const origin = opts.appUrl ?? new URL(c.req.url).origin
    return `${origin}/api/auth/oauth/${provider}/callback`
  }

  function fail(c: Context<AppEnv>, code: OAuthErrorCode) {
    return c.redirect(`/login?error=${code}`, 302)
  }

  r.get('/:provider', c => {
    const provider = c.req.param('provider')
    if (!isProvider(provider)) return c.notFound()
    const creds = opts.credentials[provider]
    if (!creds) return fail(c, 'unavailable')

    const state = base64url(randomBytes(24))
    const verifier = base64url(randomBytes(32))
    const challenge = base64url(createHash('sha256').update(verifier).digest())
    setCookie(c, FLOW_COOKIE, `${provider}.${state}.${verifier}`, {
      httpOnly: true,
      // Lax still sends the cookie on the provider's top-level GET redirect back to us.
      sameSite: 'Lax',
      secure: opts.cookieSecure,
      path: FLOW_COOKIE_PATH,
      maxAge: FLOW_TTL_SEC,
    })

    const def = PROVIDERS[provider]
    const url = new URL(def.authUrl)
    const params: Record<string, string> = {
      client_id: creds.clientId,
      redirect_uri: redirectUri(c, provider),
      response_type: 'code',
      scope: def.scope,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      ...def.extraAuthParams,
    }
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    return c.redirect(url.toString(), 302)
  })

  r.get('/:provider/callback', async c => {
    const provider = c.req.param('provider')
    if (!isProvider(provider)) return c.notFound()

    // The flow cookie is single-use, whatever happens next.
    const flow = getCookie(c, FLOW_COOKIE)
    deleteCookie(c, FLOW_COOKIE, { path: FLOW_COOKIE_PATH })

    const creds = opts.credentials[provider]
    if (!creds) return fail(c, 'unavailable')

    const [flowProvider, flowState, verifier] = flow?.split('.') ?? []
    const state = c.req.query('state')
    if (!flowState || !verifier || flowProvider !== provider || !state || !sameString(state, flowState)) {
      return fail(c, 'state')
    }

    const providerError = c.req.query('error')
    if (providerError) {
      return fail(c, providerError === 'access_denied' ? 'cancelled' : 'provider')
    }
    const code = c.req.query('code')
    if (!code) return fail(c, 'provider')

    try {
      const def = PROVIDERS[provider]
      const accessToken = await def.exchangeCode({
        code, redirectUri: redirectUri(c, provider), verifier, creds, fetch: doFetch,
      })
      const profile = await def.profile(accessToken, doFetch)
      await opts.signIn(c, profile)
    } catch (err) {
      console.error(`[oauth:${provider}]`, err instanceof Error ? err.message : err)
      return fail(c, err instanceof OAuthError ? err.code : 'provider')
    }
    return c.redirect('/app', 302)
  })

  return r
}
