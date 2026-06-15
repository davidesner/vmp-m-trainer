import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),                       // crypto.randomUUID()
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull(),           // ISO 8601
})

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
