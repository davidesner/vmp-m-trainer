# VMP Trenažér - Guest Access Design

**Date:** 2026-10-12
**Status:** draft for review

## Goal

Let anyone use the app without an account ("Pokračovat bez přihlášení"). This is the first step towards a free, public app; open signup (Google, or email without a signup code) follows later.

A guest can take the ostrý test and run Procvičování. Their attempts and test results are still stored in the DB for app monitoring, but nothing derived from stored data is ever shown back to them: no Odhad úspěchu, no test history, no Statistiky, no Slabiny, no weak-based practice modes. Those features are visible but locked, with a prompt to sign in.

## Non-goals

- No upgrade/merge of guest data into an account. Signing in starts from the account's own data; the guest row stays in the DB as usage history only.
- No open signup, Google login or changes to the signup code flow (separate follow-up).
- No collection of PII. A guest row has no email or other personal data.
- No cleanup job for guest rows or expired guest sessions (can be added later if needed).

## Terminology

The word "anonymní" / "anonymous" is not used anywhere, neither in UI nor in code. A signed-in user is just as anonymous (we store no PII), so the term would be misleading.

- UI: "nepřihlášen", "bez přihlášení".
- Code/DB: `guest`.

## Data model

Additive migration only:

```sql
ALTER TABLE `users` ADD `is_guest` integer DEFAULT 0 NOT NULL;
```

Schema: `isGuest: integer('is_guest', { mode: 'boolean' }).notNull().default(false)`.

`email` and `password_hash` stay `NOT NULL`. Making them nullable would require SQLite to rebuild the `users` table, and dropping `users` inside a migration risks cascade-deleting `sessions`, `attempts` and `test_history` (`onDelete: cascade`). Guest rows use placeholders instead:

- `email = 'guest:<uuid>'` - contains no `@`, so it can never collide with a real address (register requires `@`).
- `password_hash = ''`.

Monitoring queries split users with `WHERE is_guest = 0 / 1`.

## Server

### `POST /api/auth/guest`

- No signup code required.
- Rate-limited per IP with the existing `checkRateLimit` (key `guest:<ip>`).
- If the request already carries a valid session (guest or registered), returns the current user without creating anything.
- Otherwise inserts a `users` row (`id = randomUUID()`, placeholder email, empty hash, `isGuest = true`), creates a session and sets the `sid` cookie with the same options as login (30-day sliding). A returning browser therefore stays the same guest.
- Response: `{ id, email: null, guest: true }`, status 201 (200 when returning an existing session).

### Auth context

- `AuthUser` becomes `{ id: string; email: string | null; guest: boolean }`.
- `loadUser` sets `guest` from `users.isGuest` and `email: null` for guests (the placeholder never leaves the server).
- `/api/me` returns that object.

### Login / register

- `POST /api/auth/login` treats a row with `isGuest = true` as non-existent (`401 invalid credentials`), never calling `verifyPassword`.
- When login or register succeeds on a request that carries a guest session, that guest session is deleted before the new one is created. The guest `users` row and its attempts stay.

### `requireRegistered()` middleware

New middleware in `server/auth/middleware.ts`: 401 if no user, 403 `{ error: 'account required' }` if `user.guest`.

| Endpoint | Guest |
|---|---|
| `GET /api/progress` | 403 |
| `DELETE /api/progress` | 403 |
| `POST /api/progress/import` | 403 |
| `POST /api/attempts` | allowed |
| `POST /api/test-history` | allowed |
| `POST /api/feedback` | allowed (unchanged) |
| `POST /api/auth/logout` | allowed |

`progressRoutes` switches from `requireAuth()` to `requireRegistered()`; attempts and test-history keep `requireAuth()`.

## Client

### `useAuth`

- `AuthUser` gains `guest: boolean`, `email: string | null`.
- New `loginAsGuest(): Promise<AuthResult>` calling `POST /api/auth/guest`.
- Convenience `isGuest = user?.guest === true`.

### Login page

Secondary button under the form: **"Pokračovat bez přihlášení"**. On success, navigates to `location.state.from` or `/`, same as login.

`RequireAuth` keeps admitting any user (guest included).

### `useProgress`

When the user is a guest:

- Skips `GET /api/progress`; `store` stays empty.
- `recordAttempt` / `recordTestHistory` still POST (with retry), but skip the optimistic local store update, so no derived data can leak into the UI.
- `reset` is a no-op.

### `LockedFeature` component

New `src/components/LockedFeature.tsx`: a card with 🔒, the text **"Přihlas se a uvidíš odhad úspěchu, slabiny a historii testů"**, a "Přihlásit se" button (`/login`) and, when `signupEnabled`, a "Vytvořit účet" button (`/register`). Optional `title` prop for context.

### Screens

| Screen | Guest behaviour |
|---|---|
| Home | Hero card shows `LockedFeature` in place of the pass estimate, keeps "▶ Spustit ostrý test". The per-group block and "Poslední testy" are not rendered (both come from stored data). |
| `/weak` | Renders heading + `LockedFeature`; no practice run is started. |
| `/stats` | Renders heading + `LockedFeature`; `useAllProgress` is not called (component split so the hook only runs for registered users). |
| Practice | `mix` defaults to `'random'`. "⚖ Mix slabiny + známé" and "Hlavně slabiny" are disabled with a one-line hint "Dostupné po přihlášení" linking to `/login`. Structure and group selection work normally. |
| Test | Unchanged. The results screen right after the test still shows (in-session data). |
| Settings | Reset and legacy import sections are hidden. Shows the "Přihlásit se / Vytvořit účet" prompt instead of the account/logout block. |
| Sidebar | "Slabiny" and "Statistiky" get a 🔒 suffix. Bottom block (desktop sidebar and mobile drawer): "Nepřihlášen · Přihlásit se". |

## Testing

Server (vitest, existing in-memory DB setup):

- `POST /api/auth/guest` creates a row with `is_guest = 1`, placeholder email, sets the cookie; `/api/me` returns `{ guest: true, email: null }`.
- Calling it again with the cookie returns the same user, no new row.
- Rate limit returns 429.
- Guest gets 403 on `GET` / `DELETE /api/progress` and `POST /api/progress/import`.
- Guest `POST /api/attempts` and `POST /api/test-history` succeed and rows land under the guest user id.
- Login with a `guest:<uuid>` email returns 401.
- Login while holding a guest session deletes the guest session row.

Client (vitest + RTL):

- `RequireAuth` admits a guest.
- `useProgress` does not fetch `/api/progress` for a guest and does not update the store on `recordAttempt`.
- Practice disables the weak-based mix modes for a guest and defaults to random.
- Home, Stats and Weak render `LockedFeature` for a guest.

Migration: run `pnpm db:migrate` against a copy of an existing DB and verify existing users, sessions and attempts are intact and `is_guest = 0`.
