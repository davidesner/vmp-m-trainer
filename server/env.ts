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
