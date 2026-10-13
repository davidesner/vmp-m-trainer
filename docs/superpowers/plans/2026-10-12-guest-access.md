# Guest Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone use the app without an account ("Pokračovat bez přihlášení") while hiding every feature derived from stored data behind a "přihlas se" lock.

**Architecture:** A guest is a real `users` row with `is_guest = 1` and a normal session cookie, so existing write endpoints keep recording attempts/test history for monitoring. A new `requireRegistered()` middleware blocks guests from the read/manage side of `/api/progress`. On the client, `useAuth` exposes guest status, `useProgress` stops reading/optimistically updating for guests, and a `LockedFeature` card replaces Home's estimate, `/weak`, `/stats` and the weak-based practice modes.

**Tech Stack:** Hono, Drizzle ORM + libSQL (SQLite), drizzle-kit migrations, React 19 + react-router 6, Tailwind, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-12-guest-access-design.md`

## Global Constraints

- The words "anonymní" / "anonymous" must not appear in UI copy or in new code identifiers. UI says "nepřihlášen" / "bez přihlášení"; code says `guest`.
- No PII for guests. Guest row: `email = 'guest:<uuid>'`, `password_hash = ''`, `is_guest = 1`. The placeholder email never leaves the server (`email: null` in API responses).
- Migration is additive only: `ALTER TABLE users ADD is_guest integer DEFAULT 0 NOT NULL`. No table rebuild, `email`/`password_hash` stay `NOT NULL`.
- No merge of guest data into an account on login/register.
- Guests: `GET`/`DELETE /api/progress` and `POST /api/progress/import` -> 403 `{ error: 'account required' }`. `POST /api/attempts`, `POST /api/test-history`, `POST /api/feedback`, `POST /api/auth/logout` stay allowed.
- Exact UI copy:
  - Login button: `Pokračovat bez přihlášení`
  - Lock card: `Přihlas se a uvidíš odhad úspěchu, slabiny a historii testů`
  - Practice hint: `Dostupné po přihlášení`
  - Sidebar status: `Nepřihlášen` + link `Přihlásit se`
- Do not commit with any AI-attribution trailer. Do not use em-dashes in copy or comments.

## Review Focus

1. **Shared IP (school / office NAT) creating guests.** Many people behind one IP must not be locked out after 5 guests. Expect a higher, separate limit for guest creation (20 per 15 min per IP). Pinned in Task 2.
2. **Calling `/api/auth/guest` twice from the same browser** (double click, page reload). Expect the same guest, no second `users` row. Pinned in Task 2.
3. **A registered user with a valid session hitting `/api/auth/guest`** (e.g. stale tab). Expect their own account returned, never downgraded to a guest session. Pinned in Task 2.
4. **Guest store leaking via optimistic updates** after answering questions in Procvičování or the test, then visiting Home. Expect nothing derived to appear. Pinned in Task 5.
5. **`useProgress` firing `GET /api/progress` before `/api/me` resolves** (a 403 or, worse, the previous user's data). Expect no progress fetch until auth has loaded, and none for a guest. Pinned in Task 5.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `server/db/schema.ts` | modify | `isGuest` column on `users` |
| `server/db/migrations/0002_*.sql` (+ `meta/`) | create (generated) | additive migration |
| `server/types.ts` | modify | `AuthUser` gains `email: string \| null`, `guest: boolean` |
| `server/auth/middleware.ts` | modify | `loadUser` sets guest fields; new `requireRegistered()` |
| `server/auth/rateLimit.ts` | modify | optional `max` parameter |
| `server/auth/routes.ts` | modify | `POST /guest`; login rejects guest rows; login/register drop a guest session |
| `server/auth/guest.test.ts` | create | guest auth tests |
| `server/routes/progress.ts` | modify | use `requireRegistered()` |
| `server/routes/guest-access.test.ts` | create | guest permission tests |
| `server/auth/routes.test.ts` | modify | `/api/me` shape now includes `guest` |
| `src/hooks/useAuth.tsx` | modify | `guest` on user, `loginAsGuest`, `useGuestStatus` |
| `src/routes/Login.tsx` | modify | guest button |
| `src/routes/Login.test.tsx` | create | guest button test |
| `src/components/RequireAuth.test.tsx` | modify | guest admitted |
| `src/hooks/useProgress.ts` | modify | guest: no fetch, no optimistic update, no reset |
| `src/hooks/useProgress.test.tsx` | modify | guest tests |
| `src/components/LockedFeature.tsx` | create | lock card |
| `src/routes/Home.tsx`, `Weak.tsx`, `Stats.tsx` | modify | guest branches |
| `src/routes/guestLocked.test.tsx` | create | Home/Weak/Stats guest tests |
| `src/routes/Practice.tsx`, `Settings.tsx`, `src/components/Sidebar.tsx` | modify | guest branches |
| `src/routes/Practice.guest.test.tsx` | create | practice mix lock test |

---

### Task 0: Environment

- [ ] **Step 1: Branch and install**

```bash
git checkout -b feat/guest-access
pnpm install
```

- [ ] **Step 2: Baseline**

Run: `pnpm test`
Expected: all tests pass. If anything fails before you change code, stop and report it.

---

### Task 1: Schema, migration and guest-aware auth context

**Files:**
- Modify: `server/db/schema.ts`, `server/types.ts`, `server/auth/middleware.ts`, `server/auth/routes.ts`, `server/auth/routes.test.ts`
- Create: `server/db/migrations/0002_*.sql` (generated), `server/auth/guest.test.ts`

**Interfaces:**
- Produces: `users.isGuest: boolean` (Drizzle), `AuthUser = { id: string; email: string | null; guest: boolean }`. `/api/me` returns `AuthUser`.

- [ ] **Step 1: Write the failing tests** in `server/auth/guest.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb } from '../db/client.js'
import { users, sessions } from '../db/schema.js'
import { hashPassword } from './password.js'
import { createSession } from './sessions.js'
import { buildApp } from '../index.js'
import { _resetRateLimit } from './rateLimit.js'

async function setup() {
  _resetRateLimit()
  const db = createDb(':memory:')
  await db.applyMigrations()
  await db.db.insert(users).values({
    id: 'u1', email: 'a@b.c',
    passwordHash: await hashPassword('hunter2'),
    createdAt: new Date().toISOString(),
  })
  await db.db.insert(users).values({
    id: 'g1', email: 'guest:g1', passwordHash: '', isGuest: true,
    createdAt: new Date().toISOString(),
  })
  const app = buildApp({ db, cookieSecure: false, signupCode: 'CODE' }).app
  return { db, app }
}

function login(app: Awaited<ReturnType<typeof setup>>['app'], body: unknown, cookie?: string) {
  return app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  })
}

describe('guest auth context', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { ctx = await setup() })

  it('existing users default to is_guest = false', async () => {
    const [u] = await ctx.db.db.select().from(users).where(eq(users.id, 'u1'))
    expect(u.isGuest).toBe(false)
  })

  it('/api/me reports guest: true and hides the placeholder email', async () => {
    const sid = await createSession(ctx.db.db, 'g1')
    const res = await ctx.app.request('/api/me', { headers: { cookie: `sid=${sid}` } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'g1', email: null, guest: true })
  })

  it('/api/me reports guest: false for a registered user', async () => {
    const sid = await createSession(ctx.db.db, 'u1')
    const res = await ctx.app.request('/api/me', { headers: { cookie: `sid=${sid}` } })
    expect(await res.json()).toEqual({ id: 'u1', email: 'a@b.c', guest: false })
  })

  it('login cannot authenticate a guest row', async () => {
    const res = await login(ctx.app, { email: 'guest:g1', password: '' })
    expect(res.status).toBe(400) // empty password is already a bad request
    const res2 = await login(ctx.app, { email: 'guest:g1', password: 'anything' })
    expect(res2.status).toBe(401)
    expect(await ctx.db.db.select().from(sessions)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run server/auth/guest.test.ts`
Expected: FAIL (`isGuest` unknown column / `guest` missing from `/api/me`).

- [ ] **Step 3: Add the column** in `server/db/schema.ts`, inside `users` after `passwordHash`:

```ts
  isGuest: integer('is_guest', { mode: 'boolean' }).notNull().default(false),
```

- [ ] **Step 4: Generate the migration**

Run: `pnpm db:generate`
Then open the new `server/db/migrations/0002_*.sql`. It must contain exactly one statement:

```sql
ALTER TABLE `users` ADD `is_guest` integer DEFAULT false NOT NULL;
```

(`false` or `0` are both fine.) If it contains `CREATE TABLE __new_users`, `DROP TABLE` or `PRAGMA foreign_keys`, STOP: the schema change is wrong, revert and fix it. A rebuild would cascade-delete sessions and attempts.

- [ ] **Step 5: Update types** in `server/types.ts`:

```ts
export interface AuthUser {
  id: string
  /** null for guests; the stored placeholder never leaves the server */
  email: string | null
  guest: boolean
}
```

- [ ] **Step 6: Update `loadUser`** in `server/auth/middleware.ts`, replacing the `c.set('user', ...)` line:

```ts
        const guest = row.user.isGuest
        c.set('user', { id: row.user.id, email: guest ? null : row.user.email, guest })
```

- [ ] **Step 7: Reject guest rows at login** in `server/auth/routes.ts`, replace `if (!user) return c.json({ error: 'invalid credentials' }, 401)` in `/login` with:

```ts
    if (!user || user.isGuest) return c.json({ error: 'invalid credentials' }, 401)
```

Also update the login and register success responses so they match `AuthUser`:
- login: `return c.json({ id: user.id, email: user.email, guest: false })`
- register: `return c.json({ id, email, guest: false }, 201)`

- [ ] **Step 8: Fix the existing expectation** in `server/auth/routes.test.ts`:

```ts
    expect(await res.json()).toEqual({ id: 'u1', email: 'a@b.c', guest: false })
```

Run `grep -rn "email: 'a@b.c' })" server src` and update any other strict `/api/me` or login-response equality the same way.

- [ ] **Step 9: Run server tests**

Run: `pnpm vitest run server`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add server/db/schema.ts server/db/migrations server/types.ts server/auth/middleware.ts server/auth/routes.ts server/auth/routes.test.ts server/auth/guest.test.ts
git commit -m "Add is_guest flag to users and expose guest status in auth context"
```

---

### Task 2: `POST /api/auth/guest` and dropping guest sessions on login/register

**Files:**
- Modify: `server/auth/rateLimit.ts`, `server/auth/routes.ts`
- Test: `server/auth/guest.test.ts`

**Interfaces:**
- Consumes: `users.isGuest`, `AuthUser` from Task 1.
- Produces: `POST /api/auth/guest` -> 201 `{ id, email: null, guest: true }` + `sid` cookie, or 200 with the current `AuthUser` when a session exists, or 429. `checkRateLimit(key: string, now?: number, max?: number)`.

- [ ] **Step 1: Write the failing tests**, append to `server/auth/guest.test.ts`:

```ts
function guest(app: Awaited<ReturnType<typeof setup>>['app'], opts: { cookie?: string; ip?: string } = {}) {
  return app.request('/api/auth/guest', {
    method: 'POST',
    headers: {
      'x-forwarded-for': opts.ip ?? '7.7.7.7',
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
  })
}

describe('POST /api/auth/guest', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { ctx = await setup() })

  it('creates a guest row and session cookie without a signup code', async () => {
    const res = await guest(ctx.app)
    expect(res.status).toBe(201)
    const body = await res.json() as { id: string; email: null; guest: true }
    expect(body).toEqual({ id: expect.any(String), email: null, guest: true })
    expect(res.headers.get('set-cookie')).toMatch(/^sid=[a-f0-9]{64}/)
    const [row] = await ctx.db.db.select().from(users).where(eq(users.id, body.id))
    expect(row.isGuest).toBe(true)
    expect(row.email).toBe(`guest:${body.id}`)
    expect(row.passwordHash).toBe('')
  })

  it('returns the same guest when called again with its cookie', async () => {
    const first = await guest(ctx.app)
    const cookie = first.headers.get('set-cookie')!.split(';')[0]
    const { id } = await first.json() as { id: string }
    const second = await guest(ctx.app, { cookie })
    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ id, email: null, guest: true })
    expect(await ctx.db.db.select().from(users).where(eq(users.isGuest, true))).toHaveLength(2) // g1 + this one
  })

  it('returns the registered user unchanged when a registered session exists', async () => {
    const sid = await createSession(ctx.db.db, 'u1')
    const res = await guest(ctx.app, { cookie: `sid=${sid}` })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'u1', email: 'a@b.c', guest: false })
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('allows 20 guests per IP per window, then 429', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await guest(ctx.app, { ip: '5.5.5.5' })).status).toBe(201)
    }
    const res = await guest(ctx.app, { ip: '5.5.5.5' })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toMatch(/^\d+$/)
    expect((await guest(ctx.app, { ip: '6.6.6.6' })).status).toBe(201)
  })

  it('login while holding a guest session deletes that session but keeps the guest row', async () => {
    const g = await guest(ctx.app)
    const cookie = g.headers.get('set-cookie')!.split(';')[0]
    const { id: guestId } = await g.json() as { id: string }
    const res = await login(ctx.app, { email: 'a@b.c', password: 'hunter2' }, cookie)
    expect(res.status).toBe(200)
    expect(await ctx.db.db.select().from(sessions).where(eq(sessions.userId, guestId))).toHaveLength(0)
    expect(await ctx.db.db.select().from(users).where(eq(users.id, guestId))).toHaveLength(1)
  })

  it('register while holding a guest session deletes that session', async () => {
    const g = await guest(ctx.app)
    const cookie = g.headers.get('set-cookie')!.split(';')[0]
    const { id: guestId } = await g.json() as { id: string }
    const res = await ctx.app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, 'x-forwarded-for': '8.8.8.8' },
      body: JSON.stringify({ email: 'new@b.c', password: 'longenough', code: 'CODE' }),
    })
    expect(res.status).toBe(201)
    expect(await ctx.db.db.select().from(sessions).where(eq(sessions.userId, guestId))).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run server/auth/guest.test.ts`
Expected: FAIL (404 on `/api/auth/guest`, guest sessions not deleted).

- [ ] **Step 3: Add `max` to the rate limiter** in `server/auth/rateLimit.ts`:

```ts
export function checkRateLimit(key: string, now = Date.now(), max = MAX): CheckResult {
```

and change `if (b.count > MAX) {` to `if (b.count > max) {`.

- [ ] **Step 4: Implement the endpoint and session handoff** in `server/auth/routes.ts`.

Below `SESSION_COOKIE` add:

```ts
// Guests are cheap to create and often share an IP (school, office NAT).
const GUEST_RATE_MAX = 20
```

Inside `authRoutes`, add a helper after `const signupEnabled = ...`:

```ts
  /** A guest signing in or registering leaves its session behind; its row stays as usage history. */
  async function dropGuestSession(c: Context<AppEnv>) {
    const sid = c.get('sid')
    if (sid && c.get('user')?.guest) await deleteSession(opts.db.db, sid)
  }
```

(import `type Context` from `'hono'`). Call `await dropGuestSession(c)` in `/register` right before `const sid = await createSession(opts.db.db, id)`, and in `/login` right before `const sid = await createSession(opts.db.db, user.id)`.

Add the route before `/login`:

```ts
  r.post('/guest', async c => {
    const current = c.get('user')
    if (current) return c.json(current, 200)

    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const rl = checkRateLimit(`guest:${ip}`, Date.now(), GUEST_RATE_MAX)
    if (!rl.allowed) {
      return c.json({ error: 'too many attempts' }, 429, { 'retry-after': String(rl.retryAfterSec) })
    }

    const id = randomUUID()
    await opts.db.db.insert(users).values({
      id,
      email: `guest:${id}`,
      passwordHash: '',
      isGuest: true,
      createdAt: new Date().toISOString(),
    })
    const sid = await createSession(opts.db.db, id)
    setCookie(c, COOKIE_NAME, sid, { ...SESSION_COOKIE, secure: opts.cookieSecure })
    return c.json({ id, email: null, guest: true }, 201)
  })
```

- [ ] **Step 5: Run server tests**

Run: `pnpm vitest run server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/auth/rateLimit.ts server/auth/routes.ts server/auth/guest.test.ts
git commit -m "Add POST /api/auth/guest and drop guest session on login/register"
```

---

### Task 3: `requireRegistered()` on progress routes

**Files:**
- Modify: `server/auth/middleware.ts`, `server/routes/progress.ts`
- Create: `server/routes/guest-access.test.ts`

**Interfaces:**
- Consumes: `AuthUser.guest` (Task 1), `POST /api/auth/guest` (Task 2).
- Produces: `requireRegistered(): MiddlewareHandler<AppEnv>` -> 401 without user, 403 `{ error: 'account required' }` for guests.

- [ ] **Step 1: Write the failing tests** in `server/routes/guest-access.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb } from '../db/client.js'
import { attempts, testHistory } from '../db/schema.js'
import { buildApp } from '../index.js'
import { _resetRateLimit } from '../auth/rateLimit.js'

async function setup() {
  _resetRateLimit()
  const db = createDb(':memory:')
  await db.applyMigrations()
  const app = buildApp({ db, cookieSecure: false }).app
  const g = await app.request('/api/auth/guest', { method: 'POST' })
  const cookie = g.headers.get('set-cookie')!.split(';')[0]
  const { id } = await g.json() as { id: string }
  return { db, app, cookie, guestId: id }
}

describe('guest permissions', () => {
  let ctx: Awaited<ReturnType<typeof setup>>
  beforeEach(async () => { ctx = await setup() })

  it.each([
    ['GET', '/api/progress?testId=M'],
    ['DELETE', '/api/progress?testId=M'],
    ['POST', '/api/progress/import'],
  ])('%s %s -> 403', async (method, url) => {
    const res = await ctx.app.request(url, {
      method,
      headers: { cookie: ctx.cookie, 'content-type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ testId: 'M', questions: {}, testHistory: [] }) : undefined,
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'account required' })
  })

  it('still 401 on progress without any session', async () => {
    expect((await ctx.app.request('/api/progress')).status).toBe(401)
  })

  it('records attempts under the guest id', async () => {
    const res = await ctx.app.request('/api/attempts', {
      method: 'POST',
      headers: { cookie: ctx.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ testId: 'M', questionId: 3, correct: true, mode: 'practice' }),
    })
    expect(res.status).toBe(201)
    expect(await ctx.db.db.select().from(attempts).where(eq(attempts.userId, ctx.guestId))).toHaveLength(1)
  })

  it('records test history under the guest id', async () => {
    const res = await ctx.app.request('/api/test-history', {
      method: 'POST',
      headers: { cookie: ctx.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ testId: 'M', score: 30, total: 35, durationSec: 900, perGroup: {}, questionIds: [1, 2] }),
    })
    expect(res.status).toBe(201)
    expect(await ctx.db.db.select().from(testHistory).where(eq(testHistory.userId, ctx.guestId))).toHaveLength(1)
  })

  it('guest DELETE does not remove recorded attempts', async () => {
    await ctx.app.request('/api/attempts', {
      method: 'POST',
      headers: { cookie: ctx.cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ testId: 'M', questionId: 3, correct: true, mode: 'practice' }),
    })
    await ctx.app.request('/api/progress', { method: 'DELETE', headers: { cookie: ctx.cookie } })
    expect(await ctx.db.db.select().from(attempts)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run server/routes/guest-access.test.ts`
Expected: the three 403 cases and the DELETE case FAIL; attempts/test-history PASS.

- [ ] **Step 3: Add the middleware** to `server/auth/middleware.ts`:

```ts
/** Like requireAuth, but guests are refused: stored data is only shown to account holders. */
export function requireRegistered(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'unauthorized' }, 401)
    if (user.guest) return c.json({ error: 'account required' }, 403)
    await next()
  }
}
```

- [ ] **Step 4: Use it** in `server/routes/progress.ts`: change the import to `import { requireRegistered } from '../auth/middleware.js'` and `r.use('*', requireAuth())` to `r.use('*', requireRegistered())`.

- [ ] **Step 5: Run server tests**

Run: `pnpm vitest run server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/auth/middleware.ts server/routes/progress.ts server/routes/guest-access.test.ts
git commit -m "Refuse guests on progress read/reset/import endpoints"
```

---

### Task 4: Client auth: guest status, `loginAsGuest`, Login button

**Files:**
- Modify: `src/hooks/useAuth.tsx`, `src/routes/Login.tsx`, `src/components/RequireAuth.test.tsx`
- Create: `src/routes/Login.test.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/guest`, `/api/me` shape from Tasks 1-2.
- Produces (exported from `src/hooks/useAuth.tsx`):
  - `interface AuthUser { id: string; email: string | null; guest: boolean }`
  - `useAuth()` gains `loginAsGuest: () => Promise<AuthResult>`
  - `useGuestStatus(): { isGuest: boolean; authLoading: boolean }` - safe outside `<AuthProvider>` (returns `{ isGuest: false, authLoading: false }`), so hooks tested without the provider keep working.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/RequireAuth.test.tsx` inside the `describe`:

```tsx
  it('renders children for a guest', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ id: 'g1', email: null, guest: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    )
    render(<App />)
    await waitFor(() => expect(screen.getByText('SecretPage')).toBeInTheDocument())
  })
```

Create `src/routes/Login.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../hooks/useAuth'
import Login from './Login'

afterEach(() => vi.restoreAllMocks())

describe('Login guest entry', () => {
  it('"Pokračovat bez přihlášení" creates a guest session and navigates home', async () => {
    const calls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      calls.push(`${init?.method ?? 'GET'} ${url}`)
      if (url === '/api/auth/guest') {
        return new Response(JSON.stringify({ id: 'g1', email: null, guest: true }), { status: 201, headers: { 'content-type': 'application/json' } })
      }
      if (url === '/api/auth/config') return new Response(JSON.stringify({ signupEnabled: false }), { status: 200 })
      return new Response('', { status: 401 })
    })
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<div>HomePage</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Pokračovat bez přihlášení' }))
    await waitFor(() => expect(screen.getByText('HomePage')).toBeInTheDocument())
    expect(calls).toContain('POST /api/auth/guest')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/components/RequireAuth.test.tsx src/routes/Login.test.tsx`
Expected: Login test FAILS (button not found). The RequireAuth guest case may already pass, which is fine; it pins behaviour.

- [ ] **Step 3: Update `src/hooks/useAuth.tsx`**

Replace `interface AuthUser { id: string; email: string }` with:

```ts
export interface AuthUser { id: string; email: string | null; guest: boolean }
```

Add `loginAsGuest: () => Promise<AuthResult>` to `AuthCtx`. Inside `AuthProvider`, after `register`:

```ts
  const loginAsGuest = useCallback(async () => {
    const res = await fetch('/api/auth/guest', { method: 'POST', credentials: 'same-origin' })
    if (res.ok) {
      setUser(await res.json())
      return { ok: true }
    }
    return { ok: false, error: res.status === 429 ? 'Příliš mnoho pokusů, zkus to za chvíli' : `HTTP ${res.status}` }
  }, [])
```

Add `loginAsGuest` to the provider `value`. At the bottom of the file:

```ts
/** Guest flag for hooks that may render outside <AuthProvider> (e.g. in unit tests). */
export function useGuestStatus(): { isGuest: boolean; authLoading: boolean } {
  const v = useContext(Ctx)
  if (!v) return { isGuest: false, authLoading: false }
  return { isGuest: v.user?.guest === true, authLoading: v.loading }
}
```

- [ ] **Step 4: Add the button** in `src/routes/Login.tsx`. Pull `loginAsGuest` from `useAuth()`. Extract the redirect into a helper used by both handlers:

```tsx
  function goBack() {
    const to = (location.state as LocationState | null)?.from?.pathname ?? '/'
    navigate(to, { replace: true })
  }

  async function onGuest() {
    setError(null)
    setBusy(true)
    const res = await loginAsGuest()
    setBusy(false)
    if (res.ok) goBack()
    else setError(res.error ?? 'Chyba')
  }
```

Replace the two lines in `onSubmit`'s `if (res.ok)` branch with `goBack()`. After the `{signupEnabled && (...)}` block, still inside the `<form>`:

```tsx
        <div className="mt-6 pt-4 border-t border-neutral-200">
          <button type="button" onClick={() => void onGuest()} disabled={busy}
            className="w-full border border-neutral-300 rounded py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
            Pokračovat bez přihlášení
          </button>
        </div>
```

- [ ] **Step 5: Run client tests**

Run: `pnpm vitest run src`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useAuth.tsx src/routes/Login.tsx src/routes/Login.test.tsx src/components/RequireAuth.test.tsx
git commit -m "Add guest entry on login page and guest status to useAuth"
```

---

### Task 5: `useProgress` for guests

**Files:**
- Modify: `src/hooks/useProgress.ts`
- Test: `src/hooks/useProgress.test.tsx`

**Interfaces:**
- Consumes: `useGuestStatus()` (Task 4).
- Produces: same `useProgress()` return shape. For guests: `store` always empty, no `GET /api/progress`, `recordAttempt`/`recordTestHistory` POST without touching `store`, `reset` is a no-op.

- [ ] **Step 1: Write the failing tests**, append to `src/hooks/useProgress.test.tsx`:

```tsx
import { AuthProvider } from './useAuth'

function mockAuthServer(me: object | null, delayMeMs = 0) {
  const calls: string[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (url === '/api/auth/config') return new Response(JSON.stringify({ signupEnabled: false }), { status: 200 })
    if (url === '/api/me') {
      if (delayMeMs) await new Promise(r => setTimeout(r, delayMeMs))
      return me ? new Response(JSON.stringify(me), { status: 200 }) : new Response('', { status: 401 })
    }
    if (url.startsWith('/api/progress')) return new Response(JSON.stringify({ attempts: [], testHistory: [] }), { status: 200 })
    if (url === '/api/attempts' || url === '/api/test-history') return new Response(null, { status: 201 })
    return new Response('not found', { status: 404 })
  })
  return calls
}

function authWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider><ActiveTestProvider>{children}</ActiveTestProvider></AuthProvider>
}

describe('useProgress for guests', () => {
  afterEach(() => vi.restoreAllMocks())

  it('never fetches /api/progress for a guest, even while /api/me is pending', async () => {
    const calls = mockAuthServer({ id: 'g1', email: null, guest: true }, 30)
    renderHook(() => useProgress(), { wrapper: authWrapper })
    await waitFor(() => expect(calls).toContain('GET /api/me'))
    await new Promise(r => setTimeout(r, 80))
    expect(calls.some(c => c.includes('/api/progress'))).toBe(false)
  })

  it('records attempts and test history on the server without updating the store', async () => {
    const calls = mockAuthServer({ id: 'g1', email: null, guest: true })
    const { result } = renderHook(() => useProgress(), { wrapper: authWrapper })
    await waitFor(() => expect(calls).toContain('GET /api/me'))
    await act(async () => {
      await result.current.recordAttempt(5, false, 'practice')
      await result.current.recordTestHistory({ at: 'x', score: 1, total: 2, durationSec: 3, perGroup: {}, questionIds: [5] } as never)
    })
    expect(calls).toContain('POST /api/attempts')
    expect(calls).toContain('POST /api/test-history')
    expect(result.current.store).toEqual({ questions: {}, testHistory: [] })
  })

  it('reset is a no-op for a guest', async () => {
    const calls = mockAuthServer({ id: 'g1', email: null, guest: true })
    const { result } = renderHook(() => useProgress(), { wrapper: authWrapper })
    await waitFor(() => expect(calls).toContain('GET /api/me'))
    await act(async () => { await result.current.reset() })
    expect(calls.some(c => c.startsWith('DELETE'))).toBe(false)
  })

  it('still fetches /api/progress for a registered user once auth resolves', async () => {
    const calls = mockAuthServer({ id: 'u1', email: 'a@b.c', guest: false }, 30)
    renderHook(() => useProgress(), { wrapper: authWrapper })
    await waitFor(() => expect(calls.some(c => c.startsWith('GET /api/progress'))).toBe(true))
    expect(calls.indexOf('GET /api/me')).toBeLessThan(calls.findIndex(c => c.startsWith('GET /api/progress')))
  })
})
```

(Merge the `AuthProvider` import into the file's import block.)

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/hooks/useProgress.test.tsx`
Expected: the new guest tests FAIL; existing tests PASS.

- [ ] **Step 3: Implement** in `src/hooks/useProgress.ts`:

Import `useGuestStatus` from `./useAuth`. In `useProgress()`:

```ts
  const { isGuest, authLoading } = useGuestStatus()
```

Load effect: replace its body start so it bails out for loading/guest, and add both to deps:

```ts
  useEffect(() => {
    let cancelled = false
    setStore(empty)
    // Guests never see stored data; wait for /api/me so we never fetch for the wrong identity.
    if (authLoading || isGuest) return
    void (async () => {
      // ...unchanged...
    })()
    return () => { cancelled = true }
  }, [activeTest, isGuest, authLoading])
```

`recordAttempt`: at the top of the callback, after computing `at`:

```ts
    if (isGuest) {
      // Recorded for monitoring only; never reflected back to a guest.
      try {
        await postWithRetry('/api/attempts', { testId: activeTest, questionId: qid, correct, mode })
      } catch {
        console.warn('Failed to save attempt')
      }
      return
    }
```

Add `isGuest` to its deps. `recordTestHistory`: wrap the optimistic `setStore` in `if (!isGuest) { ... }` and add `isGuest` to deps. `reset`: first line `if (isGuest) return`, add `isGuest` to deps.

- [ ] **Step 4: Run client tests**

Run: `pnpm vitest run src`
Expected: PASS (including the pre-existing `useProgress` tests, which run without `AuthProvider` and get `{ isGuest: false, authLoading: false }`).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgress.ts src/hooks/useProgress.test.tsx
git commit -m "Stop reading and reflecting stored progress for guests"
```

---

### Task 6: `LockedFeature` on Home, `/weak`, `/stats`

**Files:**
- Create: `src/components/LockedFeature.tsx`, `src/routes/guestLocked.test.tsx`
- Modify: `src/routes/Home.tsx`, `src/routes/Weak.tsx`, `src/routes/Stats.tsx`

**Interfaces:**
- Consumes: `useAuth().signupEnabled`, `useGuestStatus()` (Task 4).
- Produces: `export default function LockedFeature({ title }: { title?: string })`.

- [ ] **Step 1: Write the failing tests** in `src/routes/guestLocked.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentType } from 'react'
import type { QuestionsBundle } from '../types'
import Home from './Home'
import Weak from './Weak'
import Stats from './Stats'

const allProgressSpy = vi.hoisted(() => vi.fn())

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ signupEnabled: true }),
  useGuestStatus: () => ({ isGuest: true, authLoading: false }),
}))
vi.mock('../hooks/useQuestions', () => ({
  useQuestions: () => ({
    data: {
      testId: 'M', name: 'M', questions: [], groups: [], testStructure: [],
      passing: { score: 30, total: 35 },
    } as unknown as QuestionsBundle,
    loading: false, error: null,
  }),
}))
vi.mock('../hooks/useProgress', () => ({
  useProgress: () => ({ store: { questions: {}, testHistory: [] } }),
}))
vi.mock('../hooks/useAllProgress', () => ({
  useAllProgress: () => { allProgressSpy(); return { bundles: {}, progressByTest: {}, loading: false, error: null } },
}))
vi.mock('../components/CategorySubtitle', () => ({ default: () => null }))

const LOCK = 'Přihlas se a uvidíš odhad úspěchu, slabiny a historii testů'

function renderRoute(Cmp: ComponentType) {
  render(<MemoryRouter><Cmp /></MemoryRouter>)
}

describe('guest locked screens', () => {
  it('Home shows the lock and keeps the test CTA, without the estimate', async () => {
    renderRoute(Home)
    expect(screen.getByText(LOCK)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Spustit ostrý test/ })).toHaveAttribute('href', '/test')
    expect(screen.queryByText('Odhad úspěchu u zkoušky')).not.toBeInTheDocument()
    expect(screen.queryByText('Po skupinách')).not.toBeInTheDocument()
  })

  it('Weak shows the lock instead of starting practice', async () => {
    renderRoute(Weak)
    expect(screen.getByText(LOCK)).toBeInTheDocument()
  })

  it('Stats shows the lock and never loads all progress', async () => {
    renderRoute(Stats)
    expect(screen.getByText(LOCK)).toBeInTheDocument()
    expect(allProgressSpy).not.toHaveBeenCalled()
  })

  it('lock offers login and, when enabled, register', async () => {
    renderRoute(Weak)
    expect(screen.getByRole('link', { name: 'Přihlásit se' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Vytvořit účet' })).toHaveAttribute('href', '/register')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm vitest run src/routes/guestLocked.test.tsx`
Expected: FAIL (lock text not found; `useAllProgress` called).

- [ ] **Step 3: Create `src/components/LockedFeature.tsx`**

```tsx
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function LockedFeature({ title }: { title?: string }) {
  const { signupEnabled } = useAuth()
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-5 md:p-6">
      {title && <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">{title}</div>}
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>🔒</span>
        <div>
          <p className="text-sm text-neutral-700">Přihlas se a uvidíš odhad úspěchu, slabiny a historii testů</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/login" className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded text-sm font-semibold">
              Přihlásit se
            </Link>
            {signupEnabled && (
              <Link to="/register" className="px-4 py-2 border border-neutral-300 rounded text-sm hover:bg-neutral-50">
                Vytvořit účet
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Home** (`src/routes/Home.tsx`): import `useGuestStatus` and `LockedFeature`. Read `const { isGuest } = useGuestStatus()` together with the other hooks (before any return). Change the loading guard to:

```tsx
  if (loading || !data) return <div className="p-4 md:p-8">Načítám…</div>

  if (isGuest) {
    return (
      <div className="p-4 md:p-8 max-w-5xl">
        <h2 className="text-2xl font-bold mb-1">Přehled</h2>
        <CategorySubtitle withParams className="mb-6" />
        <div className="mb-6 sm:text-right">
          <Link to="/test" className="inline-block w-full sm:w-auto text-center px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded font-semibold transition">
            ▶ Spustit ostrý test
          </Link>
        </div>
        <LockedFeature title="Odhad úspěchu a statistiky" />
      </div>
    )
  }

  if (!pass || !cov) return <div className="p-4 md:p-8">Načítám…</div>
```

- [ ] **Step 5: Weak** (`src/routes/Weak.tsx`): import `useGuestStatus`, `LockedFeature`. Read `const { isGuest } = useGuestStatus()` with the other hooks. In the effect, add `if (!data || isGuest) return` and add `isGuest` to its deps. Before the loading guard:

```tsx
  if (isGuest) return (
    <div className="p-4 md:p-8 max-w-3xl">
      <h2 className="text-2xl font-bold mb-1">Slabiny</h2>
      <CategorySubtitle className="mb-6" />
      <LockedFeature />
    </div>
  )
```

- [ ] **Step 6: Stats** (`src/routes/Stats.tsx`): rename the existing `export default function Stats()` to `function StatsContent()` and add:

```tsx
export default function Stats() {
  const { isGuest } = useGuestStatus()
  if (isGuest) return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h2 className="text-2xl font-bold mb-4">Statistiky</h2>
      <LockedFeature />
    </div>
  )
  return <StatsContent />
}
```

(imports: `useGuestStatus` from `../hooks/useAuth`, `LockedFeature` from `../components/LockedFeature`).

- [ ] **Step 7: Run client tests and typecheck**

Run: `pnpm vitest run src && pnpm exec tsc -p tsconfig.app.json --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/LockedFeature.tsx src/routes/guestLocked.test.tsx src/routes/Home.tsx src/routes/Weak.tsx src/routes/Stats.tsx
git commit -m "Lock pass estimate, weak spots and stats for guests"
```

---

### Task 7: Practice, Sidebar, Settings for guests

**Files:**
- Modify: `src/routes/Practice.tsx`, `src/components/Sidebar.tsx`, `src/routes/Settings.tsx`
- Create: `src/routes/Practice.guest.test.tsx`

**Interfaces:**
- Consumes: `useGuestStatus()` (Task 4), `useAuth().signupEnabled`.

- [ ] **Step 1: Write the failing test** in `src/routes/Practice.guest.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { QuestionsBundle } from '../types'
import Practice from './Practice'

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ signupEnabled: false }),
  useGuestStatus: () => ({ isGuest: true, authLoading: false }),
}))
vi.mock('../hooks/useQuestions', () => ({
  useQuestions: () => ({
    data: { questions: [], groups: [], testStructure: [], passing: { score: 30, total: 35 } } as unknown as QuestionsBundle,
    loading: false, error: null,
  }),
}))
vi.mock('../hooks/useProgress', () => ({ useProgress: () => ({ store: { questions: {}, testHistory: [] } }) }))
vi.mock('../components/CategorySubtitle', () => ({ default: () => null }))

describe('Practice for guests', () => {
  it('defaults to random and disables weak-based modes with a hint', () => {
    render(<MemoryRouter><Practice /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Náhodně' })).toHaveClass('border-primary')
    expect(screen.getByRole('button', { name: '⚖ Mix slabiny + známé' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hlavně slabiny' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Dostupné po přihlášení' })).toHaveAttribute('href', '/login')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/routes/Practice.guest.test.tsx`
Expected: FAIL (buttons enabled, "Mix" selected by default).

- [ ] **Step 3: Practice** (`src/routes/Practice.tsx`):

Imports: `Link` from `react-router-dom`, `useGuestStatus` from `../hooks/useAuth`. In the component:

```tsx
  const { isGuest } = useGuestStatus()
  const [mix, setMix] = useState<MixMode>(isGuest ? 'random' : 'mix')
```

Replace the mix button map with:

```tsx
          {([['random','Náhodně'],['mix','⚖ Mix slabiny + známé'],['weak','Hlavně slabiny']] as const).map(([m, label]) => {
            const locked = isGuest && m !== 'random'
            return (
              <button key={m} onClick={() => setMix(m)} disabled={locked}
                className={`px-3 py-3 rounded text-sm border-2 disabled:opacity-50 disabled:cursor-not-allowed ${mix === m ? 'border-primary bg-primary-light text-primary-dark font-semibold' : 'border-neutral-200'}`}>
                {label}
              </button>
            )
          })}
```

Below the grid, before the `{mix === 'mix' && ...}` paragraph:

```tsx
        {isGuest && (
          <p className="text-xs text-neutral-500 mt-2">
            🔒 Mix a slabiny: <Link to="/login" className="text-accent hover:underline">Dostupné po přihlášení</Link>
          </p>
        )}
```

- [ ] **Step 4: Sidebar** (`src/components/Sidebar.tsx`):

Add `locked?: boolean` to the items:

```ts
const items = [
  { to: '/',         label: '🏠 Přehled' },
  { to: '/practice', label: '📚 Procvičování' },
  { to: '/weak',     label: '🎯 Slabiny',    locked: true },
  { to: '/stats',    label: '📊 Statistiky', locked: true },
  { to: '/settings', label: '⚙ Nastavení' },
]
```

In `NavItems`, read `const { isGuest } = useGuestStatus()` and render `{i.label}{isGuest && i.locked ? ' 🔒' : ''}`. Add a component:

```tsx
function GuestStatus({ onNavigate }: { onNavigate?: () => void }) {
  const { isGuest } = useGuestStatus()
  if (!isGuest) return null
  return (
    <div className="mt-auto pt-4 text-xs text-neutral-500">
      Nepřihlášen ·{' '}
      <Link to="/login" onClick={onNavigate} className="text-accent hover:underline">Přihlásit se</Link>
    </div>
  )
}
```

Import `Link` alongside `NavLink`, and `useGuestStatus` from `../hooks/useAuth`. Render `<GuestStatus onNavigate={() => setMobileOpen(false)} />` in the mobile drawer just above the existing `mt-auto` hint, and change that hint's `mt-auto` to `mt-2` so the two stack at the bottom. Render `<GuestStatus />` after `<NavItems />` in the desktop aside.

- [ ] **Step 5: Settings** (`src/routes/Settings.tsx`): import `useGuestStatus` and `LockedFeature`. After the hooks:

```tsx
  const { isGuest } = useGuestStatus()
  if (isGuest) return (
    <div className="max-w-2xl p-4 md:p-8">
      <h2 className="text-2xl font-bold mb-6">Nastavení</h2>
      <LockedFeature />
    </div>
  )
```

All hooks (`useProgress`, `useAuth`, both `useState`s) must stay above this early return.

- [ ] **Step 6: Run client tests, lint and build**

Run: `pnpm vitest run src && pnpm lint && pnpm build`
Expected: PASS, no lint errors, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/routes/Practice.tsx src/routes/Practice.guest.test.tsx src/components/Sidebar.tsx src/routes/Settings.tsx
git commit -m "Lock weak-based practice, mark locked nav and simplify settings for guests"
```

---

### Task 8: Migration safety check and end-to-end verification

**Files:** none changed (verification only).

- [ ] **Step 1: Migration on a copy of real data**

`server/db/migrate.ts` loads `.env.local`, which may point at production Turso. Always pass `DATABASE_URL` explicitly on the command line (dotenv never overrides an existing env var, and `DATABASE_URL` wins over `TURSO_DATABASE_URL`). Never run `pnpm db:migrate` without it in this task.

If `data/app.db` exists:

```bash
cp data/app.db "$TMPDIR/app-copy.db"
sqlite3 "$TMPDIR/app-copy.db" "select count(*) from users; select count(*) from sessions; select count(*) from attempts; select count(*) from test_history;"
DATABASE_URL="file:$TMPDIR/app-copy.db" pnpm db:migrate
sqlite3 "$TMPDIR/app-copy.db" "select count(*) from users; select count(*) from sessions; select count(*) from attempts; select count(*) from test_history; select count(*) from users where is_guest = 0;"
```

Expected: all four counts identical before and after; the last count equals the user count. If `data/app.db` does not exist, run `pnpm db:migrate` against a fresh `file:$TMPDIR/fresh.db`, insert one user + session + attempt with `sqlite3` before applying `0002` (use `git stash` of the 0002 files to apply 0000-0001 first), then apply 0002 and compare counts.

- [ ] **Step 2: Full suite**

Run: `pnpm test && pnpm lint && pnpm build`
Expected: all green.

- [ ] **Step 3: Manual run in the app** (use the `run` skill or `pnpm dev`)

Check, as a guest from a fresh browser profile:
1. `/login` shows "Pokračovat bez přihlášení"; clicking it lands on Přehled with the lock card and the test CTA.
2. Sidebar shows "Slabiny 🔒", "Statistiky 🔒" and "Nepřihlášen · Přihlásit se" (desktop and mobile drawer).
3. Procvičování: only "Náhodně" is enabled; a run works and rows appear in `attempts` under the guest's user id.
4. Ostrý test: completes, results screen shows; a `test_history` row is written.
5. `/weak`, `/stats`, `/settings` show the lock card; the network tab shows no `/api/progress` request.
6. Clicking "Přihlásit se" and logging in as a real user shows that user's normal data; the guest's session row is gone, its `users` row remains.
7. `grep -rni "anonym" src server` returns nothing new.

- [ ] **Step 4: Commit any fixes** found in steps 1-3 with a descriptive message, then hand off via superpowers:finishing-a-development-branch.
