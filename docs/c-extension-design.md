# Design — rozšíření o kategorii C (a budoucí S)

## Cíl

Rozšířit appku, která dnes umí trénovat **kategorii M** (Vůdce malého plavidla — základní část, vnitrozemské vodní cesty), o **kategorii C** (oblast plavby C — příbřežní plavba na moři). Architektura musí počítat s tím, že později přibude i **kategorie S** (plachetnice).

Kategorie jsou samostatné testy s vlastní sadou otázek, vlastní strukturou ostrého testu a vlastní historií / statistikami.

---

## Test C — fakta (zdroj: sps.gov.cz, gedima.cz, kapitanske-zkousky-testy.cz)

- **Oficiální název:** „Zkouška pro oblast C — příbřežní plavba na moři"
- **Celkem otázek v databázi:** 215 (zdroj `http://www.spspraha.cz/zkousky/otazky.asp?zp=C`)
- **Otázky s obrázkem:** 110
- **Ostrý test:** **28 otázek za 25 minut**, ≥ **24 / 28** k úspěchu (max 4 chyby)
- **Struktura ostrého testu (11 / 7 / 7 / 3):**

  | Předmět | Otázek v testu | Zkratky (skupiny v scrapu) | Otázek v DB |
  |---|---:|---|---:|
  | Mezinárodní námořní právo a předpisy (COLREG, zák. 61/2000 Sb.) | 11 | MP1, MP2, MP3, MP4 | 124 |
  | Základy navigace a značení mořských vodních cest (IALA) | 7 | N1, N2, N3, N4 | 65 |
  | Základy meteorologie | 7 | M1 | 52 |
  | Základy bezpečnosti a záchrany života na moři | 3 | Z1 | 14 |

- **Vstupní HTML scrap struktura se liší od M:** zkratka skupiny je v `<span><i>Zkratka souboru otázek:</i></span> XXX`, „Správná odpověď a)" je inline u možnosti (nikoli jako samostatný header). Scraper potřebuje druhou parser větev.

---

## Klíčová rozhodnutí

### 1. Datový layout — per-kategorie bundle

```
public/data/
  questions-M.json      ← stávající 407 otázek
  questions-C.json      ← nová 215 otázek
  images/M/q-*.png
  images/C/q-*.jpg
public/explanations/
  M/q-1.html  ...       ← stávající `public/explanations/q-*.html` se migrují sem
  C/q-1.html  ...
```

- ID otázek lokální per kategorie (1..N)
- V DB se ukládá pár `(testId, questionId)`
- Registry kategorií v `src/lib/tests.ts`:
  ```ts
  export const TESTS = {
    M: { label: 'M', title: 'Vůdce malého plavidla', dataUrl: '/data/questions-M.json', explanationsBase: '/explanations/M' },
    C: { label: 'C', title: 'Příbřežní plavba na moři', dataUrl: '/data/questions-C.json', explanationsBase: '/explanations/C' },
    // S přidat až bude implementované
  }
  ```

### 2. DB migrace

```sql
ALTER TABLE attempts     ADD COLUMN test_id TEXT NOT NULL DEFAULT 'M';
ALTER TABLE test_history ADD COLUMN test_id TEXT NOT NULL DEFAULT 'M';
CREATE INDEX attempts_user_test_idx ON attempts(user_id, test_id);
```

- Default `'M'` zachová existující data (jsou všechna z M testu).
- Všechny routes filtrují `WHERE test_id = ?`.

### 3. UI — výběr kategorie

**Desktop (Sidebar):** dropdown pod titulkem appky.
```
⚓ VMP Trenažér
Kategorie
[ M · Malé plavidlo  ▾ ]   ← klik → menu s ✓ M, C; (S brzy)
```

**Mobil:** dropdown badge vpravo nahoře v topbaru. Vždy viditelný, škáluje na N kategorií.
```
[☰] ⚓ VMP Trenažér       [Kat. M ▾]
                            └─ klik → menu pod badgem
```

**Společné:**
- App title stabilní `⚓ VMP Trenažér`. Kategorie odděleně.
- Subtitle každé stránky: `Kategorie X · …`.
- `S` zobrazená disabled s `brzy` až bude `tests.S` v registru.

### 4. Persistence aktivní kategorie

- `localStorage.activeTestId` (pokud chybí → default `'M'`)
- Žádné per-uživatel Settings checkboxy. Stačí pamatovat naposled otevřenou.
- Při registraci nového uživatele se ukáže ve výchozím stavu M.

### 5. Přepnutí kategorie během rozdělaného ostrého testu

Když je uživatel na `/test` a má rozdělaný běh (timer běží, nějaké odpovědi vybrané):
- Kliknutí na jinou kategorii v dropdownu → **potvrzovací modal**:
  > „Přepnutí kategorie zahodí rozdělaný test (X / Y otázek vyplněno, zbývá Z:ZZ). Pokračovat?"
  >
  > [Zrušit] [Přepnout a zahodit]
- Pokud potvrdí → běh se zahodí (žádný záznam v `attempts` / `testHistory`), aktivní kategorie se přepne, redirect na `/`.
- V Practice / Weak / Stats / Settings / Home žádný modal — přepínání je okamžité.

### 6. Stats — per-kategorie + záložka „Všechny"

```
[ M ]  [ C ]  [ Všechny ]    ← záložky uvnitř Stats stránky
```
- Defaultní záložka = aktivní kategorie (z dropdownu)
- M / C — stejné view jako dnes, ale filtrované per kategorie
- **Všechny** — souhrn napříč kategoriemi:
  - Mini-cards per kategorie (% pokrytí, % úspěšnost, count testů, last activity)
  - Žádné per-skupinové detaily (to dává smysl jen v rámci kategorie)

### 7. Mobile / Desktop konzistence

Routes se nemění. Žádné `/M/...` v URL. Toggle je globální shell element.

---

## Scraper refactor

`scripts/scrape.mjs` → parametrizovaný, `pnpm scrape M` / `pnpm scrape C` (default oba).

- Společný framework (download, save, image extraction)
- Dvě parser funkce:
  - `parseM($)` — současná logika (zachovat 1:1)
  - `parseC($)` — nová (jiné regex, jiná struktura odpovědí)
- Per-test config v `scripts/test-configs.mjs`:
  ```js
  export const CONFIGS = {
    M: {
      url: 'http://www.spspraha.cz/zkousky/otazky.asp?zp=M+2015',
      version: 'M-2015',
      parser: 'parseM',
      groups: [...],         // dnešní GROUPS
      testStructure: [...],  // 16/7/5/3/4
    },
    C: {
      url: 'http://www.spspraha.cz/zkousky/otazky.asp?zp=C',
      version: 'C-2015',
      parser: 'parseC',
      groups: [
        { id: 'mezinarodni-pravo',  name: 'Mezinárodní právo a předpisy',                zkratky: ['MP1','MP2','MP3','MP4'] },
        { id: 'navigace',           name: 'Navigace a značení mořských vodních cest',     zkratky: ['N1','N2','N3','N4']     },
        { id: 'meteorologie',       name: 'Meteorologie',                                 zkratky: ['M1']                     },
        { id: 'bezpecnost',         name: 'Bezpečnost a záchrana na moři',                zkratky: ['Z1']                     },
      ],
      testStructure: [
        { groups: ['mezinarodni-pravo'], count: 11 },
        { groups: ['navigace'],          count: 7  },
        { groups: ['meteorologie'],      count: 7  },
        { groups: ['bezpecnost'],        count: 3  },
      ],
    },
  }
  ```

---

## Batch explanations — orchestrace přes skill

**Problém dnes:** `scripts/batch_generate_explanations.sh` spouští `claude -p` per otázku přes `xargs -P 3`. Každá otázka = cold-start celé Claude session (~5–15 s režie před prvním tokenem).

**Nový design — žádný shell skript, jen skill:**

Místo shell wrapperu + workflow.mjs souboru bude veškerá orchestrace v Claude Code session přes nový skill `batch-explain-vmp-questions`. Uživatel řekne v Claude Code:

> „pusť batch explanations pro C, jen s obrázkem, max 20"

Skill instruuje agenta jak:

1. **Zjistit stav:** přečíst `public/data/questions-{test}.json` + zjistit které `public/explanations/{test}/q-*.html` chybí
2. **Aplikovat filtry** z uživatelova promptu (`--test`, `--only-with-image`, `--limit`, `--ids 1,2,5`, atd. — všechno přirozený jazyk)
3. **Spustit Workflow** s `pipeline(missingIds, qid => agent(promptFor(qid, test), …))`
   - Concurrency cap 16 paralelně (default workflow cap)
   - Každý agent dostane: otázku (text/options/correct/image path), prompt z `explain-vmp-question` skillu, cestu k `template.html`, out path
   - Agent vrátí success/fail + případně error message
4. **Monitorovat průběh** přes `/workflows` live progress
5. **Po dokončení:** report — kolik OK, kolik failed, retry návrh, případně auto-retry pro failures kde to dává smysl
6. **Bez fixní strategie:** uživatel může říct „spusť to znovu jen pro ty co selhaly" a agent ví co dělat

**Skill `explain-vmp-question`** (existující) zůstává jako source-of-truth promptu pro **jednu otázku**. Skill ale upravím — má umět načíst otázku z `questions-{testId}.json` (parametr). Subagenti uvnitř batchovacího workflow tento prompt inlinují.

**Nový skill `batch-explain-vmp-questions`** je tenká orchestrační vrstva nad ním + Workflow tool.

**Co tím získáme oproti shell skriptu:**
- Žádný `pnpm batch-explanations` z CLI, žádná python3 závislost, žádný xargs paralelismus
- Žádné per-question cold-starty — jedna session, fan-out v Workflow
- Flexibilní filtry přirozeným jazykem
- Visible progress přes `/workflows`
- Skill se chová stejně pro M i C — žádné větvení v shellu

**Co tím ztratíme:**
- Nelze spustit z cronu / CI (jen v Claude Code session). Pro tohle to nevadí — generování explanations není automatizovaný proces, dělá se manuálně po každém scrape.

**Smazat při implementaci:**
- `scripts/batch_generate_explanations.sh`
- `pnpm batch-explanations` z `package.json`
- `pnpm package-skill` zůstává (pro distribuci `explain-vmp-question` skillu)

---

## Migrace existujících explanations

```
public/explanations/q-*.html  →  public/explanations/M/q-*.html
```

Jednorázový `mv` (skript `scripts/migrate_explanations_to_M.sh`). `ExplainButton.tsx` / `ExplainModal.tsx` aktualizovat cestu na `/explanations/{activeTestId}/q-{id}.html`.

---

## Frontend changes — souhrn

Nové / upravené soubory:

- `src/lib/tests.ts` (nový) — registry kategorií
- `src/hooks/useActiveTest.ts` (nový) — Context + localStorage persistence
- `src/hooks/useQuestions.ts` — bere `testId` z `useActiveTest()`
- `src/hooks/useProgress.ts` — filtruje per `testId`
- `src/components/Sidebar.tsx` — přidat dropdown
- `src/components/MobileTopBar.tsx` (nový, výtah z dnešního Sidebar mobile části) — přidat dropdown badge
- `src/components/CategoryDropdown.tsx` (nový) — sdílená logika dropdown menu (desktop i mobile)
- `src/components/SwitchCategoryConfirmModal.tsx` (nový) — modal pro přepnutí během testu
- `src/routes/Stats.tsx` — záložky [M] [C] [Všechny]
- `src/routes/Home.tsx`, `Practice.tsx`, `Weak.tsx`, `Test.tsx` — bere data z aktivní kategorie
- `src/components/ExplainButton.tsx`, `ExplainModal.tsx` — cesta `/explanations/{testId}/`

---

## Backend changes — souhrn

- `server/db/schema.ts` — `attempts.testId`, `testHistory.testId`
- `server/db/migrations/0XXX_add_test_id.sql` — nová migrace
- `server/routes/attempts.ts` — povinný `testId` v query/body, filter v select
- `server/routes/progress.ts` — povinný `testId`
- `server/routes/testHistory.ts` — povinný `testId`
- `server/routes/feedback.ts` — pravděpodobně beze změny (otázka má vlastní ID, feedback je per-otázka, ale možná chceme `testId` pro lepší kategorizaci feedbacku — TBD)

---

## Mimo scope tohoto PR

- Implementace kategorie **S** (jen příprava registry struktury)
- Refactor `ExplainModal` na něco hezčího než deeplink
- Per-kategorie SIGNUP_CODE
- Achievements / streaks per kategorie

---

## Otevřené otázky pro implementaci

- **Pojmenování test_id:** `'M'` / `'C'` jako string konstanta, NEBO enum / TS literal type? → použít TS literal `type TestId = 'M' | 'C'` v `src/lib/tests.ts`, v DB jako TEXT.
- **Pass probability** (`passProbability.ts`) — funguje per bundle, jen se musí volat s novým bundle. Žádná změna logiky.
- **Practice mode „struktura ostrého testu"** — Practice používá `testStructure` z bundle, takže pro C bude 28 otázek 11/7/7/3 bez timeru. Funguje out-of-the-box po refactoru.

---

## Pořadí implementace (návrh)

1. **Datová vrstva** — scraper refactor, vygenerovat `questions-C.json` + images
2. **DB migrace** — `test_id` sloupec, default `'M'`
3. **Backend routes** — povinný `testId`
4. **Frontend foundation** — `tests.ts` registry + `useActiveTest` hook + localStorage
5. **UI** — dropdown desktop, dropdown badge mobil, route refactor (Home, Test, Practice, Weak, Stats)
6. **Confirmation modal** pro přepnutí během testu
7. **Stats „Všechny" tab**
8. **Migrace stávajících explanations** do `public/explanations/M/`
9. **Batch explanations refactor** — nový skill `batch-explain-vmp-questions`, smazat starý shell skript
10. **Vygenerovat explanations** pro C kategorii (215 otázek) přes nový skill
11. **Tests** — vitest pro nový hook, modal, registry; e2e smoke že přepnutí funguje
