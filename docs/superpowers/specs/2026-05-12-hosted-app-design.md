# VMP Trenažér — Hosted App Design

**Date:** 2026-05-12
**Branch:** `feat/hosted-app`
**Status:** draft for review

## Goal

Turn the local-only VMP M trainer into a hostable web app with per-user accounts and server-persisted progress, while keeping the codebase as light as possible. Two supported deploy targets from one codebase:

1. **Free hosted:** Vercel (SPA + serverless functions) + Neon (Postgres).
2. **Self-host:** `docker compose up` — Node container + Postgres container with a mounted volume.

## Non-goals

- No public registration, no password reset, no email verification. Users are added manually via a CLI script.
- No migration of existing static `explanations/*.html` into the database — they remain static assets.
- No SSR, no Next.js, no auth library (Auth.js / NextAuth / Lucia). Hand-rolled session cookies.
- No Redis, queue, or cache layer.
- No e2e tests for this phase.

## Stack

| Concern | Choice | Reason |
|---|---|---|
| Frontend | Existing Vite + React 19 + Tailwind SPA | Keep current code; only swap router + progress hook. |
| API server | [Hono](https://hono.dev) | Runs identically as a Node process and as a Vercel serverless function via `app.fetch`. |
| DB | Postgres | User already has a working Vercel+Neon / docker-compose pattern. |
| DB driver | `postgres` (postgres.js) | Lean, works in both Node and Vercel runtimes. |
| ORM | Drizzle ORM | Typed schema, simple migrations, small footprint. |
| Migrations | `drizzle-kit` | Generated SQL, run on app start or via `pnpm db:migrate`. |
| Password hashing | `@node-rs/argon2` | Modern default; fast in Node. |
| Sessions | Plain cookie (`sid=<random>`) + `sessions` table | ~50 lines; no library needed. |

## Architecture

```
┌──────────────────┐    cookie     ┌────────────────┐
│ Vite SPA (React) │ ────────────▶ │ Hono /api/*    │
│  routes, hooks   │ ◀──────────── │ session middl. │
└──────────────────┘     json      └──────┬─────────┘
                                          │ drizzle (postgres.js)
                                          ▼
                          Postgres (Neon URL OR docker compose db)
```

Static assets that do not change per user — `public/data/questions.json`, question images, and the ~407 `public/explanations/*.html` files — are served directly. No DB rows for them.

## Data model

```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id         text PRIMARY KEY,                       -- random 32-byte hex; cookie value
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);

CREATE TABLE attempts (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id integer NOT NULL,
  correct     boolean NOT NULL,
  mode        text NOT NULL CHECK (mode IN ('test', 'practice')),
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attempts_user_id_idx ON attempts(user_id);

CREATE TABLE test_history (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  at            timestamptz NOT NULL DEFAULT now(),
  score         integer NOT NULL,
  total         integer NOT NULL,
  duration_sec  integer NOT NULL,
  per_group     jsonb NOT NULL,                      -- Record<GroupId, {correct, total}>
  question_ids  jsonb NOT NULL                       -- number[]
);
CREATE INDEX test_history_user_id_at_idx ON test_history(user_id, at DESC);
```

### Why attempts is append-only, not a per-user JSON blob

- No read-modify-write race when two tabs answer at once.
- Trivial to aggregate later in SQL (e.g. weakest groups via `GROUP BY question_id`).
- Storage is negligible — even 10 000 attempts per user is tiny.

## API surface

All JSON. All except auth require a valid session cookie (401 otherwise).

```
POST   /api/auth/login        { email, password }     → 200 + Set-Cookie sid
POST   /api/auth/logout                                → 204 + clears cookie
GET    /api/me                                         → { id, email } | 401

GET    /api/progress                                   → { attempts: [...], testHistory: [...] }
POST   /api/attempts          { questionId, correct, mode }   → 201
POST   /api/test-history      { score, total, durationSec, perGroup, questionIds } → 201
DELETE /api/progress                                   → 204   (wipes attempts + test_history for user)
```

`GET /api/progress` returns the full snapshot for the user (expected size: a few KB to tens of KB). The frontend caches it in memory and applies optimistic updates on writes.

## Auth flow

1. **User creation (manual):** `pnpm user:add <email>` → prompts for password (hidden), hashes with argon2, inserts row. No UI for this.
2. **Login:** `POST /api/auth/login` → server validates with argon2, generates 32-byte random session id, inserts row, sets cookie:
   `Set-Cookie: sid=<id>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
3. **Request auth:** middleware reads `sid` cookie, looks up session, joins user, attaches `c.set('user', user)`.
4. **Slide expiry:** on each authenticated request, if session expires within 7 days, extend `expires_at` by 30 days.
5. **Logout:** delete session row, expire cookie.

No CSRF tokens needed: `SameSite=Lax` plus the API only accepting JSON (not form-encoded) is sufficient for this app's threat model (manual user creation, no public registration).

## Frontend changes

| File | Change |
|---|---|
| `src/App.tsx` | `HashRouter` → `BrowserRouter`. Wrap routes in `<RequireAuth>`. Add `/login` route. |
| `src/hooks/useProgress.ts` | Swap localStorage internals for `fetch('/api/...')`. Keep external signature identical. Add in-memory cache + optimistic updates. Retry POSTs 3× on network failure. |
| `src/hooks/useAuth.ts` (new) | `useAuth()` → `{ user, login, logout, loading }`. Calls `/api/me` on mount. |
| `src/routes/Login.tsx` (new) | Email + password form. POST `/api/auth/login`. On success, navigate to `/`. |
| `src/components/RequireAuth.tsx` (new) | Wrap routes; redirects to `/login` if `user` is null after loading. |
| `src/lib/coworkLink.ts` → `src/lib/claudeDesktopLink.ts` | Rebuild deeplink for Claude Desktop, follow-ups only. Drop `folder` param. Strip the `VITE_PROJECT_ROOT` env. |
| `src/components/ExplainButton.tsx` | Show static explanation from `/explanations/q-<id>.html` if present; "Ask follow-up in Claude Desktop" opens new deeplink. |
| `src/routes/Settings.tsx` | Remove the "folder" setting. Add a "Reset progress" button → `DELETE /api/progress`. Add "Logout". |

## Repo layout (target)

```
src/                     # React app, mostly unchanged
server/                  # NEW — all API + DB code
  index.ts               # Hono app: api routes + serveStatic(dist)
  vercel.ts              # `export default app.fetch` for Vercel
  node.ts                # Node entrypoint (@hono/node-server)
  db/
    client.ts            # postgres.js + drizzle init
    schema.ts            # drizzle schema (mirrors SQL above)
    migrations/          # generated by drizzle-kit
  auth/
    middleware.ts        # session cookie -> c.set('user', user)
    password.ts          # argon2 wrappers
    routes.ts            # login, logout, me
  routes/
    progress.ts          # GET/DELETE /api/progress
    attempts.ts          # POST /api/attempts
    testHistory.ts       # POST /api/test-history
  cli/
    add-user.ts          # `pnpm user:add`
public/
  data/                  # unchanged
  explanations/          # moved from /explanations
scripts/                 # unchanged (skill generation, scraping)
docker/
  Dockerfile             # multi-stage: builds SPA + server, ~80 MB
docker-compose.yml       # db + app, single command bring-up
vercel.json              # rewrites: /api/* -> server/vercel.ts, else -> index.html
drizzle.config.ts
.env.example
```

## Two deploy modes from one codebase

### Vercel + Neon (free)

- Vercel project root = repo root. Build command: `pnpm build`. Output: `dist/` (SPA).
- `vercel.json` rewrites `/api/(.*)` to a serverless function backed by `server/vercel.ts`; everything else falls through to `index.html`.
- Env: `DATABASE_URL` (Neon), `SESSION_COOKIE_SECURE=true`, `NODE_ENV=production`.
- Migrations: run via Vercel "build" step (`pnpm db:migrate` before `vite build`), or manually from local against the Neon URL.

### docker compose (self-host)

```yaml
# docker-compose.yml (sketch)
services:
  db:
    image: postgres:16-alpine
    volumes: ["./data/pg:/var/lib/postgresql/data"]
    environment: { POSTGRES_PASSWORD: ..., POSTGRES_DB: vmp }
  app:
    build: { context: ., dockerfile: docker/Dockerfile }
    environment:
      DATABASE_URL: postgres://postgres:...@db:5432/vmp
      SESSION_COOKIE_SECURE: "true"  # set false for plain http behind a tunnel
    ports: ["3000:3000"]
    depends_on: [db]
```

- `docker compose up --build` brings everything up.
- App container runs `node server/node.ts` which: applies migrations on boot, then serves both `/api/*` and the built SPA on port 3000.

### Local dev

- `pnpm dev` runs Vite (port 5400) and Hono (port 3001) concurrently. Vite's `server.proxy` forwards `/api/*` to Hono.
- Local Postgres via `docker compose up db` (or any local Postgres). `DATABASE_URL` in `.env.local`.

## Error handling

| Case | Behaviour |
|---|---|
| Network drop while answering | Optimistic local update; POST retried up to 3× with backoff; on final failure show toast "Server unreachable — answer not saved" and revert the optimistic state. (No localStorage fallback by design — server is source of truth.) |
| Two tabs open | Each tab writes its own attempts; on next page load `GET /api/progress` is source of truth |
| DB unreachable on startup | App exits with non-zero; Vercel surfaces 500; docker-compose restarts per restart policy |
| Session expired / cookie missing | 401 from any protected endpoint → frontend redirects to `/login`, preserving intended URL |
| Login: wrong password | 401 with generic "invalid credentials" (no user-existence enumeration) |
| Login: rate limiting | Simple in-memory: 5 failed attempts per IP per 15 min → 429. Acceptable for hand-managed user base. |


## Testing

Keep existing vitest tests as-is (`passProbability`, `testStructure`, `shuffleOptions`, `coworkLink` → rename to `claudeDesktopLink`, `sampleQuestions`, `useProgress`, `Timer`). The pure-logic ones port without changes; `useProgress` test will need to mock `fetch`.

New tests:
- `server/auth.test.ts` — login happy path, wrong password, session expiry, cookie set/cleared.
- `server/progress.test.ts` — record attempt, fetch snapshot, delete-all.

Both new test files use an ephemeral Postgres (testcontainers or a `DATABASE_URL` pointing at a disposable schema).

## Migration / rollout

This is a destructive change for the local user (you). Existing localStorage progress will not auto-migrate. Two options, picked at implementation time:

1. **Just blow it away** (simplest): on first login of the new app, server progress is empty. Acceptable since this is a personal app.
2. **One-shot import:** add a `POST /api/progress/import` endpoint + a "Import from this browser" button in Settings that reads the legacy localStorage shape and POSTs it.

Recommended: option 2, gated behind a "you'll want to do this once" notice, then remove after a week.

## What is intentionally NOT in this design

- Next.js — overkill, brings rendering complexity for zero benefit on a client-rendered quiz app.
- Auth.js / Lucia / NextAuth — 50 lines of session cookie handling is less code than configuring them.
- Migrating the 407 static explanation HTML files into Postgres — they're immutable assets generated by an offline batch script; serving from disk is correct.
- Registration / password reset / email verification flows.
- Public sign-up.
- Any Redis or cache layer.

## Open implementation questions (deferred to plan)

- Drizzle migrations applied via app-on-boot vs. external `db:migrate` step on Vercel? (Probably both: app-on-boot for docker, build-step for Vercel — both safe-idempotent.)
- `attempts` snapshot endpoint: return everything (acceptable up to maybe 100k rows) or paginate? Will pick "return everything" for v1; revisit if a single user exceeds ~10k attempts.
- Rate limiter — keep in-memory or pull `hono-rate-limiter`? Decide during implementation.
