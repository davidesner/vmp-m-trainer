import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import type { Db } from '../db/client.js'
import { oauthIdentities, users } from '../db/schema.js'
import type { ProviderProfile } from './oauth.js'

/**
 * Resolves a provider account to a local user id, creating the user on first sign-in:
 *
 * 1. A known (provider, provider user id) wins, whatever the email says today.
 * 2. Otherwise a verified email that matches an existing (non-guest) account links to it.
 * 3. Otherwise a new password-less user is created. An unverified email is not stored as the
 *    account email, so it can never be used to link someone else's provider account to it later.
 */
export async function findOrCreateUserForIdentity(db: Db['db'], profile: ProviderProfile): Promise<string> {
  const known = await db
    .select({ userId: oauthIdentities.userId })
    .from(oauthIdentities)
    .where(and(eq(oauthIdentities.provider, profile.provider), eq(oauthIdentities.providerUserId, profile.id)))
    .limit(1)
  if (known[0]) return known[0].userId

  const now = new Date().toISOString()
  const trustedEmail = profile.emailVerified ? profile.email : null

  let userId: string | undefined
  if (trustedEmail) {
    const existing = await db
      .select({ id: users.id, isGuest: users.isGuest })
      .from(users)
      .where(eq(users.email, trustedEmail))
      .limit(1)
    if (existing[0] && !existing[0].isGuest) userId = existing[0].id
  }

  if (!userId) {
    userId = randomUUID()
    await db.insert(users).values({
      id: userId,
      // Accounts without a trusted email get a placeholder (no '@'), like guests; /api/me reports null.
      email: trustedEmail ?? `${profile.provider}:${profile.id}`,
      passwordHash: '',
      createdAt: now,
    })
  }

  await db.insert(oauthIdentities).values({
    provider: profile.provider,
    providerUserId: profile.id,
    userId,
    email: profile.email,
    createdAt: now,
  })
  return userId
}
