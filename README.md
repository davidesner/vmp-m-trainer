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
