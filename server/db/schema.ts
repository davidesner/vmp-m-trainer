import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),                       // crypto.randomUUID()
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),    // '' for guests and SSO-only accounts
  isGuest: integer('is_guest', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),           // ISO 8601
})

/** Google/Seznam accounts linked to a user, matched by the provider's stable id (not by email). */
export const oauthIdentities = sqliteTable(
  'oauth_identities',
  {
    provider: text('provider', { enum: ['google', 'seznam'] }).notNull(),
    providerUserId: text('provider_user_id').notNull(),  // Google `sub`, Seznam `oauth_user_id`
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    email: text('email'),                            // as reported by the provider at link time; informational
    createdAt: text('created_at').notNull(),         // ISO 8601
  },
  t => ({
    pk: primaryKey({ columns: [t.provider, t.providerUserId] }),
    userIdIdx: index('oauth_identities_user_id_idx').on(t.userId),
  }),
)

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),                     // random hex token, cookie value
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: text('expires_at').notNull(),         // ISO 8601
  },
  t => ({
    userIdIdx: index('sessions_user_id_idx').on(t.userId),
  }),
)

export const attempts = sqliteTable(
  'attempts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    testId: text('test_id').notNull().default('M'),  // 'M' | 'C' | ...
    questionId: integer('question_id').notNull(),
    correct: integer('correct', { mode: 'boolean' }).notNull(),
    mode: text('mode', { enum: ['test', 'practice'] }).notNull(),
    at: text('at').notNull(),                        // ISO 8601
  },
  t => ({
    userIdIdx: index('attempts_user_id_idx').on(t.userId),
    userTestIdx: index('attempts_user_test_idx').on(t.userId, t.testId),
  }),
)

export const testHistory = sqliteTable(
  'test_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    testId: text('test_id').notNull().default('M'),  // 'M' | 'C' | ...
    at: text('at').notNull(),
    score: integer('score').notNull(),
    total: integer('total').notNull(),
    durationSec: integer('duration_sec').notNull(),
    perGroup: text('per_group').notNull(),           // JSON string: Record<GroupId, {correct, total}>
    questionIds: text('question_ids').notNull(),     // JSON string: number[]
  },
  t => ({
    userIdAtIdx: index('test_history_user_id_at_idx').on(t.userId, t.at),
    userTestIdx: index('test_history_user_test_idx').on(t.userId, t.testId),
  }),
)
