# Hosted App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the local-only VMP trainer into a self-hostable web app with per-user accounts and server-persisted progress, deployable to Vercel + Turso (free) or as a single Docker container with a SQLite file.

**Architecture:** Existing Vite SPA stays. Add a Hono `/api/*` server that runs identically as a Node process (Docker) and as a Vercel serverless function. Drizzle ORM + libSQL targets either a local file or Turso via one env var. Auth = hand-rolled session cookies + argon2. Static `explanations/*.html` moves under `public/` and is served as-is.

**Tech Stack:** React 19, Vite, Hono, Drizzle ORM, @libsql/client, @node-rs/argon2, tsx, drizzle-kit.

**Spec:** `docs/superpowers/specs/2026-05-12-hosted-app-design.md`

---

## Conventions used in this plan

- All commands run from repo root.
- Run tests with `pnpm test -- <pattern>` (vitest in run mode). `--` is required to pass args.
- Each task ends in a commit. Use Conventional Commits prefixes (`feat:`, `chore:`, `refactor:`, `test:`).
- TypeScript strict mode is already on — no `any` unless justified inline.
- When a step says "Run X. Expected: Y." — if Y doesn't match, stop and investigate. Don't paper over.

---

## Task 1: Install server dependencies and update scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
pnpm add hono @hono/node-server @libsql/client drizzle-orm @node-rs/argon2
```

- [ ] **Step 2: Install dev deps**

```bash
pnpm add -D drizzle-kit tsx concurrently @types/node
```

- [ ] **Step 3: Add scripts to package.json**

Open `package.json` and replace the `"scripts"` block so it reads exactly:

```json
"scripts": {
  "dev": "concurrently -k -n vite,api -c blue,magenta \"vite\" \"tsx watch server/node.ts\"",
  "dev:vite": "vite",
  "dev:api": "tsx watch server/node.ts",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest",
  "scrape": "node scripts/scrape.mjs",
  "package-skill": "bash scripts/package-skill.sh",
  "batch-explanations": "bash scripts/batch_generate_explanations.sh",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx server/db/migrate.ts",
  "user:add": "tsx server/cli/add-user.ts",
  "start": "tsx server/node.ts"
}
```

- [ ] **Step 4: Verify install**

Run: `pnpm install && pnpm test`
Expected: existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add server deps (hono, drizzle, libsql, argon2)"
```

---

## Task 2: Move explanations into public/ and update generator script

**Files:**
- Move: `explanations/` → `public/explanations/`
- Modify: `vite.config.ts:7-30` (remove the `serveExplanations` middleware — `public/` is served by Vite automatically)
- Modify: `scripts/batch_generate_explanations.sh:39` (`EXPLANATIONS_DIR="public/explanations"`)
- Modify: `scripts/backfill_meta.py` (any references to `explanations/`)
- Modify: `.claude/skills/explain-vmp-question/SKILL.md` if it references the path
- Modify: `README.md` (any references to `explanations/`)

- [ ] **Step 1: Move the directory**

```bash
git mv explanations public/explanations
```

- [ ] **Step 2: Remove the Vite middleware (no longer needed)**

Edit `vite.config.ts`. Delete lines 5-7 (the `path`, `readFileSync`, `existsSync` imports and `explanationsRoot` constant) and the entire `serveExplanations` function (lines 9-27). Remove `serveExplanations()` from the `plugins` array on line 30. After editing, `vite.config.ts` should look like:

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5400,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  preview: {
    port: 5400,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    passWithNoTests: true,
  },
})
```

The proxy is for Task 4; including it now avoids a second edit.

- [ ] **Step 3: Update the generator script**

In `scripts/batch_generate_explanations.sh`, change line 39 from `EXPLANATIONS_DIR="explanations"` to `EXPLANATIONS_DIR="public/explanations"`.

- [ ] **Step 4: Update backfill script**

```bash
grep -n '"explanations"\|/explanations' scripts/backfill_meta.py
```

For any matches, change the path from `explanations` to `public/explanations`.

- [ ] **Step 5: Update README and SKILL.md**

```bash
grep -rn 'explanations/' README.md .claude/skills/ docs/
```

For each match, change `explanations/` → `public/explanations/`. Skip matches inside `docs/superpowers/specs/` and `docs/superpowers/plans/` — those are immutable historical docs.

- [ ] **Step 6: Smoke-test by starting Vite**

Run: `pnpm dev:vite` (in a separate terminal or background)
Browse: http://localhost:5400/explanations/q-1.html
Expected: the existing explanation HTML loads.
Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move explanations under public/ so Vite serves them"
```

---

## Task 3: Drizzle config and schema

**Files:**
- Create: `drizzle.config.ts`
- Create: `server/db/schema.ts`
- Create: `.env.example`
- Modify: `.gitignore` (add `/data/`)

- [ ] **Step 1: Create drizzle config**

Create `drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'sqlite',
  driver: 'libsql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./data/app.db',
  },
})
```

- [ ] **Step 2: Create schema**

Create `server/db/schema.ts`:

```ts
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
    questionId: integer('question_id').notNull(),
    correct: integer('correct', { mode: 'boolean' }).notNull(),
    mode: text('mode', { enum: ['test', 'practice'] }).notNull(),
    at: text('at').notNull(),                        // ISO 8601
  },
  t => ({
    userIdIdx: index('attempts_user_id_idx').on(t.userId),
  }),
)

export const testHistory = sqliteTable(
  'test_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    at: text('at').notNull(),
    score: integer('score').notNull(),
    total: integer('total').notNull(),
    durationSec: integer('duration_sec').notNull(),
    perGroup: text('per_group').notNull(),           // JSON string: Record<GroupId, {correct, total}>
    questionIds: text('question_ids').notNull(),     // JSON string: number[]
  },
  t => ({
    userIdAtIdx: index('test_history_user_id_at_idx').on(t.userId, t.at),
  }),
)
```

- [ ] **Step 3: Generate initial migration**

```bash
pnpm db:generate
```

Expected: creates `server/db/migrations/0000_*.sql` and a `meta/` folder.

- [ ] **Step 4: Create env example**

Create `.env.example`:

```
# libSQL connection. For local dev use a file path; for Turso use libsql://
DATABASE_URL=file:./data/app.db
DATABASE_AUTH_TOKEN=

# 'true' on Vercel / HTTPS; 'false' for plain-http local dev
SESSION_COOKIE_SECURE=false

# Port the Hono server binds to (Docker / local)
PORT=3001
```

- [ ] **Step 5: Update .gitignore**

Append to `.gitignore`:

```
/data/
```

- [ ] **Step 6: Verify migration SQL is sensible**

Run: `cat server/db/migrations/0000_*.sql`
Expected: SQL with `CREATE TABLE users`, `CREATE TABLE sessions`, `CREATE TABLE attempts`, `CREATE TABLE test_history`, and the three indexes.

- [ ] **Step 7: Commit**

```bash
git add drizzle.config.ts server/db/schema.ts server/db/migrations/ .env.example .gitignore
git commit -m "feat(db): add drizzle schema and initial migration"
```

---

## Task 4: DB client and migration runner

**Files:**
- Create: `server/db/client.ts`
- Create: `server/db/migrate.ts`
- Create: `server/db/client.test.ts`

- [ ] **Step 1: Write failing test for `createDb()`**

Create `server/db/client.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createDb } from './client'

describe('createDb', () => {
  it('creates a db client and applies migrations', async () => {
    const { db, client, applyMigrations } = createDb('file::memory:?cache=shared')
    await applyMigrations()
    // After migrations users table should exist; insert a row.
    await client.execute({
      sql: 'INSERT INTO users (id, email, password_hash, created_at) VALUES (?,?,?,?)',
      args: ['u1', 'a@b.c', 'h', new Date().toISOString()],
    })
    const result = await client.execute('SELECT id FROM users')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].id).toBe('u1')
    void db // db (drizzle) is exported but not exercised here; later tests use it
  })
})
```

- [ ] **Step 2: Run test, verify failure**

Run: `pnpm test -- server/db/client`
Expected: FAIL — `Cannot find module './client'`.

- [ ] **Step 3: Implement `createDb`**

Create `server/db/client.ts`:

```ts
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
)

export interface Db {
  db: ReturnType<typeof drizzle<typeof schema>>
  client: Client
  applyMigrations: () => Promise<void>
}

export function createDb(url: string, authToken?: string): Db {
  const client = createClient({ url, authToken })
  const db = drizzle(client, { schema })
  return {
    db,
    client,
    applyMigrations: () => migrate(db, { migrationsFolder }),
  }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test -- server/db/client`
Expected: PASS.

- [ ] **Step 5: Create CLI migration runner**

Create `server/db/migrate.ts`:

```ts
import { createDb } from './client'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const { applyMigrations } = createDb(url, process.env.DATABASE_AUTH_TOKEN)
await applyMigrations()
console.log('Migrations applied:', url)
```

- [ ] **Step 6: Smoke-test the CLI**

```bash
mkdir -p data
DATABASE_URL=file:./data/app.db pnpm db:migrate
```

Expected: prints `Migrations applied: file:./data/app.db`. A file `data/app.db` appears.

- [ ] **Step 7: Commit**

```bash
git add server/db/client.ts server/db/migrate.ts server/db/client.test.ts
git commit -m "feat(db): add libsql client wrapper and migrate CLI"
```

---

## Task 5: Password hashing module

**Files:**
- Create: `server/auth/password.ts`
- Create: `server/auth/password.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/auth/password.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('password', () => {
  it('verifies a correct password', async () => {
    const hash = await hashPassword('hunter2')
    expect(await verifyPassword(hash, 'hunter2')).toBe(true)
  })

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('hunter2')
    expect(await verifyPassword(hash, 'wrong')).toBe(false)
  })

  it('produces different hashes for the same password (salting)', async () => {
    const a = await hashPassword('same')
    const b = await hashPassword('same')
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run test, verify failure**

Run: `pnpm test -- server/auth/password`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `server/auth/password.ts`:

```ts
import { hash, verify } from '@node-rs/argon2'

const OPTIONS = {
  memoryCost: 19456,    // 19 MiB — OWASP recommended floor for argon2id
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS)
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain)
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test -- server/auth/password`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add server/auth/password.ts server/auth/password.test.ts
git commit -m "feat(auth): add argon2 password hash/verify"
```

---

## Task 6: Session module

**Files:**
- Create: `server/auth/sessions.ts`
- Create: `server/auth/sessions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `server/auth/sessions.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, type Db } from '../db/client'
import { users } from '../db/schema'
import {
  createSession,
  lookupSession,
  deleteSession,
  maybeExtendSession,
} from './sessions'

async function freshDb(): Promise<Db> {
  const handle = createDb('file::memory:?cache=shared-' + Math.random())
  await handle.applyMigrations()
  await handle.db.insert(users).values({
    id: 'u1',
    email: 'a@b.c',
    passwordHash: 'x',
    createdAt: new Date().toISOString(),
  })
  return handle
}

describe('sessions', () => {
  let h: Db
  beforeEach(async () => { h = await freshDb() })

  it('creates a session and looks it up', async () => {
    const sid = await createSession(h.db, 'u1')
    expect(sid).toMatch(/^[a-f0-9]{64}$/)  // 32 bytes hex
    const found = await lookupSession(h.db, sid)
    expect(found?.user.id).toBe('u1')
    expect(found?.user.email).toBe('a@b.c')
  })

  it('returns null for an unknown sid', async () => {
    expect(await lookupSession(h.db, 'nope')).toBeNull()
  })

  it('returns null for an expired session', async () => {
    const sid = await createSession(h.db, 'u1', new Date(Date.now() - 1000))
    expect(await lookupSession(h.db, sid)).toBeNull()
  })

  it('deletes a session', async () => {
    const sid = await createSession(h.db, 'u1')
    await deleteSession(h.db, sid)
    expect(await lookupSession(h.db, sid)).toBeNull()
  })

  it('extends a session when expiry is within the threshold', async () => {
    // Expires in 3 days — within the 7-day slide window
    const soon = new Date(Date.now() + 3 * 86400_000)
    const sid = await createSession(h.db, 'u1', soon)
    await maybeExtendSession(h.db, sid, soon)
    const found = await lookupSession(h.db, sid)
    const newExp = new Date(found!.session.expiresAt).getTime()
    expect(newExp - Date.now()).toBeGreaterThan(20 * 86400_000) // ~30 days
  })

  it('does not extend a session that is still far from expiry', async () => {
    const far = new Date(Date.now() + 25 * 86400_000)
    const sid = await createSession(h.db, 'u1', far)
    await maybeExtendSession(h.db, sid, far)
    const found = await lookupSession(h.db, sid)
    expect(new Date(found!.session.expiresAt).getTime()).toBe(far.getTime())
  })
})
```

- [ ] **Step 2: Run test, verify failure**

Run: `pnpm test -- server/auth/sessions`
Expected: FAIL — `./sessions` not found.

- [ ] **Step 3: Implement**

Create `server/auth/sessions.ts`:

```ts
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { sessions, users } from '../db/schema'

export const SESSION_TTL_MS = 30 * 86400_000  // 30 days
export const SLIDE_WINDOW_MS = 7 * 86400_000  // extend if expiring within 7 days

export async function createSession(
  db: Db['db'],
  userId: string,
  expiresAt: Date = new Date(Date.now() + SESSION_TTL_MS),
): Promise<string> {
  const id = randomBytes(32).toString('hex')
  await db.insert(sessions).values({ id, userId, expiresAt: expiresAt.toISOString() })
  return id
}

export async function lookupSession(db: Db['db'], sid: string) {
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sid))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  if (new Date(row.session.expiresAt).getTime() <= Date.now()) return null
  return row
}

export async function deleteSession(db: Db['db'], sid: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sid))
}

export async function maybeExtendSession(
  db: Db['db'],
  sid: string,
  currentExpiresAt: Date,
): Promise<void> {
  if (currentExpiresAt.getTime() - Date.now() > SLIDE_WINDOW_MS) return
  const next = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  await db.update(sessions).set({ expiresAt: next }).where(eq(sessions.id, sid))
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test -- server/auth/sessions`
Expected: all 6 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/auth/sessions.ts server/auth/sessions.test.ts
git commit -m "feat(auth): add session create/lookup/delete/extend"
```

---

## Task 7: Hono app skeleton and auth middleware

**Files:**
- Create: `server/types.ts`
- Create: `server/index.ts`
- Create: `server/node.ts`
- Create: `server/auth/middleware.ts`

- [ ] **Step 1: Create AppEnv type**

Create `server/types.ts`:

```ts
import type { Db } from './db/client'

export interface AuthUser {
  id: string
  email: string
}

export interface AppVariables {
  user?: AuthUser
  sid?: string
}

export interface AppBindings {
  db: Db
  cookieSecure: boolean
}

export interface AppEnv {
  Variables: AppVariables
  Bindings: AppBindings  // populated per-request via c.set on first middleware
}
```

- [ ] **Step 2: Create auth middleware**

Create `server/auth/middleware.ts`:

```ts
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
```

- [ ] **Step 3: Create Hono app**

Create `server/index.ts`:

```ts
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import type { AppEnv } from './types'
import type { Db } from './db/client'
import { loadUser } from './auth/middleware'

export interface BuildAppOptions {
  db: Db
  cookieSecure: boolean
}

export function buildApp(opts: BuildAppOptions) {
  const app = new Hono<AppEnv>()
  app.use('*', logger())
  app.use('/api/*', loadUser(opts.db))

  app.get('/api/health', c => c.json({ ok: true }))

  // Auth routes mounted in Task 8
  // Progress routes mounted in Task 10

  // For self-host: serve the built SPA. Skipped in dev (Vite serves it).
  // For Vercel: skipped (rewrites handle it).
  return { app, opts }
}
```

- [ ] **Step 4: Create Node entrypoint**

Create `server/node.ts`:

```ts
import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import path from 'node:path'
import fs from 'node:fs'
import { createDb } from './db/client'
import { buildApp } from './index'

const url = process.env.DATABASE_URL ?? 'file:./data/app.db'
const cookieSecure = process.env.SESSION_COOKIE_SECURE === 'true'
const port = Number(process.env.PORT ?? 3001)

const db = createDb(url, process.env.DATABASE_AUTH_TOKEN)
await db.applyMigrations()

const { app } = buildApp({ db, cookieSecure })

// Serve built SPA + static assets from dist/ if it exists (production).
const distDir = path.resolve('dist')
if (fs.existsSync(distDir)) {
  app.use('/*', serveStatic({ root: './dist' }))
  app.get('*', serveStatic({ path: './dist/index.html' }))  // SPA fallback
}

serve({ fetch: app.fetch, port }, info => {
  console.log(`API listening on http://localhost:${info.port}`)
})
```

- [ ] **Step 5: Add dotenv**

```bash
pnpm add -D dotenv
```

- [ ] **Step 6: Smoke-test the server**

```bash
DATABASE_URL=file:./data/app.db pnpm dev:api &
sleep 2
curl -s http://localhost:3001/api/health
kill %1
```

Expected: `{"ok":true}`.

- [ ] **Step 7: Commit**

```bash
git add server/index.ts server/node.ts server/types.ts server/auth/middleware.ts package.json pnpm-lock.yaml
git commit -m "feat(server): hono app skeleton with auth middleware and node entrypoint"
```

---

## Task 8: Auth routes (login, logout, me)

**Files:**
- Create: `server/auth/routes.ts`
- Create: `server/auth/routes.test.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Write failing route tests**

Create `server/auth/routes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, type Db } from '../db/client'
import { users } from '../db/schema'
import { hashPassword } from './password'
import { buildApp } from '../index'

async function setup(): Promise<{ db: Db; app: ReturnType<typeof buildApp>['app'] }> {
  const db = createDb('file::memory:?cache=shared-' + Math.random())
  await db.applyMigrations()
  await db.db.insert(users).values({
    id: 'u1',
    email: 'a@b.c',
    passwordHash: await hashPassword('hunter2'),
    createdAt: new Date().toISOString(),
  })
  return { db, app: buildApp({ db, cookieSecure: false }).app }
}

describe('auth routes', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { ctx = await setup() })

  it('POST /api/auth/login sets a cookie on success', async () => {
    const res = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c', password: 'hunter2' }),
    })
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie')
    expect(cookie).toMatch(/^sid=[a-f0-9]{64}/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('POST /api/auth/login rejects bad password', async () => {
    const res = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c', password: 'wrong' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/auth/login rejects unknown email with the same 401', async () => {
    const res = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nope@b.c', password: 'hunter2' }),
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/me returns 401 without cookie', async () => {
    const res = await ctx.app.request('/api/me')
    expect(res.status).toBe(401)
  })

  it('GET /api/me returns user when cookie is valid (round trip)', async () => {
    const login = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c', password: 'hunter2' }),
    })
    const cookie = login.headers.get('set-cookie')!.split(';')[0]  // "sid=..."
    const res = await ctx.app.request('/api/me', { headers: { cookie } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'u1', email: 'a@b.c' })
  })

  it('POST /api/auth/logout clears cookie and invalidates session', async () => {
    const login = await ctx.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c', password: 'hunter2' }),
    })
    const cookie = login.headers.get('set-cookie')!.split(';')[0]
    const out = await ctx.app.request('/api/auth/logout', { method: 'POST', headers: { cookie } })
    expect(out.status).toBe(204)
    expect(out.headers.get('set-cookie')).toMatch(/sid=;.*Max-Age=0/i)
    const me = await ctx.app.request('/api/me', { headers: { cookie } })
    expect(me.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test, verify failure**

Run: `pnpm test -- server/auth/routes`
Expected: FAIL — routes don't exist (404s).

- [ ] **Step 3: Implement auth routes**

Create `server/auth/routes.ts`:

```ts
import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { eq } from 'drizzle-orm'
import type { AppEnv } from '../types'
import type { Db } from '../db/client'
import { users } from '../db/schema'
import { verifyPassword } from './password'
import { createSession, deleteSession } from './sessions'
import { COOKIE_NAME } from './middleware'

export interface AuthRoutesOptions {
  db: Db
  cookieSecure: boolean
}

export function authRoutes(opts: AuthRoutesOptions) {
  const r = new Hono<AppEnv>()

  r.post('/login', async c => {
    const body = await c.req.json().catch(() => null) as { email?: string; password?: string } | null
    if (!body?.email || !body?.password) return c.json({ error: 'bad request' }, 400)

    const row = await opts.db.db
      .select()
      .from(users)
      .where(eq(users.email, body.email.toLowerCase()))
      .limit(1)
    const user = row[0]
    if (!user) return c.json({ error: 'invalid credentials' }, 401)
    if (!(await verifyPassword(user.passwordHash, body.password))) {
      return c.json({ error: 'invalid credentials' }, 401)
    }

    const sid = await createSession(opts.db.db, user.id)
    setCookie(c, COOKIE_NAME, sid, {
      httpOnly: true,
      secure: opts.cookieSecure,
      sameSite: 'Lax',
      path: '/',
      maxAge: 30 * 86400,
    })
    return c.json({ id: user.id, email: user.email })
  })

  r.post('/logout', async c => {
    const sid = c.get('sid')
    if (sid) await deleteSession(opts.db.db, sid)
    deleteCookie(c, COOKIE_NAME, { path: '/' })
    return c.body(null, 204)
  })

  return r
}

export function meRoute() {
  const r = new Hono<AppEnv>()
  r.get('/', c => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'unauthorized' }, 401)
    return c.json(user)
  })
  return r
}
```

- [ ] **Step 4: Mount auth routes in `server/index.ts`**

Edit `server/index.ts`. Add imports near the top:

```ts
import { authRoutes, meRoute } from './auth/routes'
```

Replace the line `// Auth routes mounted in Task 8` with:

```ts
  app.route('/api/auth', authRoutes(opts))
  app.route('/api/me', meRoute())
```

- [ ] **Step 5: Run test, verify pass**

Run: `pnpm test -- server/auth/routes`
Expected: all 6 PASS.

- [ ] **Step 6: Commit**

```bash
git add server/auth/routes.ts server/auth/routes.test.ts server/index.ts
git commit -m "feat(auth): login, logout, me routes"
```

---

## Task 9: Add-user CLI

**Files:**
- Create: `server/cli/add-user.ts`

- [ ] **Step 1: Implement CLI**

Create `server/cli/add-user.ts`:

```ts
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import readline from 'node:readline'
import { Writable } from 'node:stream'
import { eq } from 'drizzle-orm'
import { createDb } from '../db/client'
import { users } from '../db/schema'
import { hashPassword } from '../auth/password'

const email = process.argv[2]?.toLowerCase()
if (!email || !email.includes('@')) {
  console.error('Usage: pnpm user:add <email>')
  process.exit(1)
}

// Prompt for password without echoing it
function promptPassword(label: string): Promise<string> {
  return new Promise(resolve => {
    const mutedStdout = new Writable({
      write(_chunk, _enc, cb) { cb() },  // swallow keystrokes
    })
    const rl = readline.createInterface({ input: process.stdin, output: mutedStdout, terminal: true })
    process.stdout.write(label)
    rl.question('', answer => {
      process.stdout.write('\n')
      rl.close()
      resolve(answer)
    })
  })
}

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL not set'); process.exit(1) }

const db = createDb(url, process.env.DATABASE_AUTH_TOKEN)
await db.applyMigrations()

const existing = await db.db.select().from(users).where(eq(users.email, email)).limit(1)
if (existing[0]) {
  console.error(`User ${email} already exists.`)
  process.exit(1)
}

const password = await promptPassword('Password: ')
if (password.length < 8) { console.error('Password must be >= 8 chars'); process.exit(1) }
const confirm = await promptPassword('Confirm:  ')
if (password !== confirm) { console.error('Passwords do not match'); process.exit(1) }

await db.db.insert(users).values({
  id: randomUUID(),
  email,
  passwordHash: await hashPassword(password),
  createdAt: new Date().toISOString(),
})

console.log(`Created user ${email}.`)
process.exit(0)
```

- [ ] **Step 2: Smoke-test the CLI**

```bash
rm -f data/app.db
DATABASE_URL=file:./data/app.db pnpm user:add test@example.com
# When prompted, type "testpass1" twice
```

Expected: prints `Created user test@example.com.`

Verify in DB:

```bash
DATABASE_URL=file:./data/app.db node -e "
import('@libsql/client').then(async ({createClient}) => {
  const c = createClient({url: 'file:./data/app.db'})
  const r = await c.execute('SELECT email FROM users')
  console.log(r.rows)
})"
```

Expected: `[ { email: 'test@example.com' } ]`.

- [ ] **Step 3: Commit**

```bash
git add server/cli/add-user.ts
git commit -m "feat(cli): add user:add command for manual user creation"
```

---

## Task 10: Progress routes — GET and DELETE

**Files:**
- Create: `server/routes/progress.ts`
- Create: `server/routes/progress.test.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Write failing tests**

Create `server/routes/progress.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, type Db } from '../db/client'
import { users, attempts, testHistory } from '../db/schema'
import { hashPassword } from '../auth/password'
import { buildApp } from '../index'

async function setup() {
  const db = createDb('file::memory:?cache=shared-' + Math.random())
  await db.applyMigrations()
  await db.db.insert(users).values({
    id: 'u1', email: 'a@b.c',
    passwordHash: await hashPassword('hunter2'),
    createdAt: new Date().toISOString(),
  })
  const app = buildApp({ db, cookieSecure: false }).app
  const login = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'hunter2' }),
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  return { db, app, cookie }
}

describe('GET /api/progress', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { ctx = await setup() })

  it('401 without cookie', async () => {
    const res = await ctx.app.request('/api/progress')
    expect(res.status).toBe(401)
  })

  it('returns empty arrays for a new user', async () => {
    const res = await ctx.app.request('/api/progress', { headers: { cookie: ctx.cookie } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ attempts: [], testHistory: [] })
  })

  it('returns stored attempts and history', async () => {
    await ctx.db.db.insert(attempts).values({
      userId: 'u1', questionId: 42, correct: true, mode: 'test',
      at: '2026-05-12T10:00:00.000Z',
    })
    await ctx.db.db.insert(testHistory).values({
      userId: 'u1', at: '2026-05-12T11:00:00.000Z',
      score: 30, total: 35, durationSec: 1500,
      perGroup: JSON.stringify({}), questionIds: JSON.stringify([1, 2, 3]),
    })
    const res = await ctx.app.request('/api/progress', { headers: { cookie: ctx.cookie } })
    const body = await res.json() as { attempts: unknown[]; testHistory: unknown[] }
    expect(body.attempts).toHaveLength(1)
    expect((body.attempts[0] as { questionId: number }).questionId).toBe(42)
    expect((body.attempts[0] as { correct: boolean }).correct).toBe(true)
    expect(body.testHistory).toHaveLength(1)
    expect((body.testHistory[0] as { score: number }).score).toBe(30)
    expect((body.testHistory[0] as { questionIds: number[] }).questionIds).toEqual([1, 2, 3])
  })
})

describe('DELETE /api/progress', () => {
  it('wipes attempts and history for the user only', async () => {
    const ctx = await setup()
    // Seed another user's data to make sure we don't delete it
    await ctx.db.db.insert(users).values({
      id: 'u2', email: 'x@y.z', passwordHash: 'x',
      createdAt: new Date().toISOString(),
    })
    await ctx.db.db.insert(attempts).values([
      { userId: 'u1', questionId: 1, correct: true,  mode: 'test',     at: 'now' },
      { userId: 'u2', questionId: 1, correct: false, mode: 'practice', at: 'now' },
    ])
    const res = await ctx.app.request('/api/progress', { method: 'DELETE', headers: { cookie: ctx.cookie } })
    expect(res.status).toBe(204)
    const after = await ctx.db.db.select().from(attempts)
    expect(after).toHaveLength(1)
    expect(after[0].userId).toBe('u2')
  })
})
```

- [ ] **Step 2: Run test, verify failure**

Run: `pnpm test -- server/routes/progress`
Expected: FAIL — route not found.

- [ ] **Step 3: Implement routes**

Create `server/routes/progress.ts`:

```ts
import { Hono } from 'hono'
import { and, eq, desc } from 'drizzle-orm'
import type { AppEnv } from '../types'
import type { Db } from '../db/client'
import { attempts, testHistory } from '../db/schema'
import { requireAuth } from '../auth/middleware'

export interface ProgressRoutesOptions { db: Db }

export function progressRoutes(opts: ProgressRoutesOptions) {
  const r = new Hono<AppEnv>()
  r.use('*', requireAuth())

  r.get('/', async c => {
    const user = c.get('user')!
    const a = await opts.db.db
      .select()
      .from(attempts)
      .where(eq(attempts.userId, user.id))
      .orderBy(attempts.at)
    const h = await opts.db.db
      .select()
      .from(testHistory)
      .where(eq(testHistory.userId, user.id))
      .orderBy(desc(testHistory.at))
      .limit(50)

    return c.json({
      attempts: a.map(x => ({
        id: x.id,
        questionId: x.questionId,
        correct: x.correct,
        mode: x.mode,
        at: x.at,
      })),
      testHistory: h.map(x => ({
        id: x.id,
        at: x.at,
        score: x.score,
        total: x.total,
        durationSec: x.durationSec,
        perGroup: JSON.parse(x.perGroup),
        questionIds: JSON.parse(x.questionIds),
      })),
    })
  })

  r.delete('/', async c => {
    const user = c.get('user')!
    await opts.db.db.delete(attempts).where(eq(attempts.userId, user.id))
    await opts.db.db.delete(testHistory).where(eq(testHistory.userId, user.id))
    return c.body(null, 204)
  })

  return r
}
```

- [ ] **Step 4: Mount in `server/index.ts`**

Add import:

```ts
import { progressRoutes } from './routes/progress'
```

Replace the line `// Progress routes mounted in Task 10` with:

```ts
  app.route('/api/progress', progressRoutes(opts))
```

- [ ] **Step 5: Run test, verify pass**

Run: `pnpm test -- server/routes/progress`
Expected: 4 PASS.

- [ ] **Step 6: Commit**

```bash
git add server/routes/progress.ts server/routes/progress.test.ts server/index.ts
git commit -m "feat(api): GET and DELETE /api/progress"
```

---

## Task 11: POST /api/attempts and POST /api/test-history

**Files:**
- Create: `server/routes/attempts.ts`
- Create: `server/routes/testHistory.ts`
- Create: `server/routes/writes.test.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Write failing tests**

Create `server/routes/writes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createDb, type Db } from '../db/client'
import { users, attempts, testHistory } from '../db/schema'
import { hashPassword } from '../auth/password'
import { buildApp } from '../index'

async function setup() {
  const db = createDb('file::memory:?cache=shared-' + Math.random())
  await db.applyMigrations()
  await db.db.insert(users).values({
    id: 'u1', email: 'a@b.c',
    passwordHash: await hashPassword('hunter2'),
    createdAt: new Date().toISOString(),
  })
  const app = buildApp({ db, cookieSecure: false }).app
  const login = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c', password: 'hunter2' }),
  })
  const cookie = login.headers.get('set-cookie')!.split(';')[0]
  return { db, app, cookie }
}

describe('POST /api/attempts', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { ctx = await setup() })

  it('401 without cookie', async () => {
    const res = await ctx.app.request('/api/attempts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: 1, correct: true, mode: 'test' }),
    })
    expect(res.status).toBe(401)
  })

  it('inserts an attempt', async () => {
    const res = await ctx.app.request('/api/attempts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify({ questionId: 7, correct: false, mode: 'practice' }),
    })
    expect(res.status).toBe(201)
    const rows = await ctx.db.db.select().from(attempts)
    expect(rows).toHaveLength(1)
    expect(rows[0].questionId).toBe(7)
    expect(rows[0].correct).toBe(false)
    expect(rows[0].mode).toBe('practice')
    expect(rows[0].userId).toBe('u1')
  })

  it('400 on bad mode', async () => {
    const res = await ctx.app.request('/api/attempts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify({ questionId: 7, correct: false, mode: 'bogus' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/test-history', () => {
  it('inserts a test history entry', async () => {
    const ctx = await setup()
    const res = await ctx.app.request('/api/test-history', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify({
        score: 30, total: 35, durationSec: 1500,
        perGroup: { 'plavebni-provoz': { correct: 14, total: 16 } },
        questionIds: [1, 2, 3],
      }),
    })
    expect(res.status).toBe(201)
    const rows = await ctx.db.db.select().from(testHistory)
    expect(rows).toHaveLength(1)
    expect(rows[0].score).toBe(30)
    expect(JSON.parse(rows[0].questionIds)).toEqual([1, 2, 3])
  })
})
```

- [ ] **Step 2: Run, verify failure**

Run: `pnpm test -- server/routes/writes`
Expected: FAIL.

- [ ] **Step 3: Implement attempts route**

Create `server/routes/attempts.ts`:

```ts
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import type { Db } from '../db/client'
import { attempts } from '../db/schema'
import { requireAuth } from '../auth/middleware'

const MODES = ['test', 'practice'] as const

export function attemptsRoutes(opts: { db: Db }) {
  const r = new Hono<AppEnv>()
  r.use('*', requireAuth())

  r.post('/', async c => {
    const body = await c.req.json().catch(() => null) as {
      questionId?: unknown; correct?: unknown; mode?: unknown
    } | null
    if (!body) return c.json({ error: 'bad request' }, 400)
    if (typeof body.questionId !== 'number' || !Number.isFinite(body.questionId)) {
      return c.json({ error: 'bad questionId' }, 400)
    }
    if (typeof body.correct !== 'boolean') return c.json({ error: 'bad correct' }, 400)
    if (typeof body.mode !== 'string' || !MODES.includes(body.mode as typeof MODES[number])) {
      return c.json({ error: 'bad mode' }, 400)
    }

    const user = c.get('user')!
    await opts.db.db.insert(attempts).values({
      userId: user.id,
      questionId: body.questionId,
      correct: body.correct,
      mode: body.mode as typeof MODES[number],
      at: new Date().toISOString(),
    })
    return c.body(null, 201)
  })

  return r
}
```

- [ ] **Step 4: Implement test-history route**

Create `server/routes/testHistory.ts`:

```ts
import { Hono } from 'hono'
import type { AppEnv } from '../types'
import type { Db } from '../db/client'
import { testHistory } from '../db/schema'
import { requireAuth } from '../auth/middleware'

export function testHistoryRoutes(opts: { db: Db }) {
  const r = new Hono<AppEnv>()
  r.use('*', requireAuth())

  r.post('/', async c => {
    const body = await c.req.json().catch(() => null) as {
      score?: unknown; total?: unknown; durationSec?: unknown;
      perGroup?: unknown; questionIds?: unknown;
    } | null
    if (!body) return c.json({ error: 'bad request' }, 400)
    if (typeof body.score !== 'number' || typeof body.total !== 'number' ||
        typeof body.durationSec !== 'number') return c.json({ error: 'bad numbers' }, 400)
    if (typeof body.perGroup !== 'object' || body.perGroup === null) {
      return c.json({ error: 'bad perGroup' }, 400)
    }
    if (!Array.isArray(body.questionIds)) return c.json({ error: 'bad questionIds' }, 400)

    const user = c.get('user')!
    await opts.db.db.insert(testHistory).values({
      userId: user.id,
      at: new Date().toISOString(),
      score: body.score,
      total: body.total,
      durationSec: body.durationSec,
      perGroup: JSON.stringify(body.perGroup),
      questionIds: JSON.stringify(body.questionIds),
    })
    return c.body(null, 201)
  })

  return r
}
```

- [ ] **Step 5: Mount in `server/index.ts`**

Add imports:

```ts
import { attemptsRoutes } from './routes/attempts'
import { testHistoryRoutes } from './routes/testHistory'
```

After the existing `app.route('/api/progress', ...)` line, add:

```ts
  app.route('/api/attempts', attemptsRoutes(opts))
  app.route('/api/test-history', testHistoryRoutes(opts))
```

- [ ] **Step 6: Run test, verify pass**

Run: `pnpm test -- server/routes/writes`
Expected: 4 PASS.

- [ ] **Step 7: Commit**

```bash
git add server/routes/attempts.ts server/routes/testHistory.ts server/routes/writes.test.ts server/index.ts
git commit -m "feat(api): POST /api/attempts and POST /api/test-history"
```

---

## Task 12: POST /api/progress/import for legacy localStorage migration

**Files:**
- Modify: `server/routes/progress.ts`
- Modify: `server/routes/progress.test.ts`

- [ ] **Step 1: Add failing test**

Append to `server/routes/progress.test.ts`:

```ts
describe('POST /api/progress/import', () => {
  it('imports legacy localStorage shape', async () => {
    const ctx = await setup()
    const payload = {
      questions: {
        '1': { attempts: [{ at: '2025-01-01T00:00:00Z', correct: true,  mode: 'test'     }], lastSeen: '2025-01-01T00:00:00Z' },
        '7': { attempts: [{ at: '2025-01-02T00:00:00Z', correct: false, mode: 'practice' }], lastSeen: '2025-01-02T00:00:00Z' },
      },
      testHistory: [
        { at: '2025-01-03T00:00:00Z', score: 30, total: 35, durationSec: 1500, perGroup: {}, questionIds: [1, 7] },
      ],
    }
    const res = await ctx.app.request('/api/progress/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: ctx.cookie },
      body: JSON.stringify(payload),
    })
    expect(res.status).toBe(201)
    const a = await ctx.db.db.select().from(attempts)
    expect(a).toHaveLength(2)
    const h = await ctx.db.db.select().from(testHistory)
    expect(h).toHaveLength(1)
    expect(h[0].score).toBe(30)
  })
})
```

- [ ] **Step 2: Run, verify failure**

Run: `pnpm test -- server/routes/progress`
Expected: import test FAIL (404).

- [ ] **Step 3: Add import handler**

Edit `server/routes/progress.ts`. After the `r.delete('/', ...)` block but before `return r`, add:

```ts
  r.post('/import', async c => {
    const body = await c.req.json().catch(() => null) as {
      questions?: Record<string, { attempts: { at: string; correct: boolean; mode: string }[] }>
      testHistory?: { at: string; score: number; total: number; durationSec: number; perGroup: object; questionIds: number[] }[]
    } | null
    if (!body) return c.json({ error: 'bad request' }, 400)

    const user = c.get('user')!
    const attemptRows: typeof attempts.$inferInsert[] = []
    for (const [qid, rec] of Object.entries(body.questions ?? {})) {
      const questionId = Number(qid)
      if (!Number.isFinite(questionId)) continue
      for (const a of rec.attempts ?? []) {
        if (a.mode !== 'test' && a.mode !== 'practice') continue
        attemptRows.push({
          userId: user.id,
          questionId,
          correct: Boolean(a.correct),
          mode: a.mode,
          at: a.at,
        })
      }
    }
    if (attemptRows.length) {
      await opts.db.db.insert(attempts).values(attemptRows)
    }

    for (const h of body.testHistory ?? []) {
      await opts.db.db.insert(testHistory).values({
        userId: user.id,
        at: h.at,
        score: h.score,
        total: h.total,
        durationSec: h.durationSec,
        perGroup: JSON.stringify(h.perGroup),
        questionIds: JSON.stringify(h.questionIds),
      })
    }
    return c.body(null, 201)
  })
```

- [ ] **Step 4: Run test, verify pass**

Run: `pnpm test -- server/routes/progress`
Expected: all PASS (including new import test).

- [ ] **Step 5: Commit**

```bash
git add server/routes/progress.ts server/routes/progress.test.ts
git commit -m "feat(api): POST /api/progress/import for one-shot localStorage migration"
```

---

## Task 13: Switch HashRouter → BrowserRouter, add Login + RequireAuth

**Files:**
- Create: `src/hooks/useAuth.ts`
- Create: `src/components/RequireAuth.tsx`
- Create: `src/routes/Login.tsx`
- Modify: `src/App.tsx`
- Create: `src/components/RequireAuth.test.tsx`

- [ ] **Step 1: Write failing test for RequireAuth**

Create `src/components/RequireAuth.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RequireAuth from './RequireAuth'
import { AuthProvider } from '../hooks/useAuth'

function App() {
  return (
    <AuthProvider>
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>LoginPage</div>} />
          <Route path="/protected" element={<RequireAuth><div>SecretPage</div></RequireAuth>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('RequireAuth', () => {
  beforeEach(() => { vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('', { status: 401 })) })
  afterEach(() => { vi.restoreAllMocks() })

  it('redirects to /login when /api/me returns 401', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('LoginPage')).toBeInTheDocument())
    expect(screen.queryByText('SecretPage')).not.toBeInTheDocument()
  })

  it('renders children when /api/me returns a user', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ id: 'u1', email: 'a@b.c' }), { status: 200, headers: { 'content-type': 'application/json' } })
    )
    render(<App />)
    await waitFor(() => expect(screen.getByText('SecretPage')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run, verify failure**

Run: `pnpm test -- RequireAuth`
Expected: FAIL — modules missing.

- [ ] **Step 3: Create AuthProvider + useAuth**

Create `src/hooks/useAuth.ts`:

```tsx
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

interface AuthUser { id: string; email: string }

interface AuthCtx {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' })
      if (res.ok) setUser(await res.json())
      else setUser(null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    })
    if (res.ok) {
      setUser(await res.json())
      return { ok: true }
    }
    return { ok: false, error: res.status === 401 ? 'Špatný email nebo heslo' : `HTTP ${res.status}` }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    setUser(null)
  }, [])

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be inside <AuthProvider>')
  return v
}
```

- [ ] **Step 4: Create RequireAuth**

Create `src/components/RequireAuth.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="p-8 text-sm text-neutral-500">Načítám…</div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}
```

- [ ] **Step 5: Create Login route**

Create `src/routes/Login.tsx`:

```tsx
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface LocationState { from?: { pathname?: string } }

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res = await login(email.trim().toLowerCase(), password)
    setBusy(false)
    if (res.ok) {
      const to = (location.state as LocationState | null)?.from?.pathname ?? '/'
      navigate(to, { replace: true })
    } else {
      setError(res.error ?? 'Chyba')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form onSubmit={onSubmit} className="bg-white p-8 rounded-lg shadow-sm border border-neutral-200 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6">Přihlášení</h1>
        <label className="block mb-3">
          <span className="block text-sm text-neutral-700 mb-1">Email</span>
          <input type="email" autoFocus required value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-neutral-300 rounded px-3 py-2" />
        </label>
        <label className="block mb-4">
          <span className="block text-sm text-neutral-700 mb-1">Heslo</span>
          <input type="password" required value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-neutral-300 rounded px-3 py-2" />
        </label>
        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
        <button type="submit" disabled={busy}
          className="w-full bg-primary text-white rounded py-2 hover:bg-primary-dark disabled:opacity-50">
          {busy ? 'Přihlašuji…' : 'Přihlásit'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 6: Update App.tsx**

Replace `src/App.tsx` contents with:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import RequireAuth from './components/RequireAuth'
import Sidebar from './components/Sidebar'
import Home from './routes/Home'
import Test from './routes/Test'
import Practice from './routes/Practice'
import Weak from './routes/Weak'
import Stats from './routes/Stats'
import Settings from './routes/Settings'
import Login from './routes/Login'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Shell><Home /></Shell></RequireAuth>} />
          <Route path="/test" element={<RequireAuth><Shell><Test /></Shell></RequireAuth>} />
          <Route path="/practice" element={<RequireAuth><Shell><Practice /></Shell></RequireAuth>} />
          <Route path="/weak" element={<RequireAuth><Shell><Weak /></Shell></RequireAuth>} />
          <Route path="/stats" element={<RequireAuth><Shell><Stats /></Shell></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><Shell><Settings /></Shell></RequireAuth>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
```

- [ ] **Step 7: Run RequireAuth test, verify pass**

Run: `pnpm test -- RequireAuth`
Expected: 2 PASS.

- [ ] **Step 8: Run full test suite — check nothing else broke**

Run: `pnpm test`
Expected: all PASS. If `useProgress.test.tsx` fails it's because we'll change it in Task 14 — leave it for now; it's still going through localStorage at this point so it should still pass.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/hooks/useAuth.ts src/components/RequireAuth.tsx src/components/RequireAuth.test.tsx src/routes/Login.tsx
git commit -m "feat(ui): BrowserRouter + AuthProvider + Login + RequireAuth"
```

---

## Task 14: Refactor `useProgress` to call the API

**Files:**
- Modify: `src/hooks/useProgress.ts`
- Modify: `src/hooks/useProgress.test.tsx`
- Modify: `src/types.ts` (add server-shape types)

- [ ] **Step 1: Read the existing test to know what API to keep stable**

Run: `cat src/hooks/useProgress.test.tsx`

The external API must remain: `useProgress()` returns `{ store, recordAttempt, recordTestHistory, reset }`. Internals change.

- [ ] **Step 2: Rewrite the test for the fetch-based version**

Replace `src/hooks/useProgress.test.tsx` contents with:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useProgress } from './useProgress'

interface MockState {
  attempts: { id?: number; questionId: number; correct: boolean; mode: 'test' | 'practice'; at: string }[]
  testHistory: { id?: number; at: string; score: number; total: number; durationSec: number; perGroup: object; questionIds: number[] }[]
}

function mockServer(initial: MockState) {
  let state: MockState = { attempts: [...initial.attempts], testHistory: [...initial.testHistory] }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    const method = init?.method ?? 'GET'
    if (url.endsWith('/api/progress') && method === 'GET') {
      return new Response(JSON.stringify(state), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    if (url.endsWith('/api/attempts') && method === 'POST') {
      const body = JSON.parse(init!.body as string)
      state.attempts.push({ ...body, at: new Date().toISOString() })
      return new Response(null, { status: 201 })
    }
    if (url.endsWith('/api/test-history') && method === 'POST') {
      const body = JSON.parse(init!.body as string)
      state.testHistory.unshift({ ...body, at: new Date().toISOString() })
      return new Response(null, { status: 201 })
    }
    if (url.endsWith('/api/progress') && method === 'DELETE') {
      state = { attempts: [], testHistory: [] }
      return new Response(null, { status: 204 })
    }
    return new Response('not found', { status: 404 })
  })
  return () => state
}

describe('useProgress (server-backed)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loads attempts and test history from the server on mount', async () => {
    mockServer({
      attempts: [{ questionId: 1, correct: true, mode: 'test', at: '2026-01-01T00:00:00Z' }],
      testHistory: [{ at: '2026-01-02T00:00:00Z', score: 30, total: 35, durationSec: 1500, perGroup: {}, questionIds: [1] }],
    })
    const { result } = renderHook(() => useProgress())
    await waitFor(() => expect(result.current.store.questions[1]).toBeTruthy())
    expect(result.current.store.questions[1].attempts).toHaveLength(1)
    expect(result.current.store.testHistory).toHaveLength(1)
  })

  it('recordAttempt POSTs to /api/attempts and updates store optimistically', async () => {
    const getState = mockServer({ attempts: [], testHistory: [] })
    const { result } = renderHook(() => useProgress())
    await waitFor(() => expect(result.current.store).toBeDefined())

    await act(async () => { await result.current.recordAttempt(42, true, 'test') })
    expect(result.current.store.questions[42]).toBeTruthy()
    expect(result.current.store.questions[42].attempts).toHaveLength(1)
    expect(getState().attempts).toHaveLength(1)
    expect(getState().attempts[0].questionId).toBe(42)
  })

  it('recordTestHistory POSTs to /api/test-history', async () => {
    const getState = mockServer({ attempts: [], testHistory: [] })
    const { result } = renderHook(() => useProgress())
    await waitFor(() => expect(result.current.store).toBeDefined())

    await act(async () => {
      await result.current.recordTestHistory({
        at: '2026-05-12T00:00:00Z', score: 30, total: 35, durationSec: 1500,
        perGroup: {} as never, questionIds: [1, 2, 3],
      })
    })
    expect(getState().testHistory).toHaveLength(1)
  })

  it('reset DELETEs /api/progress and clears local store', async () => {
    const getState = mockServer({
      attempts: [{ questionId: 1, correct: true, mode: 'test', at: '2026-01-01T00:00:00Z' }],
      testHistory: [],
    })
    const { result } = renderHook(() => useProgress())
    await waitFor(() => expect(result.current.store.questions[1]).toBeTruthy())
    await act(async () => { await result.current.reset() })
    expect(result.current.store.questions[1]).toBeUndefined()
    expect(getState().attempts).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run, verify failure**

Run: `pnpm test -- useProgress`
Expected: FAIL — the existing implementation is localStorage-based.

- [ ] **Step 4: Rewrite the hook**

Replace `src/hooks/useProgress.ts` contents with:

```ts
import { useCallback, useEffect, useState } from 'react'
import type { ProgressStore, AnswerMode, TestHistoryEntry, QuestionProgress, AttemptRecord } from '../types'

const empty: ProgressStore = { questions: {}, testHistory: [] }

interface ServerAttempt {
  id: number
  questionId: number
  correct: boolean
  mode: AnswerMode
  at: string
}

interface ServerProgress {
  attempts: ServerAttempt[]
  testHistory: TestHistoryEntry[]
}

function foldAttempts(server: ServerAttempt[]): ProgressStore['questions'] {
  const out: ProgressStore['questions'] = {}
  for (const a of server) {
    const cur: QuestionProgress = out[a.questionId] ?? { attempts: [], lastSeen: '' }
    const rec: AttemptRecord = { at: a.at, correct: a.correct, mode: a.mode }
    cur.attempts.push(rec)
    cur.lastSeen = a.at > cur.lastSeen ? a.at : cur.lastSeen
    out[a.questionId] = cur
  }
  return out
}

async function postWithRetry(url: string, body: unknown, attempts = 3): Promise<void> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
      if (res.ok) return
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
    await new Promise(r => setTimeout(r, 250 * 2 ** i))
  }
  throw lastErr
}

export function useProgress() {
  const [store, setStore] = useState<ProgressStore>(empty)

  // Load on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/progress', { credentials: 'same-origin' })
        if (!res.ok) return
        const body = await res.json() as ServerProgress
        setStore({
          questions: foldAttempts(body.attempts),
          testHistory: body.testHistory,
        })
      } catch { /* keep empty */ }
    })()
  }, [])

  const recordAttempt = useCallback(async (qid: number, correct: boolean, mode: AnswerMode) => {
    const at = new Date().toISOString()
    // optimistic update
    setStore(prev => {
      const cur = prev.questions[qid] ?? { attempts: [], lastSeen: '' }
      return {
        ...prev,
        questions: {
          ...prev.questions,
          [qid]: { attempts: [...cur.attempts, { at, correct, mode }], lastSeen: at },
        },
      }
    })
    try {
      await postWithRetry('/api/attempts', { questionId: qid, correct, mode })
    } catch {
      // revert on persistent failure
      setStore(prev => {
        const cur = prev.questions[qid]
        if (!cur) return prev
        const trimmed = cur.attempts.slice(0, -1)
        return {
          ...prev,
          questions: { ...prev.questions, [qid]: { ...cur, attempts: trimmed } },
        }
      })
      console.warn('Failed to save attempt')
    }
  }, [])

  const recordTestHistory = useCallback(async (entry: TestHistoryEntry) => {
    setStore(prev => ({ ...prev, testHistory: [entry, ...prev.testHistory].slice(0, 50) }))
    try {
      await postWithRetry('/api/test-history', {
        score: entry.score,
        total: entry.total,
        durationSec: entry.durationSec,
        perGroup: entry.perGroup,
        questionIds: entry.questionIds,
      })
    } catch {
      console.warn('Failed to save test history')
    }
  }, [])

  const reset = useCallback(async () => {
    setStore(empty)
    try {
      await fetch('/api/progress', { method: 'DELETE', credentials: 'same-origin' })
    } catch {
      console.warn('Failed to reset on server')
    }
  }, [])

  return { store, recordAttempt, recordTestHistory, reset }
}
```

- [ ] **Step 5: Update call sites that expected `recordAttempt`/`recordTestHistory`/`reset` to be sync**

```bash
grep -rn "recordAttempt\|recordTestHistory" src/ --include="*.tsx" --include="*.ts" | grep -v test
```

For each callsite of `recordAttempt(...)` or `recordTestHistory(...)`, the call is now async. The existing call sites likely ignore the return value (fire-and-forget), which still works — but TypeScript may warn. If TS errors appear, prefix calls with `void` (e.g. `void recordAttempt(...)`).

- [ ] **Step 6: Run tests**

Run: `pnpm test`
Expected: all PASS (including useProgress and any callers).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useProgress.ts src/hooks/useProgress.test.tsx $(git diff --name-only)
git commit -m "refactor(progress): server-backed useProgress with optimistic updates"
```

---

## Task 15: Rename coworkLink → claudeDesktopLink, simplify ExplainModal

**Files:**
- Rename: `src/lib/coworkLink.ts` → `src/lib/claudeDesktopLink.ts`
- Rename: `src/lib/coworkLink.test.ts` → `src/lib/claudeDesktopLink.test.ts`
- Modify: `src/components/ExplainButton.tsx` (drop `projectRoot` prop)
- Modify: `src/components/ExplainModal.tsx` (drop `projectRoot`, simplify follow-up button)
- Modify: `src/routes/Practice.tsx`, `src/routes/Test.tsx`, `src/routes/Weak.tsx` (anywhere `<ExplainButton>` is used with `projectRoot`)

- [ ] **Step 1: Rename files**

```bash
git mv src/lib/coworkLink.ts src/lib/claudeDesktopLink.ts
git mv src/lib/coworkLink.test.ts src/lib/claudeDesktopLink.test.ts
```

- [ ] **Step 2: Rewrite the link builder + its test**

Replace `src/lib/claudeDesktopLink.ts` with:

```ts
export interface ClaudeLinkParams {
  qid: number
}

/**
 * Builds a Claude Desktop deeplink for follow-up questions about a specific
 * VMP question. The static explanation is rendered in-app; this link is only
 * for "I want to ask Claude more about this".
 */
export function buildFollowupLink({ qid }: ClaudeLinkParams): string {
  const prompt = `Mám doplňující dotaz k otázce #${qid} z VMP M testu. Vysvětlení mám zobrazené v appce — chci se zeptat na konkrétní detail.`
  const params = new URLSearchParams({ q: prompt })
  return `claude://new?${params.toString()}`
}
```

Replace `src/lib/claudeDesktopLink.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { buildFollowupLink } from './claudeDesktopLink'

describe('buildFollowupLink', () => {
  it('produces a claude:// URL with the qid embedded in the prompt', () => {
    const url = buildFollowupLink({ qid: 42 })
    expect(url.startsWith('claude://new?')).toBe(true)
    expect(decodeURIComponent(url)).toContain('otázce #42')
  })
})
```

- [ ] **Step 3: Update ExplainModal**

Replace `src/components/ExplainModal.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { useExplanations, type ExplanationFetchResult } from '../hooks/useExplanations'
import { sanitizeExplanationHtml } from '../lib/sanitize'
import { buildFollowupLink } from '../lib/claudeDesktopLink'

interface Props {
  qid: number
  open: boolean
  onClose: () => void
}

export default function ExplainModal({ qid, open, onClose }: Props) {
  const { fetchExplanation } = useExplanations()
  const [result, setResult] = useState<ExplanationFetchResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetchExplanation(qid).then(r => { setResult(r); setLoading(false) })
  }, [open, qid, fetchExplanation])

  if (!open) return null

  const followupUrl = buildFollowupLink({ qid })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-full max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <header className="flex justify-between items-center px-6 py-4 border-b border-neutral-200 shrink-0">
          <h3 className="text-lg font-semibold">Vysvětlení k otázce #{qid}</h3>
          <div className="flex items-center gap-2">
            {result?.status === 'hit' && (
              <a
                href={followupUrl}
                className="px-3 py-2 bg-accent text-white text-sm rounded hover:opacity-90 transition"
                title="Doplňující dotaz v Claude Desktop"
              >
                💬 Zeptat se Claude ↗
              </a>
            )}
            <button onClick={onClose} className="px-2 py-1 text-xl text-neutral-500 hover:text-neutral-900 leading-none">✕</button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-8 py-6">
          {loading && <div className="text-sm text-neutral-500">Načítám…</div>}

          {!loading && result?.status === 'hit' && (
            <article
              className="prose prose-neutral max-w-none prose-headings:text-neutral-900 prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-p:my-3 prose-p:leading-relaxed prose-a:text-accent prose-strong:text-neutral-900 prose-img:rounded prose-img:border prose-img:border-neutral-200 [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:my-4 [&_svg]:rounded [&_svg]:border [&_svg]:border-neutral-200 [&_svg]:bg-white [&_table]:text-sm [&_th]:bg-neutral-100"
              dangerouslySetInnerHTML={{ __html: sanitizeExplanationHtml(result.html ?? '') }}
            />
          )}

          {!loading && result?.status === 'miss' && (
            <div className="bg-amber-50 border border-amber-200 rounded p-5">
              <p className="text-base">Vysvětlení k téhle otázce zatím nemáme. Můžeš se zeptat Claude přímo:</p>
              <a href={followupUrl} className="inline-flex mt-3 items-center justify-center px-4 py-3 bg-primary text-white rounded font-medium hover:bg-primary-dark transition">
                ▶ Otevřít Claude
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update ExplainButton**

Replace `src/components/ExplainButton.tsx` with:

```tsx
import { useState } from 'react'
import ExplainModal from './ExplainModal'

interface Props {
  qid: number
}

export default function ExplainButton({ qid }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-2 border border-accent text-accent text-sm rounded hover:bg-accent hover:text-white transition"
      >
        🧠 Vysvětlení
      </button>
      <ExplainModal qid={qid} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
```

- [ ] **Step 5: Update call sites that passed `projectRoot`**

```bash
grep -rn "projectRoot\|VITE_PROJECT_ROOT\|buildExplainLink\|coworkLink" src/
```

For each callsite of `<ExplainButton ... projectRoot={...} />`, delete the `projectRoot` prop. For each import of `buildExplainLink` or `coworkLink`, remove it (it's gone). The grep result is your checklist; resolve all hits.

- [ ] **Step 6: Run tests**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: replace cowork deeplink with claude-desktop follow-up link"
```

---

## Task 16: Update Settings page (logout, drop env, import button)

**Files:**
- Modify: `src/routes/Settings.tsx`

- [ ] **Step 1: Rewrite Settings**

Replace `src/routes/Settings.tsx` with:

```tsx
import { useState } from 'react'
import { useProgress } from '../hooks/useProgress'
import { useAuth } from '../hooks/useAuth'

const LEGACY_KEY = 'vmp:progress'

export default function Settings() {
  const { reset } = useProgress()
  const { user, logout } = useAuth()
  const [confirmReset, setConfirmReset] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  const legacy = (() => {
    try { return localStorage.getItem(LEGACY_KEY) } catch { return null }
  })()

  async function doImport() {
    if (!legacy) return
    let parsed: unknown
    try { parsed = JSON.parse(legacy) } catch { setImportMsg('Neplatný JSON v localStorage.'); return }
    setImportMsg('Importuji…')
    const res = await fetch('/api/progress/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(parsed),
    })
    if (res.ok) {
      try { localStorage.removeItem(LEGACY_KEY) } catch { /* ignore */ }
      setImportMsg('Import OK. Obnov stránku.')
    } else {
      setImportMsg(`Import selhal: HTTP ${res.status}`)
    }
  }

  return (
    <div className="max-w-2xl p-8">
      <h2 className="text-2xl font-bold mb-6">Nastavení</h2>

      <div className="bg-white border border-neutral-200 rounded p-4 mb-4">
        <div className="text-sm">Přihlášen jako <strong>{user?.email}</strong></div>
        <button onClick={() => void logout()}
          className="mt-3 px-3 py-2 border border-neutral-300 rounded text-sm hover:bg-neutral-50">
          Odhlásit
        </button>
      </div>

      {legacy && (
        <div className="bg-white border border-amber-300 rounded p-4 mb-4">
          <div className="text-sm font-semibold mb-2">Najít starý progress v prohlížeči?</div>
          <p className="text-xs text-neutral-600 mb-3">
            V localStorage je uložený progress z předchozí lokální verze. Můžeš ho jednorázově importovat na server.
          </p>
          <button onClick={() => void doImport()}
            className="px-3 py-2 bg-accent text-white rounded text-sm">
            Importovat
          </button>
          {importMsg && <div className="mt-2 text-sm">{importMsg}</div>}
        </div>
      )}

      <div className="bg-white border border-neutral-200 rounded p-4">
        <div className="text-sm font-semibold mb-2">Smazat veškerý progress</div>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="px-3 py-2 border border-danger text-danger rounded text-sm hover:bg-danger hover:text-white transition">
            Reset progress
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-danger">Opravdu? Toto smaže celou historii.</span>
            <button onClick={() => { void reset(); setConfirmReset(false) }} className="px-3 py-2 bg-danger text-white rounded text-sm">Ano, smazat</button>
            <button onClick={() => setConfirmReset(false)} className="px-3 py-2 border border-neutral-300 rounded text-sm">Zpět</button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Remove `.env.local.example`'s old contents**

Run: `cat .env.local.example`

If the file still says `VITE_PROJECT_ROOT=...`, replace its contents with:

```
# Local libSQL file (created on first migration)
DATABASE_URL=file:./data/app.db
SESSION_COOKIE_SECURE=false
PORT=3001
```

- [ ] **Step 3: Smoke-test in browser**

```bash
# Terminal 1: API
DATABASE_URL=file:./data/app.db pnpm dev:api &
# Terminal 2: create a user
DATABASE_URL=file:./data/app.db pnpm user:add david@keboola.com
# Terminal 3: full dev (api + vite)
pnpm dev
```

Open http://localhost:5400 → redirects to /login. Log in. Open Settings. Click logout. Confirm you land back on /login. Log in again. Confirm an answer in Practice mode is saved (refresh: it persists).

Kill both servers.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Settings.tsx .env.local.example
git commit -m "feat(ui): settings page — logout, legacy import, server-backed reset"
```

---

## Task 17: Vercel deploy adapter

**Files:**
- Create: `server/vercel.ts`
- Create: `api/[[...path]].ts` (Vercel routes API folder)
- Create: `vercel.json`

- [ ] **Step 1: Create the Vercel handler**

Create `server/vercel.ts`:

```ts
import { createDb } from './db/client'
import { buildApp } from './index'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL not set on Vercel')

const db = createDb(url, process.env.DATABASE_AUTH_TOKEN)

// Migrations are run via the build step (`pnpm db:migrate`) before deploy.
// We do NOT run migrations per-request — that would slow cold starts.

const { app } = buildApp({ db, cookieSecure: true })

export default app
```

- [ ] **Step 2: Create the Vercel function wrapper**

Create `api/[...path].ts`:

```ts
import app from '../server/vercel'
export const config = { runtime: 'nodejs' }
export default async function handler(req: Request): Promise<Response> {
  return app.fetch(req)
}
```

The `[...path].ts` filename is Vercel's catch-all syntax — this single function is mounted at every `/api/*` path. Hono inspects `req.url` and routes to the right handler internally.

- [ ] **Step 3: Create vercel.json**

Create `vercel.json`:

```json
{
  "buildCommand": "pnpm db:migrate && pnpm build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/((?!api|explanations|data|assets|favicon.svg).*)", "destination": "/index.html" }
  ]
}
```

The single rewrite is the SPA fallback. The negative-lookahead excludes `/api/*` (Vercel handles via the catch-all function) and static asset directories. Rewrites run in order, first match wins.

- [ ] **Step 4: Sanity-check the Vercel handler locally**

Run:

```bash
rm -rf data/test-vercel.db
DATABASE_URL=file:./data/test-vercel.db pnpm db:migrate
DATABASE_URL=file:./data/test-vercel.db PORT=3010 SESSION_COOKIE_SECURE=false pnpm dev:api &
sleep 2
curl -s http://localhost:3010/api/health
kill %1
```

Expected: `{"ok":true}` (this only tests the Node entrypoint — Vercel-mode is exercised on deploy).

- [ ] **Step 5: Commit**

```bash
git add server/vercel.ts api/ vercel.json
git commit -m "feat(deploy): vercel adapter + rewrites"
```

---

## Task 18: Dockerfile for single-container self-host

**Files:**
- Create: `docker/Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create .dockerignore**

Create `.dockerignore`:

```
node_modules
dist
dist-skill
data
.git
.env
.env.local
*.log
.DS_Store
.claude
docs
```

- [ ] **Step 2: Create Dockerfile**

Create `docker/Dockerfile`:

```dockerfile
# ---- Build stage ----
FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

# Install deps with frozen lockfile
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build the SPA
COPY . .
RUN pnpm build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime

RUN corepack enable
WORKDIR /app

# Production deps + tsx so we can run server/node.ts as-is (no separate server build step)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm add tsx

# Copy build output + server source + migrations
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/public ./public

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/app.db
ENV PORT=3000
ENV SESSION_COOKIE_SECURE=true

VOLUME ["/data"]
EXPOSE 3000

CMD ["pnpm", "start"]
```

- [ ] **Step 3: Build the image**

```bash
docker build -t vmp-trainer -f docker/Dockerfile .
```

Expected: build succeeds. Image size shown in output; should be well under 200 MB.

- [ ] **Step 4: Run the container and smoke-test**

```bash
mkdir -p /tmp/vmp-data
docker run --rm -d --name vmp-test -p 3000:3000 -e SESSION_COOKIE_SECURE=false -v /tmp/vmp-data:/data vmp-trainer
sleep 3
curl -s http://localhost:3000/api/health
docker exec vmp-test sh -c 'pnpm user:add docker@test.com <<EOF
testpass1
testpass1
EOF'
docker logs vmp-test | tail -20
docker stop vmp-test
```

Expected: `{"ok":true}` from curl; "Created user docker@test.com." from the user:add command.

(The heredoc above won't actually feed the hidden-prompt CLI reliably — if it fails, run `docker exec -it vmp-test pnpm user:add docker@test.com` interactively instead.)

- [ ] **Step 5: Commit**

```bash
git add docker/ .dockerignore
git commit -m "feat(docker): single-container build with /data volume"
```

---

## Task 19: Rate limiting on login

**Files:**
- Create: `server/auth/rateLimit.ts`
- Modify: `server/auth/routes.ts`

- [ ] **Step 1: Implement simple in-memory limiter**

Create `server/auth/rateLimit.ts`:

```ts
interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

const WINDOW_MS = 15 * 60_000  // 15 minutes
const MAX = 5

export interface CheckResult { allowed: boolean; retryAfterSec: number }

export function checkRateLimit(key: string, now = Date.now()): CheckResult {
  let b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS }
    buckets.set(key, b)
  }
  b.count += 1
  if (b.count > MAX) {
    return { allowed: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) }
  }
  return { allowed: true, retryAfterSec: 0 }
}

// Test helper
export function _resetRateLimit() { buckets.clear() }
```

- [ ] **Step 2: Apply to login route**

Edit `server/auth/routes.ts`. Add import:

```ts
import { checkRateLimit } from './rateLimit'
```

In the `r.post('/login', ...)` handler, at the very top of the function body (before parsing the body), add:

```ts
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const rl = checkRateLimit(`login:${ip}`)
    if (!rl.allowed) {
      return c.json({ error: 'too many attempts' }, 429, { 'retry-after': String(rl.retryAfterSec) })
    }
```

- [ ] **Step 3: Quick test in existing routes.test.ts**

Append to `server/auth/routes.test.ts`:

```ts
import { _resetRateLimit } from './rateLimit'

describe('rate limit', () => {
  beforeEach(() => _resetRateLimit())
  it('returns 429 after 5 failed attempts', async () => {
    const { app } = await setup()
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
        body: JSON.stringify({ email: 'a@b.c', password: 'wrong' }),
      })
      expect(res.status).toBe(401)
    }
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ email: 'a@b.c', password: 'wrong' }),
    })
    expect(res.status).toBe(429)
  })
})
```

(Note: this references `setup` as a function; refactor the existing top-of-file `setup` into an exported function in the same file so the new describe block can call it. Concretely: change `async function setup()` to `export async function setup()`. Actually it's in the same module so just keep it as is — that's already accessible.)

- [ ] **Step 4: Run all auth tests**

Run: `pnpm test -- server/auth/routes`
Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add server/auth/rateLimit.ts server/auth/routes.ts server/auth/routes.test.ts
git commit -m "feat(auth): in-memory rate limit on login (5/15min per IP)"
```

---

## Task 20: README update and final cleanup

**Files:**
- Modify: `README.md`
- Delete: any orphan files (`.env.local.example` if obsolete, dead imports)

- [ ] **Step 1: Rewrite README**

Replace `README.md` with:

```markdown
# VMP M Trenažér

Webová appka na trénink otázek pro zkoušku VMP M (Vůdce malého plavidla, kategorie M 2015).

![Přehled](docs/images/home.png)

## Architektura

- Frontend: Vite + React 19 SPA
- API: Hono + Drizzle ORM nad libSQL (SQLite dialect)
- Auth: session cookie + argon2, uživatelé se zakládají ručně CLI
- Deploy: Vercel + Turso (free), nebo single-container Docker (SQLite v volume)

## Setup (jednorázově)

```bash
pnpm install
pnpm scrape                        # stáhne otázky a obrázky ze spspraha.cz
cp .env.example .env.local
pnpm db:migrate                    # vytvoří data/app.db
pnpm user:add <email>              # založí prvního uživatele
```

## Spuštění (lokálně)

```bash
pnpm dev                           # vite + hono současně
```

http://localhost:5400 — frontend (Vite). Vite proxy posílá `/api/*` do Hono na portu 3001.

## Deploy: Vercel + Turso

1. Založit Turso DB: `turso db create vmp` + token: `turso db tokens create vmp`.
2. Na Vercelu nastavit env vars:
   - `DATABASE_URL=libsql://<db>-<org>.turso.io`
   - `DATABASE_AUTH_TOKEN=<token>`
   - `SESSION_COOKIE_SECURE=true`
3. `vercel deploy`. Build step (`vercel.json`) spustí `pnpm db:migrate` a pak `pnpm build`.
4. Uživatele zakládat lokálně proti hostované DB:
   ```bash
   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... pnpm user:add <email>
   ```

## Deploy: Docker (self-host)

```bash
docker build -t vmp-trainer -f docker/Dockerfile .
docker run -d -p 3000:3000 -v $(pwd)/data:/data vmp-trainer
docker exec -it <container> pnpm user:add <email>
```

Volume `/data` drží SQLite soubor — přežije restart.

## Skripty

| Skript | Co dělá |
|---|---|
| `pnpm dev` | dev server (vite + hono) |
| `pnpm dev:vite` | jen frontend |
| `pnpm dev:api` | jen API |
| `pnpm build` | produkční build do `dist/` |
| `pnpm test` | spustí vitest |
| `pnpm scrape` | scraper otázek |
| `pnpm db:generate` | generuje migrace z drizzle schema |
| `pnpm db:migrate` | aplikuje migrace |
| `pnpm user:add <email>` | založí uživatele (interaktivně se zeptá na heslo) |
| `pnpm package-skill` | zazipuje skill `explain-vmp-question` (pro batch generování vysvětlení) |
| `pnpm batch-explanations` | batch generuje chybějící vysvětlení do `public/explanations/` |

## Skill (jen pro generování vysvětlení)

Skill `explain-vmp-question` (v `.claude/skills/`) používá pouze offline batch skript pro generování statických vysvětlení do `public/explanations/`. V samotné appce se nepoužívá — appka jen servíruje statické HTML soubory a tlačítko "💬 Zeptat se Claude" otevírá Claude Desktop deeplink pro doplňující dotazy.

## Módy

- **Ostrý test** — 35 otázek, 30 minut, struktura 16/7/5/3/4
- **Procvičování** — buď struktura ostrého testu (bez timeru), nebo vlastní výběr oblastí
- **Slabiny** — automaticky vybere 20 otázek které pleteš
- **Statistiky** — úspěšnost po skupinách + historie testů

Progress je v DB (libSQL), per-uživatel. Vysvětlení jsou statické HTML soubory committnuté v `public/explanations/`.
```

- [ ] **Step 2: Final test run**

Run: `pnpm test`
Expected: all PASS.

Run: `pnpm build`
Expected: SPA builds into `dist/`.

- [ ] **Step 3: End-to-end smoke**

```bash
rm -rf data/app.db
DATABASE_URL=file:./data/app.db pnpm db:migrate
DATABASE_URL=file:./data/app.db pnpm user:add david@keboola.com    # interactive
DATABASE_URL=file:./data/app.db PORT=3001 SESSION_COOKIE_SECURE=false pnpm dev:api &
pnpm preview &   # serves built dist/ on :5400
sleep 2
# Manually browse http://localhost:5400, log in, answer a question, refresh, verify it persisted.
kill %1 %2
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for hosted-app architecture"
```

---

## Self-Review Notes

Run through this once after completing all tasks:

1. **Open the spec**: `docs/superpowers/specs/2026-05-12-hosted-app-design.md`. Walk each section and find the task that implements it:
   - Stack table → Tasks 1, 3, 4, 5
   - Schema → Task 3
   - API surface (`/api/auth/*`, `/api/me`, `/api/progress`, `/api/attempts`, `/api/test-history`) → Tasks 8, 10, 11, 12
   - Auth flow (slide expiry, cookie attrs, manual user create) → Tasks 6, 7, 8, 9
   - Frontend changes (BrowserRouter, RequireAuth, Login, useAuth, useProgress refactor, Settings, claudeDesktopLink) → Tasks 13, 14, 15, 16
   - Vercel deploy → Task 17
   - Docker deploy → Task 18
   - Rate limit → Task 19
   - Tests (`server/auth.test.ts`, `server/progress.test.ts`, useProgress mock-fetch) → Tasks 5, 6, 8, 10, 11, 12, 14
   - Migration import → Task 12 + Task 16 UI
   - Static explanations remain on disk → Task 2

2. **Files touched outside `server/` / `src/`** — git mv of `explanations/`, `vite.config.ts`, `package.json`, `vercel.json`, `docker/Dockerfile`, `.dockerignore`, `.gitignore`, `.env.example`, `README.md`. All listed in their respective tasks.

3. **`useExplanations` deliberately unchanged** — it already fetches `/explanations/q-{id}.html` which is now served from `public/explanations/` by Vite/Hono static; no code change required.
