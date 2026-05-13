# VMP Trenažér — Hosted App Design

**Date:** 2026-05-12
**Branch:** `feat/hosted-app`
**Status:** draft for review

## Goal

Turn the local-only VMP M trainer into a hostable web app with per-user accounts and server-persisted progress, while keeping the codebase as light as possible. Two supported deploy targets from one codebase:

1. **Free hosted:** Vercel (SPA + serverless functions) + **Turso** (libSQL / SQLite-compatible).
2. **Self-host:** Single Docker container with a SQLite file in a mounted volume — no separate DB process.

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
| DB | **libSQL** (SQLite dialect) | Single-file local; Turso hosts the same dialect with a generous free tier (9 GB, billions of reads). One driver, two backends. |
| DB driver | `@libsql/client` | Targets either a local file (`file:./data/app.db`) or a Turso URL (`libsql://...`) by env var. |
| ORM | Drizzle ORM (`drizzle-orm/libsql`) | Typed schema, simple migrations, small footprint. |
| Migrations | `drizzle-kit` | Generated SQL, applied via `pnpm db:migrate` (and on app boot for self-host). |
| Password hashing | `@node-rs/argon2` | Modern default; fast in Node. |
| Sessions | Plain cookie (`sid=<random>`) + `sessions` table | ~50 lines; no library needed. |

## Architecture

```
┌──────────────────┐    cookie     ┌────────────────┐
│ Vite SPA (React) │ ────────────▶ │ Hono /api/*    │
│  routes, hooks   │ ◀──────────── │ session middl. │
└──────────────────┘     json      └──────┬─────────┘
                                          │ drizzle (@libsql/client)
                                          ▼
                          libSQL (Turso URL OR file:./data/app.db)
```

Static assets that do not change per user — `public/data/questions.json`, question images, and the ~407 `public/explanations/*.html` files — are served directly. No DB rows for them.

## Data model

SQLite dialect. UUIDs and timestamps are stored as `text` (ISO strings / `crypto.randomUUID()` results); booleans as `integer` (0/1); JSON blobs as `text` with `JSON.stringify`/`parse`. Drizzle's `sqlite-core` types map these idiomatically.

```sql
CREATE TABLE users (
  id            text PRIMARY KEY,                      -- crypto.randomUUID() in app
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at    text NOT NULL                          -- ISO 8601
);

CREATE TABLE sessions (
  id         text PRIMARY KEY,                         -- random 32-byte hex; cookie value
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at text NOT NULL                             -- ISO 8601
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);

CREATE TABLE attempts (
  id          integer PRIMARY KEY AUTOINCREMENT,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id integer NOT NULL,
  correct     integer NOT NULL CHECK (correct IN (0, 1)),
  mode        text NOT NULL CHECK (mode IN ('test', 'practice')),
  at          text NOT NULL                            -- ISO 8601
);
CREATE INDEX attempts_user_id_idx ON attempts(user_id);

CREATE TABLE test_history (
  id            integer PRIMARY KEY AUTOINCREMENT,
  user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  at            text NOT NULL,                         -- ISO 8601
  score         integer NOT NULL,
  total         integer NOT NULL,
  duration_sec  integer NOT NULL,
  per_group     text NOT NULL,                         -- JSON: Record<GroupId, {correct, total}>
  question_ids  text NOT NULL                          -- JSON: number[]
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
    client.ts            # @libsql/client + drizzle init
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
vercel.json              # rewrites: /api/* -> server/vercel.ts, else -> index.html
drizzle.config.ts
.env.example
```

No `docker-compose.yml` needed — the self-host target is a single container with a volume.

## Two deploy modes from one codebase

### Vercel + Turso (free)

- Vercel project root = repo root. Build command: `pnpm build`. Output: `dist/` (SPA).
- `vercel.json` rewrites `/api/(.*)` to a serverless function backed by `server/vercel.ts`; everything else falls through to `index.html`.
- Env on Vercel:
  - `DATABASE_URL=libsql://<db>.turso.io`
  - `DATABASE_AUTH_TOKEN=<turso token>`
  - `SESSION_COOKIE_SECURE=true`
- Migrations: run via Vercel build step (`pnpm db:migrate` before `vite build`). Drizzle-kit applies pending migrations against the Turso URL.

### Single Docker container (self-host)

```dockerfile
# docker/Dockerfile (sketch)
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
ENV DATABASE_URL=file:/data/app.db
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server/node.js"]
```

Run with:
```bash
docker run -p 3000:3000 -v $(pwd)/data:/data vmp-trainer
```

- App container runs `node server/node.js` which: applies migrations on boot, then serves both `/api/*` and the built SPA on port 3000.
- One container, one volume, no compose file. Persistent across restarts.

### Local dev

- `pnpm dev` runs Vite (port 5400) and Hono (port 3001) concurrently. Vite's `server.proxy` forwards `/api/*` to Hono.
- DB: `DATABASE_URL=file:./data/app.db` in `.env.local`. File is created on first migration; no separate process to start.

## Error handling

| Case | Behaviour |
|---|---|
| Network drop while answering | Optimistic local update; POST retried up to 3× with backoff; on final failure show toast "Server unreachable — answer not saved" and revert the optimistic state. (No localStorage fallback by design — server is source of truth.) |
| Two tabs open | Each tab writes its own attempts; on next page load `GET /api/progress` is source of truth |
| DB unreachable on startup | App exits with non-zero (Docker restart policy handles); Vercel surfaces 500 |
| Session expired / cookie missing | 401 from any protected endpoint → frontend redirects to `/login`, preserving intended URL |
| Login: wrong password | 401 with generic "invalid credentials" (no user-existence enumeration) |
| Login: rate limiting | Simple in-memory: 5 failed attempts per IP per 15 min → 429. Acceptable for hand-managed user base. Note: Vercel serverless instances are short-lived, so this is per-instance; acceptable given the tiny user count. |

## Testing

Keep existing vitest tests as-is (`passProbability`, `testStructure`, `shuffleOptions`, `coworkLink` → rename to `claudeDesktopLink`, `sampleQuestions`, `useProgress`, `Timer`). The pure-logic ones port without changes; `useProgress` test will need to mock `fetch`.

New tests:
- `server/auth.test.ts` — login happy path, wrong password, session expiry, cookie set/cleared.
- `server/progress.test.ts` — record attempt, fetch snapshot, delete-all.

Both new test files use an in-memory libSQL database (`DATABASE_URL=file::memory:` via `@libsql/client`) — fast, zero setup, no external dependency.

## Migration / rollout

This is a destructive change for the local user (you). Existing localStorage progress will not auto-migrate. Two options, picked at implementation time:

1. **Just blow it away** (simplest): on first login of the new app, server progress is empty. Acceptable since this is a personal app.
2. **One-shot import:** add a `POST /api/progress/import` endpoint + a "Import from this browser" button in Settings that reads the legacy localStorage shape and POSTs it.

Recommended: option 2, gated behind a "you'll want to do this once" notice, then remove after a week.

## What is intentionally NOT in this design

- Next.js — overkill, brings rendering complexity for zero benefit on a client-rendered quiz app.
- Auth.js / Lucia / NextAuth — 50 lines of session cookie handling is less code than configuring them.
- Migrating the 407 static explanation HTML files into the DB — they're immutable assets generated by an offline batch script; serving from disk is correct.
- Registration / password reset / email verification flows.
- Public sign-up.
- Any Redis or cache layer.
- A separate Postgres container or docker-compose file — libSQL means one container, one volume.

## Open implementation questions (deferred to plan)

- Drizzle migrations applied via app-on-boot vs. external `db:migrate` step on Vercel? (Probably both: app-on-boot for self-host, build-step for Vercel — both safe-idempotent.)
- `attempts` snapshot endpoint: return everything (acceptable up to maybe 100k rows) or paginate? Will pick "return everything" for v1; revisit if a single user exceeds ~10k attempts.
- Rate limiter — keep in-memory or pull `hono-rate-limiter`? Decide during implementation.
