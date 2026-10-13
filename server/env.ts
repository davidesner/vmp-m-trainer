import { turnstile, type Captcha } from './auth/captcha.js'

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
 * Cloudflare Turnstile keys for self-registration via POST /api/auth/register.
 * Both must be set; otherwise signup is disabled and users must be created via
 * the `pnpm user:add` CLI. Whitespace is trimmed so a stray newline can't break them.
 */
export function getCaptcha(): Captcha | undefined {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim()
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim()
  return siteKey && secretKey ? turnstile(siteKey, secretKey) : undefined
}
