# VMP M Trainer — Design Spec

**Date:** 2026-05-04
**Status:** Draft for review

## 1. Goal & Scope

Lokální webová aplikace pro učení a trénink na zkoušku VMP M (Vůdce malého plavidla) — kategorie M 2015. Single-user, lokální použití. Cíl: dosáhnout stabilně 30+ z 35 v ostrém režimu.

**Zdroj otázek:** `http://www.spspraha.cz/zkousky/otazky.asp?zp=M+2015` (~~250 otázek se správnými odpověďmi).

**Zdroj vysvětlení:** Generováno on-demand přes Claude Desktop (Cowork) custom skill, cachováno do repa.

## 2. Stack

| Vrstva | Volba | Důvod |
|---|---|---|
| Bundler / dev server | Vite | Nulová konfigurace, hot reload |
| Framework | React 18 + TypeScript | Známý, široký ekosystém |
| Styling | TailwindCSS | Rychlé stylování, nepotřebujeme design systém |
| State | React `useState` + custom hooks | Není potřeba Redux/Zustand pro tuhle velikost |
| Persistence (uživatel) | `localStorage` | Per-prohlížeč, bez backendu |
| Persistence (data) | JSON v repu | Statické, jednoduchý deploy |
| Package manager | `pnpm` | Rychlejší než npm |
| Test framework | Vitest | Native pro Vite |

**Žádný backend.** Vite dev server stačí, aplikace je statická.

**Build target:** lokální `pnpm dev`. Volitelně `pnpm build` produkuje statický `dist/` který lze hostovat na GitHub Pages.

## 3. Data Layer

### 3.1 Repo struktura

```
VMP_TEST/
├── src/                            # React aplikace
├── public/
│   └── data/
│       ├── questions.json          # všechny otázky
│       └── images/                 # q-XXX.png (signalizace, vytyčení)
├── explanations/                   # generované Cowork skillem
│   ├── q-001.html
│   └── q-001.meta.json
├── .claude/
│   └── skills/
│       └── explain-vmp-question/
│           ├── SKILL.md
│           └── template.html       # HTML šablona pro výstup
├── scripts/
│   ├── scrape.mjs                  # one-off scraper
│   └── package-skill.sh            # zazipuje skill pro upload do Cowork
├── docs/
│   └── superpowers/specs/
└── README.md
```

### 3.2 `questions.json` schema

```typescript
{
  "version": "M-2015",
  "scraped_at": "2026-05-04T10:00:00Z",
  "groups": [
    { "id": "plavebni-provoz", "name": "Plavební provoz", "test_count": 16 },
    { "id": "nocni-denni-signalizace", "name": "Noční a denní signalizace", "test_count": 7 },
    { "id": "zvukove-signaly", "name": "Zvukové signály", "test_count": null },
    { "id": "signalizace-rizeni-plavby", "name": "Signalizace pro řízení plavby na vodní cestě", "test_count": null },
    { "id": "vytyceni-vodnich-cest", "name": "Vytyčení vodních cest", "test_count": null },
    { "id": "zaklady-konstrukce-plavidel", "name": "Základy konstrukce plavidel", "test_count": 3 },
    { "id": "zaklady-prvni-pomoci", "name": "Základy první pomoci", "test_count": 4 }
  ],
  "test_structure": [
    { "groups": ["plavebni-provoz"], "count": 16 },
    { "groups": ["nocni-denni-signalizace"], "count": 7 },
    { "groups": ["zvukove-signaly", "signalizace-rizeni-plavby", "vytyceni-vodnich-cest"], "count": 5 },
    { "groups": ["zaklady-konstrukce-plavidel"], "count": 3 },
    { "groups": ["zaklady-prvni-pomoci"], "count": 4 }
  ],
  "questions": [
    {
      "id": 1,
      "group": "plavebni-provoz",
      "text": "Jaká je nejvyšší dovolená rychlost plavidla v plavební komoře?",
      "image": null,
      "options": [
        { "key": "a", "text": "5 km/h" },
        { "key": "b", "text": "krokem člověka" },
        { "key": "c", "text": "bez omezení" }
      ],
      "correct": "b"
    }
  ]
}
```

`test_structure` je single-source-of-truth pro počty 16/7/5/3/4 — používá ostrý test i podmód "Struktura ostrého testu" v procvičování.

### 3.3 Scraper (`scripts/scrape.mjs`)

Jednorázový Node skript:

1. Fetch `http://www.spspraha.cz/zkousky/otazky.asp?zp=M+2015` → seznam skupin
2. Pro každou skupinu fetch detail stránky → otázky + odpovědi + správná odpověď
3. Pro otázky s obrázky stáhnout PNG do `public/data/images/q-{id}.png`
4. Zapíše `public/data/questions.json`

Knihovny: `node-fetch`, `cheerio`. Idempotentní (jde spustit znovu, jen zaktualizuje `scraped_at`).

**Out of scope:** Live re-scraping. Otázky se mění zřídka, manuální `pnpm scrape` stačí.

### 3.4 Images

`public/data/images/q-{id}.png`. App je referencuje jako `<img src={`/data/images/q-${id}.png`} />` při existenci `question.image === true`.

### 3.5 Explanations cache

```
explanations/
├── q-001.html         # vlastní HTML (sanitizovaný; viz §7.4)
└── q-001.meta.json    # { qid, generated_at, sources: [], session_url? }
```

**Výhled:** explanations jsou commitované do repa — postupně se akumulují, lze je libovolně ručně editovat.

## 4. Application Modes

### 4.1 Ostrý test

- 35 otázek vybraných dle `test_structure`
- Timer 30:00 (countdown), test končí při vypršení nebo manuálním odeslání
- Otázky lze přeskakovat / vracet (sidebar v Test runneru)
- Hned na konci výsledek: % úspěšnost, body / 35, splněno (≥30) ano/ne, breakdown po skupinách
- "🧠 Vysvětlení" přístupné během testu i ve výsledcích
- Výsledek se ukládá do `localStorage` history (viz §6)

### 4.2 Procvičování

**Dvě podmódy:**

1. **Struktura ostrého testu** — 35 otázek dle `test_structure`, bez timeru. Hned po odpovědi reveal + možnost vysvětlení.
2. **Vybrat oblasti** — checkboxy skupin + počet otázek (10/25/50/vše). Otázky pouze z vybraných skupin.

**Zaměření výběru** (orthogonální k podmódu):
- **Náhodně** — uniform sampling
- **⚖ Mix slabiny + známé** (default) — viz §5
- **Hlavně slabiny** — pouze otázky z `weakSpots` (pokud nestačí, doplnit z náhodných)

### 4.3 Slabiny

Quick-launch shortcut: vezme `weakSpots` (otázky kde `errorRate > 0.3` v posledních 5 pokusech) až do 20 otázek a spustí procvičování. Žádný setup screen.

### 4.4 Statistiky

Tabulka po skupinách:

| Skupina | Počet otázek | Pokusy | Úspěšnost | Naposledy |
|---|---|---|---|---|
| Plavební provoz | 74 | 138 | 87% | dnes |
| ... | | | | |

Pod tím: graf úspěšnosti posledních 10 ostrých testů (line chart).

## 5. Smart Mix Algorithm

Pro `Mix slabiny + známé` (procvičování):

```
Vstup: požadovaný počet N, množina kandidátních otázek (skupina nebo všechny)
Výstup: pole N otázek

Pro každou otázku spočítej skóre podle progress dat:
  attempts = počet pokusů
  errors   = počet chyb
  lastSeen = timestamp posl. pokusu
  daysSince = (now - lastSeen) / 1den

  Pokud attempts == 0:
    bucket = "new"          (30%)
  Else if errors / attempts > 0.4:
    bucket = "weak"         (40%)
  Else if daysSince > 7 || lastSeen není:
    bucket = "stale"        (15%)
  Else:
    bucket = "known"        (15%)

Vyber váženě:
  40% z "weak" (priorita: vyšší error rate, čerstvější chyby)
  30% z "new"  (priorita: podle pořadí)
  15% z "stale" (priorita: nejdéle nevidené)
  15% z "known" (priorita: random pro recall)

Pokud některý bucket nemá dost, přesypat z "known" → "weak" → "stale" → "new" (cascade fill).
Po výběru zamíchat (Fisher-Yates) ať není pořadí podle bucketu.
```

Implementace v `src/lib/sampleQuestions.ts`. Unit testy s fixed seed.

## 6. Local Progress Tracking

`localStorage` klíče (prefix `vmp:`):

```typescript
"vmp:progress" → {
  questions: {
    [qid: number]: {
      attempts: Array<{ at: ISO, correct: boolean, mode: "test" | "practice" }>,
      lastSeen: ISO,
    }
  },
  testHistory: Array<{
    at: ISO,
    score: number,
    total: 35,
    durationSec: number,
    perGroup: { [groupId: string]: { correct: number, total: number } },
    questionIds: number[],
  }>
}

"vmp:settings" → { mixMode: "random" | "mix" | "weak", lastMode: "test" | "practice" | ... }
```

Operace abstrahované do `useProgress()` hooku. Migration version v top-level klíči `vmp:version`.

## 7. Claude Cowork Integration

### 7.1 Skill definition (`.claude/skills/explain-vmp-question/SKILL.md`)

```markdown
---
name: explain-vmp-question
description: Vygeneruj detailní vysvětlení k otázce z VMP M testu. Aktivuj když uživatel požádá o vysvětlení otázky #ID nebo zmíní VMP test. Načti otázku z public/data/questions.json, prozkoumej souvisejíci právní/praktický kontext (vyhláška 67/2015 Sb., zákon o vnitrozemské plavbě, atd.), a ulož HTML do explanations/q-{ID}.html.
---

# Skill: Explain VMP-M question

Když uživatel požádá o vysvětlení otázky:

1. Identifikuj `qid` z promptu (např. "otázka #12" → qid=12).
2. Přečti `public/data/questions.json`, najdi otázku podle `id`. Poznamenej `text`, `correct`, `options`, `group`.
3. Web research:
   - Hledej kontext k tématu skupiny (§ a paragrafy)
   - Pokud `group` je "nocni-denni-signalizace" / "vytyceni-vodnich-cest" / "zvukove-signaly", najdi referenční obrázky a popisy
4. Vygeneruj HTML pomocí šablony `.claude/skills/explain-vmp-question/template.html` se sekcemi:
   - **Krátké vysvětlení** (1-2 věty proč je správná odpověď správná)
   - **Pozadí** (právní / technický kontext)
   - **Praktická aplikace** (kdy se to v reálu projeví)
   - **Zdroje** (číslované odkazy)
5. Sanitizuj HTML (žádné `<script>`, žádné externí JS, povol jen základní tagy: `h2-h4, p, ul/ol/li, strong, em, a, img, code, blockquote`).
6. Ulož do `explanations/q-{qid}.html`.
7. Ulož metadata do `explanations/q-{qid}.meta.json`:
   ```json
   {
     "qid": 12,
     "generated_at": "2026-05-04T...",
     "sources": ["https://..."],
     "model": "claude-sonnet-4-6"
   }
   ```
8. Potvrď v chatu jednou větou: "Vygenerováno: explanations/q-12.html, hlavní zdroj: ..."
```

### 7.2 Deep link format (web app → Cowork)

```
claude://cowork/new?q={URL-encoded prompt}&folder={absolute path to repo}
```

Příklad:
```
claude://cowork/new?q=Pou%C5%BEij%20skill%20explain-vmp-question%20pro%20ot%C3%A1zku%20%2312&folder=/Users/esner/Documents/Fun/VMP_TEST
```

Aplikace musí znát absolutní cestu k repu — řešení: env var `VITE_PROJECT_ROOT` v `.env.local` (každý uživatel si nastaví svou cestu při setupu). Fallback: app sezná z URL (web má `window.location` nepoužitelně) → instrukce v UI: "Nastav v Settings cestu k repu" + persist v `localStorage`.

### 7.3 User flow při klikutí "Vysvětlení"

```
[user click "Vysvětlení"]
       │
       ▼
[fetch /explanations/q-{id}.html]
       │
   ┌───┴────┐
   ▼        ▼
 200      404
   │        │
   ▼        ▼
[show modal     [show modal s tlačítkem
  s HTML +       "▶ Vygeneruj přes Cowork"
  link na        které otevře claude:// URL]
  Cowork                │
  pokud meta            ▼
  má session_url] [user pracuje v Cowork,
                   skill uloží q-{id}.html]
                          │
                          ▼
                   [user klikne "↻ Načíst výsledek"]
                          │
                          ▼
                   [refetch → 200 → modal s HTML]
```

**Polling vs button:** Ručně tlačítko "Načíst výsledek" v modalu. Jednoduché, deterministické. Polling je YAGNI.

### 7.4 HTML sanitizace v aplikaci

I když skill generuje "důvěryhodný" HTML, app ho prochází `DOMPurify` před `dangerouslySetInnerHTML`. Defence in depth pro případ ruční editace souborů v `explanations/`.

### 7.5 Setup pro uživatele

V README:

```markdown
## Setup (jednou)
1. `pnpm install`
2. `pnpm scrape`  (stáhne otázky)
3. Vytvoř `.env.local` se `VITE_PROJECT_ROOT=<absolutní cesta k tomuto folderu>`
4. (Volitelně, pro vysvětlení) Otevři Claude Desktop → Cowork:
   - Customize → Skills → Upload → vyber `dist/explain-vmp-question.zip`
     (vyrobíš `pnpm package-skill`)
   - Projects → Import existing → vyber tento folder
   - Project instructions: "Když uživatel požádá o vysvětlení otázky, použij skill explain-vmp-question."
5. `pnpm dev`
```

## 8. Component Structure

```
src/
├── App.tsx                  # router (hash-based routes)
├── routes/
│   ├── Home.tsx             # dashboard, hero CTA, recent tests
│   ├── Test.tsx             # ostrý test runner
│   ├── Practice.tsx         # procvičování (setup screen + runner)
│   ├── Weak.tsx             # slabiny shortcut
│   ├── Stats.tsx            # statistiky tabulka + chart
│   └── Settings.tsx         # VITE_PROJECT_ROOT, reset progress
├── components/
│   ├── Sidebar.tsx          # levý nav (B layout)
│   ├── QuestionCard.tsx     # otázka + odpovědi + obrázek
│   ├── ExplainButton.tsx    # tlačítko + modal
│   ├── ExplainModal.tsx     # cache hit / miss UI, deep link
│   ├── Timer.tsx
│   ├── ProgressBar.tsx
│   └── QuestionGrid.tsx     # mřížka 35 otázek (později pro Runner B)
├── hooks/
│   ├── useQuestions.ts      # načte questions.json
│   ├── useProgress.ts       # localStorage progress
│   └── useExplanations.ts   # cache map, fetch on demand
├── lib/
│   ├── sampleQuestions.ts   # smart mix algoritmus (§5)
│   ├── coworkLink.ts        # build claude:// URL
│   ├── sanitize.ts          # DOMPurify wrapper
│   └── testStructure.ts     # logika 16/7/5/3/4
└── styles/
    └── tailwind.css
```

Žádný komponent nepřesahuje ~150 řádků. `App.tsx` ≤ 80 řádků (jen routing).

## 9. Error Handling

- **Scraper selže** — vypíše chybu, neoverwrituje questions.json. CLI exit code 1.
- **App nenajde questions.json** — full-screen error: "Spusť `pnpm scrape`".
- **localStorage plný / parsing failure** — nabídne reset na default + backup do download souboru.
- **Cowork deep link nefunguje** (Claude Desktop neinstalovaný) — modal zobrazí instrukci s URL k zkopírování + odkaz na claude.ai/download.

## 10. Testing Strategy

| Vrstva | Jak |
|---|---|
| `sampleQuestions.ts` (smart mix) | Vitest unit s fixed seed RNG, ověř distribuci buckets |
| `testStructure.ts` | Vitest unit, ověř že vrátí přesně 16/7/5/3/4 ze správných skupin |
| `useProgress` migrace | Vitest s mock localStorage |
| `coworkLink` URL builder | Vitest unit, ověř encoding |
| Komponenty | React Testing Library, jen klíčové (Timer countdown, QuestionCard select) |
| End-to-end | Out of scope. Lokální app, manuální QA. |

## 11. Out of Scope (YAGNI)

- Backend / multi-user sync
- Auto-poll na cache miss explanation (manuální tlačítko stačí)
- AI-generované otázky (jen stávající data set)
- Mobilní native app (PWA install pokud chce, ale nedělíme to)
- Live re-scraping spspraha.cz
- Spaced repetition (SuperMemo / Anki algoritmus) — náš mix je dost dobrý pro start

## 12. Otevřené body / rizika

1. **Cowork skill auto-aktivace** — popis ve frontmatter musí být dost specifický, aby Cowork skill aktivoval na český prompt. Pokud nestačí, Project instructions explicitně řeknou *"vždy použij skill explain-vmp-question"*.
2. **Cesta k repu pro deep link** — uživatel musí jednou nastavit `VITE_PROJECT_ROOT`. Bez toho deep link nemá `folder` parametr, což znamená že Cowork session nezná folder. Musí se to v UI jasně komunikovat.
3. **Sanitizace HTML** — Cowork skill v zásadě generuje důvěryhodný HTML, ale pro případ chyby nebo ruční editace má app `DOMPurify` + template bez `<script>`.
4. **Scraper závislý na strukturě spspraha.cz** — pokud změní layout, scraper rozbijeme. Akceptovatelné — manuální fix při změně.

---

**Reviewers:** David (autor)
**Next step:** writing-plans skill → implementation plan.
