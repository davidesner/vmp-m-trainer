import { OAUTH_PROVIDERS, type OAuthCredentials } from './auth/oauth.js'

/**
 * Reads libSQL connection settings from env, accepting either the explicit
 * DATABASE_URL/DATABASE_AUTH_TOKEN names or the TURSO_* names that the
 * Vercel-Turso integration injects automatically.
 */
export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL ?? process.env.TURSO_DATABASE_URL
}

export function getDatabaseAuthToken(): string | undefined {
  return process.env.DATABASE_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN
}

/**
 * Shared invite code that gates self-registration via POST /api/auth/register.
 * When unset (or empty), signup is disabled and users must be created via the
 * `pnpm user:add` CLI. Whitespace is trimmed so a stray newline can't break it.
 */
export function getSignupCode(): string | undefined {
  return process.env.SIGNUP_CODE?.trim() || undefined
}

/**
 * Client credentials for "Pokračovat přes Google/Seznam". A provider is enabled only when both its
 * ID and secret are set; the SPA learns which ones via GET /api/auth/config.
 */
export function getOAuthCredentials(): OAuthCredentials {
  const out: OAuthCredentials = {}
  for (const provider of OAUTH_PROVIDERS) {
    const prefix = provider.toUpperCase()
    const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim()
    const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim()
    if (clientId && clientSecret) out[provider] = { clientId, clientSecret }
  }
  return out
}

/**
 * Public origin of the app (e.g. https://vmp.example.cz), used to build OAuth redirect URIs.
 * When unset, the origin of the incoming request is used, which is fine for local dev and Vercel
 * but can be wrong behind a reverse proxy that rewrites Host or terminates TLS.
 */
export function getAppUrl(): string | undefined {
  return process.env.APP_URL?.trim().replace(/\/+$/, '') || undefined
}
