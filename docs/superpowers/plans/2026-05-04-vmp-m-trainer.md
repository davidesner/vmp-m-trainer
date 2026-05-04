# VMP M Trainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lokální webová aplikace pro učení a trénink na zkoušku VMP M — single-user, statická, s integrací Claude Cowork pro AI-generovaná vysvětlení otázek.

**Architecture:** Statická React+Vite SPA. Otázky a obrázky jako JSON+PNG v repu (jednorázový scraper z spspraha.cz). Progress v localStorage. Vysvětlení generovaná na klik přes deep link `claude://cowork/new` + custom skill, cachovaná do `explanations/q-{id}.html` v repu.

**Tech Stack:** React 18 + TypeScript + Vite + TailwindCSS + Vitest + pnpm. Scraper v Node ESM (cheerio + node-fetch).

**Source spec:** `docs/superpowers/specs/2026-05-04-vmp-m-trainer-design.md`

---

## File Structure

**Project root files:**
- `package.json` — pnpm workspace root, scripts, deps
- `pnpm-lock.yaml` — committed
- `vite.config.ts` — Vite + Vitest config
- `tailwind.config.ts` — Tailwind config
- `postcss.config.js` — PostCSS for Tailwind
- `tsconfig.json` / `tsconfig.node.json` — TypeScript configs
- `index.html` — Vite entry HTML
- `.env.local.example` — VITE_PROJECT_ROOT placeholder
- `README.md` — setup instructions

**Source (`src/`):**
- `main.tsx` — React entry point
- `App.tsx` — top-level router
- `index.css` — Tailwind imports
- `types.ts` — shared types (Question, Group, Progress, etc.)

**Routes (`src/routes/`):**
- `Home.tsx` — dashboard
- `Test.tsx` — ostrý test runner
- `Practice.tsx` — procvičování (setup + runner)
- `Weak.tsx` — slabiny shortcut
- `Stats.tsx` — statistiky
- `Settings.tsx` — VITE_PROJECT_ROOT, reset progress

**Components (`src/components/`):**
- `Sidebar.tsx` — left nav
- `QuestionCard.tsx` — question + options + image
- `ExplainButton.tsx` — button trigger
- `ExplainModal.tsx` — cache hit/miss UI
- `Timer.tsx` — countdown
- `ProgressBar.tsx`
- `TestResults.tsx` — results screen

**Hooks (`src/hooks/`):**
- `useQuestions.ts`
- `useProgress.ts`
- `useExplanations.ts`

**Lib (`src/lib/`):**
- `testStructure.ts` (+ `.test.ts`)
- `sampleQuestions.ts` (+ `.test.ts`)
- `coworkLink.ts` (+ `.test.ts`)
- `sanitize.ts`
- `groupConfig.ts` — zkratka → group display config

**Data (`public/data/`):**
- `questions.json` — produced by scraper
- `images/` — produced by scraper

**Cowork skill (`.claude/skills/explain-vmp-question/`):**
- `SKILL.md`
- `template.html`

**Scripts (`scripts/`):**
- `scrape.mjs`
- `package-skill.sh`

**Generated (`explanations/`):**
- `q-{id}.html` (committed as they accumulate)
- `q-{id}.meta.json`

---

## Phase A: Foundation

### Task 1: Project bootstrap (Vite + React + TS + Tailwind)

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.env.local.example`

- [ ] **Step 1: Run Vite scaffold**

```bash
cd /Users/esner/Documents/Fun/VMP_TEST
pnpm create vite@latest . --template react-ts
```

When prompted "Current directory is not empty", choose "Ignore files and continue".

- [ ] **Step 2: Install deps**

```bash
pnpm install
```

- [ ] **Step 3: Add Tailwind + plugins + Vitest + supporting libs**

```bash
pnpm add -D tailwindcss postcss autoprefixer vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @types/node
pnpm add dompurify isomorphic-dompurify
pnpm add -D @types/dompurify
```

- [ ] **Step 4: Init Tailwind**

```bash
npx tailwindcss init -p
```

Then write `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#86c441', dark: '#6ba830', light: '#eef9e1' },
        danger:  { DEFAULT: '#e74c3c', light: '#fdecea' },
        accent:  { DEFAULT: '#5a6cdb' },
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 5: Replace `src/index.css` with Tailwind directives**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { @apply bg-neutral-50 text-neutral-900 antialiased; font-family: system-ui, -apple-system, sans-serif; }
```

- [ ] **Step 6: Replace `src/App.tsx` with placeholder**

```tsx
export default function App() {
  return (
    <div className="flex items-center justify-center h-screen">
      <h1 className="text-2xl font-bold text-primary">VMP M Trainer</h1>
    </div>
  )
}
```

- [ ] **Step 7: Replace `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 8: Write `vite.config.ts` with Vitest config**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 9: Write `src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 10: Write `.env.local.example`**

```
VITE_PROJECT_ROOT=/absolute/path/to/this/folder
```

- [ ] **Step 11: Add scripts to `package.json`**

Modify `package.json` → `scripts` to include:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "scrape": "node scripts/scrape.mjs",
    "package-skill": "bash scripts/package-skill.sh"
  }
}
```

- [ ] **Step 12: Verify dev server starts**

Run: `pnpm dev`
Expected: Vite reports running on `http://localhost:5173`. Open browser, "VMP M Trainer" headline visible. Stop with Ctrl+C.

- [ ] **Step 13: Verify test runner**

Run: `pnpm test`
Expected: "No test files found" (clean exit code 0 since vitest --passWithNoTests not set, may exit 1 — that's OK for now). Move on.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "Bootstrap Vite + React + TS + Tailwind + Vitest"
```

---

### Task 2: Shared types and group config

**Files:**
- Create: `src/types.ts`, `src/lib/groupConfig.ts`

- [ ] **Step 1: Write `src/types.ts`**

```typescript
export type ZkratkaId = 'PP1' | 'PP2' | 'PP3' | 'PP4' | 'TZ' | 'ZP'

export type GroupId =
  | 'plavebni-provoz'
  | 'nocni-denni-signalizace'
  | 'signalizace-rizeni-plavby'
  | 'zvukove-signaly'
  | 'vytyceni-vodnich-cest'
  | 'zaklady-konstrukce-plavidel'
  | 'zaklady-prvni-pomoci'

export interface Group {
  id: GroupId
  name: string
  zkratky: ZkratkaId[]
  testCount: number
}

export interface QuestionOption {
  key: 'a' | 'b' | 'c'
  text: string
}

export interface Question {
  id: number
  zkratka: ZkratkaId
  group: GroupId
  text: string
  image: string | null
  options: QuestionOption[]
  correct: 'a' | 'b' | 'c'
}

export interface QuestionsBundle {
  version: string
  scrapedAt: string
  groups: Group[]
  testStructure: TestSegment[]
  questions: Question[]
}

export interface TestSegment {
  groups: GroupId[]
  count: number
}

export type AnswerMode = 'test' | 'practice'

export interface AttemptRecord {
  at: string
  correct: boolean
  mode: AnswerMode
}

export interface QuestionProgress {
  attempts: AttemptRecord[]
  lastSeen: string
}

export interface TestHistoryEntry {
  at: string
  score: number
  total: number
  durationSec: number
  perGroup: Record<GroupId, { correct: number; total: number }>
  questionIds: number[]
}

export interface ProgressStore {
  questions: Record<number, QuestionProgress>
  testHistory: TestHistoryEntry[]
}

export interface ExplanationMeta {
  qid: number
  generated_at: string
  sources: string[]
  session_url?: string
  model?: string
}

export type MixMode = 'random' | 'mix' | 'weak'
```

- [ ] **Step 2: Write `src/lib/groupConfig.ts`**

```typescript
import type { Group, GroupId, TestSegment, ZkratkaId } from '../types'

export const ZKRATKA_TO_GROUP: Record<ZkratkaId, GroupId> = {
  PP1: 'plavebni-provoz',
  PP2: 'nocni-denni-signalizace',
  PP3: 'signalizace-rizeni-plavby',
  PP4: 'zvukove-signaly',
  TZ:  'zaklady-konstrukce-plavidel',
  ZP:  'zaklady-prvni-pomoci',
}

export const GROUPS: Group[] = [
  { id: 'plavebni-provoz',             name: 'Plavební provoz',                              zkratky: ['PP1'], testCount: 16 },
  { id: 'nocni-denni-signalizace',     name: 'Noční a denní signalizace',                    zkratky: ['PP2'], testCount: 7 },
  { id: 'signalizace-rizeni-plavby',   name: 'Signalizace pro řízení plavby na vodní cestě', zkratky: ['PP3'], testCount: 0 },
  { id: 'zvukove-signaly',             name: 'Zvukové signály',                              zkratky: ['PP4'], testCount: 0 },
  { id: 'vytyceni-vodnich-cest',       name: 'Vytyčení vodních cest',                        zkratky: [],      testCount: 0 },
  { id: 'zaklady-konstrukce-plavidel', name: 'Základy konstrukce plavidel',                  zkratky: ['TZ'],  testCount: 3 },
  { id: 'zaklady-prvni-pomoci',        name: 'Základy první pomoci',                         zkratky: ['ZP'],  testCount: 4 },
]

// 16/7/5/3/4 segment definition for the real test
export const TEST_STRUCTURE: TestSegment[] = [
  { groups: ['plavebni-provoz'],                                                                    count: 16 },
  { groups: ['nocni-denni-signalizace'],                                                            count: 7 },
  { groups: ['signalizace-rizeni-plavby', 'zvukove-signaly', 'vytyceni-vodnich-cest'],              count: 5 },
  { groups: ['zaklady-konstrukce-plavidel'],                                                        count: 3 },
  { groups: ['zaklady-prvni-pomoci'],                                                               count: 4 },
]
```

> **Note:** `vytyceni-vodnich-cest` has empty `zkratky` because the source doesn't have a separate zkratka for it — the 5 mixed questions in real test draw from PP3 + PP4. Verified during scraper inspection (Task 3). If a separate set is found, update `zkratky` here.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts src/lib/groupConfig.ts
git commit -m "Add shared types and group/test-structure config"
```

---

## Phase B: Data acquisition

### Task 3: Scraper script

**Files:**
- Create: `scripts/scrape.mjs`

- [ ] **Step 1: Install scraper deps**

```bash
pnpm add -D cheerio node-fetch
```

- [ ] **Step 2: Write `scripts/scrape.mjs`**

```javascript
#!/usr/bin/env node
// One-off scraper for spspraha.cz VMP M 2015 questions.
// Reads the single index page, extracts all questions, downloads images,
// and writes public/data/questions.json.

import { writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE_URL = 'http://www.spspraha.cz/zkousky/otazky.asp?zp=M+2015'
const OUT_JSON = join(ROOT, 'public/data/questions.json')
const OUT_IMG_DIR = join(ROOT, 'public/data/images')

const ZKRATKA_TO_GROUP = {
  PP1: 'plavebni-provoz',
  PP2: 'nocni-denni-signalizace',
  PP3: 'signalizace-rizeni-plavby',
  PP4: 'zvukove-signaly',
  TZ:  'zaklady-konstrukce-plavidel',
  ZP:  'zaklady-prvni-pomoci',
}

const GROUPS = [
  { id: 'plavebni-provoz',             name: 'Plavební provoz',                              zkratky: ['PP1'], testCount: 16 },
  { id: 'nocni-denni-signalizace',     name: 'Noční a denní signalizace',                    zkratky: ['PP2'], testCount: 7 },
  { id: 'signalizace-rizeni-plavby',   name: 'Signalizace pro řízení plavby na vodní cestě', zkratky: ['PP3'], testCount: 0 },
  { id: 'zvukove-signaly',             name: 'Zvukové signály',                              zkratky: ['PP4'], testCount: 0 },
  { id: 'vytyceni-vodnich-cest',       name: 'Vytyčení vodních cest',                        zkratky: [],      testCount: 0 },
  { id: 'zaklady-konstrukce-plavidel', name: 'Základy konstrukce plavidel',                  zkratky: ['TZ'],  testCount: 3 },
  { id: 'zaklady-prvni-pomoci',        name: 'Základy první pomoci',                         zkratky: ['ZP'],  testCount: 4 },
]

const TEST_STRUCTURE = [
  { groups: ['plavebni-provoz'],                                                                    count: 16 },
  { groups: ['nocni-denni-signalizace'],                                                            count: 7 },
  { groups: ['signalizace-rizeni-plavby', 'zvukove-signaly', 'vytyceni-vodnich-cest'],              count: 5 },
  { groups: ['zaklady-konstrukce-plavidel'],                                                        count: 3 },
  { groups: ['zaklady-prvni-pomoci'],                                                               count: 4 },
]

async function downloadImage(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch ${url}: ${res.status}`)
  await pipeline(res.body, createWriteStream(dest))
}

function normalizeWs(s) {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

async function main() {
  console.log(`Fetching ${SOURCE_URL} ...`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)

  mkdirSync(OUT_IMG_DIR, { recursive: true })

  const questions = []
  let currentZkratka = null
  let currentNum = null
  let currentBuf = null

  // Walk all <tr> elements in order. The page is a flat table.
  $('tr').each((_, tr) => {
    const $tr = $(tr)

    // Header row of a question: <tr class="bg"> ... č. N ... Zkratka ...
    if ($tr.hasClass('bg')) {
      // Flush previous
      if (currentBuf && currentBuf.text && currentBuf.options.length === 3 && currentBuf.correct) {
        questions.push(currentBuf)
      }
      const tds = $tr.find('td')
      const cislo = parseInt(($(tds[0]).text().match(/\d+/) || ['0'])[0], 10)
      const zkrText = $(tds[1]).text()
      const zkrMatch = zkrText.match(/(PP1|PP2|PP3|PP4|TZ|ZP)\s*2015/)
      currentZkratka = zkrMatch ? zkrMatch[1] : null
      currentNum = cislo
      currentBuf = {
        zkratka: currentZkratka,
        num: currentNum,
        text: '',
        image: null,
        options: [],
        correct: null,
      }
      return
    }

    if (!currentBuf) return

    const $th = $tr.find('th').first()
    const headerText = normalizeWs($th.text())

    // "Otázka" — question text + maybe image
    if (headerText.startsWith('Otázka')) {
      const $tds = $tr.find('td')
      currentBuf.text = normalizeWs($tds.first().text())
      const $img = $tr.find('img').first()
      if ($img.length) {
        currentBuf.image = $img.attr('src') || null
      }
      return
    }

    // "Správná odpověď a)" / "Odpověď b)" / "Odpověď c)"
    const optMatch = headerText.match(/Odpověď\s*([abc])\)/)
    const correctMatch = headerText.match(/Správná\s+odpověď\s*([abc])\)/)
    if (correctMatch) {
      const key = correctMatch[1]
      currentBuf.options.push({ key, text: normalizeWs($tr.find('td').first().text()) })
      currentBuf.correct = key
      return
    }
    if (optMatch) {
      const key = optMatch[1]
      currentBuf.options.push({ key, text: normalizeWs($tr.find('td').first().text()) })
      return
    }
  })

  // Flush last
  if (currentBuf && currentBuf.text && currentBuf.options.length === 3 && currentBuf.correct) {
    questions.push(currentBuf)
  }

  // Sort options a/b/c
  for (const q of questions) {
    q.options.sort((a, b) => a.key.localeCompare(b.key))
  }

  // Assign global IDs (1..N) and download images
  const final = []
  let id = 1
  for (const q of questions) {
    if (!q.zkratka || !ZKRATKA_TO_GROUP[q.zkratka]) {
      console.warn(`Skipping question without zkratka: ${q.text.slice(0, 60)}`)
      continue
    }
    let imageRel = null
    if (q.image) {
      const ext = q.image.split('.').pop().split('?')[0]
      const filename = `q-${id}.${ext}`
      const dest = join(OUT_IMG_DIR, filename)
      try {
        await downloadImage(q.image, dest)
        imageRel = `/data/images/${filename}`
      } catch (e) {
        console.warn(`Image fail for #${id}: ${e.message}`)
      }
    }
    final.push({
      id,
      zkratka: q.zkratka,
      group: ZKRATKA_TO_GROUP[q.zkratka],
      text: q.text,
      image: imageRel,
      options: q.options,
      correct: q.correct,
    })
    id++
  }

  const bundle = {
    version: 'M-2015',
    scrapedAt: new Date().toISOString(),
    groups: GROUPS,
    testStructure: TEST_STRUCTURE,
    questions: final,
  }

  mkdirSync(dirname(OUT_JSON), { recursive: true })
  writeFileSync(OUT_JSON, JSON.stringify(bundle, null, 2), 'utf8')
  console.log(`Wrote ${final.length} questions to ${OUT_JSON}`)
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 3: Run scraper**

```bash
pnpm scrape
```

Expected: console output `Wrote NNN questions to ...`. NNN should be ~400.

- [ ] **Step 4: Verify output**

```bash
node -e 'const d=require("./public/data/questions.json"); console.log("count:", d.questions.length); console.log("first:", JSON.stringify(d.questions[0], null, 2)); console.log("by zkratka:", d.questions.reduce((a,q)=>(a[q.zkratka]=(a[q.zkratka]||0)+1, a), {}))'
```

Expected: count > 350. First question has all fields. Distribution shows PP1, PP2, PP3, PP4, TZ, ZP.

- [ ] **Step 5: Spot-check images downloaded**

```bash
ls public/data/images | head -5
ls public/data/images | wc -l
```

Expected: PNG/JPG files present, count > 50.

- [ ] **Step 6: Commit**

```bash
git add scripts/scrape.mjs public/data/
git commit -m "Add scraper for spspraha.cz VMP M 2015 questions"
```

---

## Phase C: Pure logic libs (TDD)

### Task 4: Test structure sampling (`testStructure.ts`)

**Files:**
- Create: `src/lib/testStructure.ts`, `src/lib/testStructure.test.ts`

- [ ] **Step 1: Write failing test `src/lib/testStructure.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { sampleTestQuestions } from './testStructure'
import type { Question, TestSegment } from '../types'

function makeQ(id: number, group: Question['group']): Question {
  return {
    id, zkratka: 'PP1', group, text: `q${id}`, image: null,
    options: [{ key: 'a', text: 'a' }, { key: 'b', text: 'b' }, { key: 'c', text: 'c' }],
    correct: 'a',
  }
}

describe('sampleTestQuestions', () => {
  const segments: TestSegment[] = [
    { groups: ['plavebni-provoz'], count: 2 },
    { groups: ['nocni-denni-signalizace'], count: 1 },
  ]

  const questions: Question[] = [
    ...Array.from({ length: 5 }, (_, i) => makeQ(100 + i, 'plavebni-provoz')),
    ...Array.from({ length: 3 }, (_, i) => makeQ(200 + i, 'nocni-denni-signalizace')),
    ...Array.from({ length: 2 }, (_, i) => makeQ(300 + i, 'zvukove-signaly')),
  ]

  it('returns exactly the requested count per segment', () => {
    const out = sampleTestQuestions(questions, segments, () => 0)
    expect(out).toHaveLength(3)
  })

  it('respects group restrictions per segment', () => {
    const out = sampleTestQuestions(questions, segments, () => 0)
    const ppCount = out.filter(q => q.group === 'plavebni-provoz').length
    const nsCount = out.filter(q => q.group === 'nocni-denni-signalizace').length
    expect(ppCount).toBe(2)
    expect(nsCount).toBe(1)
  })

  it('does not duplicate questions across segments', () => {
    const out = sampleTestQuestions(questions, segments, () => 0.5)
    const ids = out.map(q => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses provided RNG deterministically', () => {
    let i = 0
    const rng = () => [0.1, 0.5, 0.9][i++ % 3]
    const a = sampleTestQuestions(questions, segments, rng)
    i = 0
    const b = sampleTestQuestions(questions, segments, rng)
    expect(a.map(q => q.id)).toEqual(b.map(q => q.id))
  })

  it('throws when not enough questions in a segment', () => {
    const tooMany: TestSegment[] = [{ groups: ['plavebni-provoz'], count: 100 }]
    expect(() => sampleTestQuestions(questions, tooMany, () => 0)).toThrow(/not enough/i)
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm test src/lib/testStructure.test.ts`
Expected: FAIL — `sampleTestQuestions` not found.

- [ ] **Step 3: Implement `src/lib/testStructure.ts`**

```typescript
import type { Question, TestSegment } from '../types'

export type RNG = () => number

/**
 * Fisher-Yates shuffle returning a new array, using provided RNG.
 */
function shuffle<T>(arr: T[], rng: RNG): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Sample questions according to test structure segments.
 * Each segment requests N questions from a list of allowed groups.
 * Questions are not duplicated across segments.
 *
 * Throws if any segment cannot be satisfied.
 */
export function sampleTestQuestions(
  questions: Question[],
  segments: TestSegment[],
  rng: RNG = Math.random,
): Question[] {
  const used = new Set<number>()
  const result: Question[] = []
  for (const seg of segments) {
    const pool = questions.filter(q => seg.groups.includes(q.group) && !used.has(q.id))
    if (pool.length < seg.count) {
      throw new Error(
        `Not enough questions for segment groups=${seg.groups.join(',')}: have ${pool.length}, need ${seg.count}`,
      )
    }
    const picked = shuffle(pool, rng).slice(0, seg.count)
    for (const q of picked) used.add(q.id)
    result.push(...picked)
  }
  return result
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm test src/lib/testStructure.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/testStructure.ts src/lib/testStructure.test.ts
git commit -m "Add testStructure: sample questions per real-test segments"
```

---

### Task 5: Smart mix algorithm (`sampleQuestions.ts`)

**Files:**
- Create: `src/lib/sampleQuestions.ts`, `src/lib/sampleQuestions.test.ts`

- [ ] **Step 1: Write failing test `src/lib/sampleQuestions.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { sampleByMix, computeBucket } from './sampleQuestions'
import type { Question, ProgressStore } from '../types'

function makeQ(id: number): Question {
  return {
    id, zkratka: 'PP1', group: 'plavebni-provoz', text: `q${id}`, image: null,
    options: [{ key: 'a', text: 'a' }, { key: 'b', text: 'b' }, { key: 'c', text: 'c' }],
    correct: 'a',
  }
}

const NOW = new Date('2026-05-04T12:00:00Z').getTime()
const day = 86_400_000

describe('computeBucket', () => {
  it('returns "new" for unseen question', () => {
    expect(computeBucket(undefined, NOW)).toBe('new')
    expect(computeBucket({ attempts: [], lastSeen: '' }, NOW)).toBe('new')
  })

  it('returns "weak" when error rate > 0.4', () => {
    const p = {
      attempts: [
        { at: '2026-05-01T00:00:00Z', correct: false, mode: 'practice' as const },
        { at: '2026-05-02T00:00:00Z', correct: false, mode: 'practice' as const },
        { at: '2026-05-03T00:00:00Z', correct: true,  mode: 'practice' as const },
      ],
      lastSeen: '2026-05-03T00:00:00Z',
    }
    expect(computeBucket(p, NOW)).toBe('weak')
  })

  it('returns "stale" when last seen > 7 days ago', () => {
    const p = {
      attempts: [{ at: '2026-04-01T00:00:00Z', correct: true, mode: 'practice' as const }],
      lastSeen: '2026-04-01T00:00:00Z',
    }
    expect(computeBucket(p, NOW)).toBe('stale')
  })

  it('returns "known" when recent and high success', () => {
    const p = {
      attempts: [{ at: '2026-05-03T00:00:00Z', correct: true, mode: 'practice' as const }],
      lastSeen: '2026-05-03T00:00:00Z',
    }
    expect(computeBucket(p, NOW)).toBe('known')
  })
})

describe('sampleByMix', () => {
  const all: Question[] = Array.from({ length: 100 }, (_, i) => makeQ(i + 1))

  it('returns exactly N questions', () => {
    const out = sampleByMix(all, {} as ProgressStore['questions'], 'mix', 10, NOW, () => 0.5)
    expect(out).toHaveLength(10)
  })

  it('returns all unique', () => {
    const out = sampleByMix(all, {}, 'mix', 30, NOW, () => 0.3)
    expect(new Set(out.map(q => q.id)).size).toBe(out.length)
  })

  it('"random" picks from all uniformly (no progress influence)', () => {
    const progress = { 1: { attempts: [{ at: '2026-04-01', correct: false, mode: 'practice' }, { at: '2026-04-02', correct: false, mode: 'practice' }], lastSeen: '2026-04-02' } } as any
    let calls = 0
    const rng = () => { calls++; return 0.1 }
    const out = sampleByMix(all, progress, 'random', 10, NOW, rng)
    expect(out).toHaveLength(10)
    expect(calls).toBeGreaterThan(0)
  })

  it('"weak" prioritizes high-error questions, falls back to others if not enough', () => {
    const progress: ProgressStore['questions'] = {}
    for (let i = 1; i <= 5; i++) {
      progress[i] = {
        attempts: [
          { at: '2026-05-01T00:00:00Z', correct: false, mode: 'practice' },
          { at: '2026-05-02T00:00:00Z', correct: false, mode: 'practice' },
        ],
        lastSeen: '2026-05-02T00:00:00Z',
      }
    }
    const out = sampleByMix(all, progress, 'weak', 10, NOW, () => 0.5)
    const weakIds = out.filter(q => q.id <= 5)
    expect(weakIds.length).toBeGreaterThanOrEqual(5)
    expect(out).toHaveLength(10)
  })

  it('"mix" pulls roughly 40/30/15/15 from buckets when all have enough', () => {
    const progress: ProgressStore['questions'] = {}
    // 30 weak (id 1-30)
    for (let i = 1; i <= 30; i++) progress[i] = {
      attempts: [
        { at: '2026-05-01T00:00:00Z', correct: false, mode: 'practice' },
        { at: '2026-05-02T00:00:00Z', correct: false, mode: 'practice' },
      ],
      lastSeen: '2026-05-02T00:00:00Z',
    }
    // 30 known (id 31-60)
    for (let i = 31; i <= 60; i++) progress[i] = {
      attempts: [{ at: '2026-05-03T00:00:00Z', correct: true, mode: 'practice' }],
      lastSeen: '2026-05-03T00:00:00Z',
    }
    // 30 stale (id 61-90), seen > 7 days ago
    for (let i = 61; i <= 90; i++) progress[i] = {
      attempts: [{ at: '2026-04-20T00:00:00Z', correct: true, mode: 'practice' }],
      lastSeen: '2026-04-20T00:00:00Z',
    }
    // 10 new (id 91-100): no progress entry

    const out = sampleByMix(all, progress, 'mix', 100, NOW, () => 0.5)
    const buckets = { weak: 0, known: 0, stale: 0, new: 0 }
    for (const q of out) {
      if (q.id <= 30) buckets.weak++
      else if (q.id <= 60) buckets.known++
      else if (q.id <= 90) buckets.stale++
      else buckets.new++
    }
    // Expected ~40/15/15/30 → with N=100: 40/15/15/30
    expect(buckets.weak).toBe(40)
    expect(buckets.new).toBe(10) // capped by available
    expect(buckets.known + buckets.stale).toBe(50) // overflow filled
  })
})
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm test src/lib/sampleQuestions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/sampleQuestions.ts`**

```typescript
import type { Question, ProgressStore, QuestionProgress, MixMode } from '../types'

export type Bucket = 'new' | 'weak' | 'stale' | 'known'

export type RNG = () => number

const DAY_MS = 86_400_000
const WEAK_ERROR_RATE_THRESHOLD = 0.4
const STALE_DAYS = 7

export function computeBucket(progress: QuestionProgress | undefined, nowMs: number): Bucket {
  if (!progress || !progress.attempts || progress.attempts.length === 0) return 'new'
  const errors = progress.attempts.filter(a => !a.correct).length
  const errorRate = errors / progress.attempts.length
  if (errorRate > WEAK_ERROR_RATE_THRESHOLD) return 'weak'
  const lastSeenMs = progress.lastSeen ? new Date(progress.lastSeen).getTime() : 0
  const daysSince = (nowMs - lastSeenMs) / DAY_MS
  if (!progress.lastSeen || daysSince > STALE_DAYS) return 'stale'
  return 'known'
}

function shuffle<T>(arr: T[], rng: RNG): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const TARGETS: Record<Bucket, number> = { weak: 0.40, new: 0.30, stale: 0.15, known: 0.15 }
const FILL_ORDER: Bucket[] = ['known', 'weak', 'stale', 'new']

export function sampleByMix(
  pool: Question[],
  progress: ProgressStore['questions'],
  mode: MixMode,
  count: number,
  nowMs: number,
  rng: RNG = Math.random,
): Question[] {
  if (count >= pool.length) return shuffle(pool, rng).slice(0, count)

  if (mode === 'random') {
    return shuffle(pool, rng).slice(0, count)
  }

  // Bucketize
  const buckets: Record<Bucket, Question[]> = { new: [], weak: [], stale: [], known: [] }
  for (const q of pool) buckets[computeBucket(progress[q.id], nowMs)].push(q)
  for (const b of Object.keys(buckets) as Bucket[]) buckets[b] = shuffle(buckets[b], rng)

  if (mode === 'weak') {
    const result: Question[] = []
    for (const q of buckets.weak) { if (result.length < count) result.push(q) }
    for (const b of FILL_ORDER) {
      for (const q of buckets[b]) {
        if (result.length >= count) break
        if (!result.includes(q)) result.push(q)
      }
    }
    return shuffle(result, rng).slice(0, count)
  }

  // mix
  const targetCounts: Record<Bucket, number> = {
    weak: Math.round(count * TARGETS.weak),
    new: Math.round(count * TARGETS.new),
    stale: Math.round(count * TARGETS.stale),
    known: Math.round(count * TARGETS.known),
  }
  // adjust rounding
  const sumTargets = Object.values(targetCounts).reduce((s, v) => s + v, 0)
  if (sumTargets !== count) targetCounts.weak += (count - sumTargets)

  const taken: Question[] = []
  const overflow: Bucket[] = []
  for (const b of ['weak', 'new', 'stale', 'known'] as Bucket[]) {
    const desired = targetCounts[b]
    const taken_b = buckets[b].slice(0, desired)
    taken.push(...taken_b)
    if (taken_b.length < desired) overflow.push(b)
  }
  // cascade-fill from FILL_ORDER if missing
  if (taken.length < count) {
    for (const b of FILL_ORDER) {
      const remaining = buckets[b].filter(q => !taken.includes(q))
      for (const q of remaining) {
        if (taken.length >= count) break
        taken.push(q)
      }
      if (taken.length >= count) break
    }
  }
  return shuffle(taken, rng).slice(0, count)
}
```

- [ ] **Step 4: Run, verify all pass**

Run: `pnpm test src/lib/sampleQuestions.test.ts`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sampleQuestions.ts src/lib/sampleQuestions.test.ts
git commit -m "Add sampleByMix: smart mix algorithm with weak/new/stale/known buckets"
```

---

### Task 6: Cowork link builder (`coworkLink.ts`)

**Files:**
- Create: `src/lib/coworkLink.ts`, `src/lib/coworkLink.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'
import { buildExplainLink } from './coworkLink'

describe('buildExplainLink', () => {
  it('builds claude://cowork/new with q and folder', () => {
    const url = buildExplainLink({ qid: 12, folder: '/Users/me/repo' })
    expect(url.startsWith('claude://cowork/new?')).toBe(true)
    expect(url).toContain('folder=%2FUsers%2Fme%2Frepo')
    expect(url).toContain('q=')
  })

  it('encodes the prompt mentioning the skill and qid', () => {
    const url = buildExplainLink({ qid: 7, folder: '/x' })
    const params = new URLSearchParams(url.split('?')[1])
    const q = params.get('q') ?? ''
    expect(q).toContain('explain-vmp-question')
    expect(q).toContain('#7')
  })

  it('throws on missing folder', () => {
    expect(() => buildExplainLink({ qid: 1, folder: '' })).toThrow(/folder/)
  })
})
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm test src/lib/coworkLink.test.ts`
Expected: FAIL — `buildExplainLink` not found.

- [ ] **Step 3: Implement**

```typescript
export interface ExplainLinkParams {
  qid: number
  folder: string
}

export function buildExplainLink({ qid, folder }: ExplainLinkParams): string {
  if (!folder) throw new Error('folder is required')
  const prompt = `Použij skill explain-vmp-question pro otázku #${qid}. Načti otázku z public/data/questions.json, prozkoumej kontext a ulož HTML do explanations/q-${qid}.html spolu s metadaty.`
  const params = new URLSearchParams({ q: prompt, folder })
  return `claude://cowork/new?${params.toString()}`
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `pnpm test src/lib/coworkLink.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/coworkLink.ts src/lib/coworkLink.test.ts
git commit -m "Add coworkLink: build claude://cowork/new explain links"
```

---

### Task 7: HTML sanitizer (`sanitize.ts`)

**Files:**
- Create: `src/lib/sanitize.ts`

- [ ] **Step 1: Write `src/lib/sanitize.ts`**

```typescript
import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'h1','h2','h3','h4','h5','h6',
  'p','br','strong','em','u','code','pre','blockquote',
  'ul','ol','li','a','img','table','thead','tbody','tr','td','th',
  'div','span','hr',
]

const ALLOWED_ATTR = ['href','title','alt','src','class','id','target','rel']

export function sanitizeExplanationHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script','style','iframe','object','embed','form','input','button','link','meta'],
  })
}
```

- [ ] **Step 2: Smoke test (no test file — exercised by ExplainModal tests later)**

Run: `pnpm test`
Expected: pre-existing tests pass; no regression.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sanitize.ts
git commit -m "Add sanitize: DOMPurify wrapper for explanation HTML"
```

---

## Phase D: Hooks

### Task 8: `useQuestions` hook

**Files:**
- Create: `src/hooks/useQuestions.ts`

- [ ] **Step 1: Implement**

```typescript
import { useEffect, useState } from 'react'
import type { QuestionsBundle } from '../types'

export interface UseQuestionsResult {
  data: QuestionsBundle | null
  error: Error | null
  loading: boolean
}

export function useQuestions(): UseQuestionsResult {
  const [data, setData] = useState<QuestionsBundle | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/data/questions.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} loading questions.json — run \`pnpm scrape\``)
        return r.json() as Promise<QuestionsBundle>
      })
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e as Error); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  return { data, error, loading }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useQuestions.ts
git commit -m "Add useQuestions hook"
```

---

### Task 9: `useProgress` hook

**Files:**
- Create: `src/hooks/useProgress.ts`, `src/hooks/useProgress.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProgress } from './useProgress'

describe('useProgress', () => {
  beforeEach(() => { localStorage.clear() })

  it('initializes empty', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.store.questions).toEqual({})
    expect(result.current.store.testHistory).toEqual([])
  })

  it('records an attempt and persists to localStorage', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.recordAttempt(42, true, 'practice')
    })
    expect(result.current.store.questions[42].attempts).toHaveLength(1)
    expect(result.current.store.questions[42].attempts[0].correct).toBe(true)
    const raw = JSON.parse(localStorage.getItem('vmp:progress')!)
    expect(raw.questions[42].attempts).toHaveLength(1)
  })

  it('records test history', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.recordTestHistory({
        at: new Date().toISOString(),
        score: 32, total: 35, durationSec: 1800,
        perGroup: {} as any, questionIds: [1,2,3],
      })
    })
    expect(result.current.store.testHistory).toHaveLength(1)
  })

  it('reset clears storage', () => {
    const { result } = renderHook(() => useProgress())
    act(() => { result.current.recordAttempt(1, true, 'practice') })
    act(() => { result.current.reset() })
    expect(result.current.store.questions).toEqual({})
    expect(localStorage.getItem('vmp:progress')).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm test src/hooks/useProgress.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/hooks/useProgress.ts`**

```typescript
import { useCallback, useEffect, useState } from 'react'
import type { ProgressStore, AnswerMode, TestHistoryEntry } from '../types'

const KEY = 'vmp:progress'
const VERSION_KEY = 'vmp:version'
const VERSION = 1

const empty: ProgressStore = { questions: {}, testHistory: [] }

function load(): ProgressStore {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as ProgressStore
    return { questions: parsed.questions ?? {}, testHistory: parsed.testHistory ?? [] }
  } catch {
    return empty
  }
}

function save(store: ProgressStore) {
  localStorage.setItem(KEY, JSON.stringify(store))
  localStorage.setItem(VERSION_KEY, String(VERSION))
}

export function useProgress() {
  const [store, setStore] = useState<ProgressStore>(() => load())

  useEffect(() => { save(store) }, [store])

  const recordAttempt = useCallback((qid: number, correct: boolean, mode: AnswerMode) => {
    setStore(prev => {
      const cur = prev.questions[qid] ?? { attempts: [], lastSeen: '' }
      const at = new Date().toISOString()
      return {
        ...prev,
        questions: {
          ...prev.questions,
          [qid]: {
            attempts: [...cur.attempts, { at, correct, mode }],
            lastSeen: at,
          },
        },
      }
    })
  }, [])

  const recordTestHistory = useCallback((entry: TestHistoryEntry) => {
    setStore(prev => ({ ...prev, testHistory: [entry, ...prev.testHistory].slice(0, 50) }))
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem(KEY)
    localStorage.removeItem(VERSION_KEY)
    setStore({ questions: {}, testHistory: [] })
  }, [])

  return { store, recordAttempt, recordTestHistory, reset }
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `pnpm test src/hooks/useProgress.test.tsx`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useProgress.ts src/hooks/useProgress.test.tsx
git commit -m "Add useProgress hook with localStorage persistence"
```

---

### Task 10: `useExplanations` hook

**Files:**
- Create: `src/hooks/useExplanations.ts`

- [ ] **Step 1: Implement**

```typescript
import { useCallback, useState } from 'react'
import type { ExplanationMeta } from '../types'

export interface ExplanationFetchResult {
  status: 'hit' | 'miss'
  html?: string
  meta?: ExplanationMeta
}

export function useExplanations() {
  const [cache, setCache] = useState<Record<number, ExplanationFetchResult>>({})

  const fetchExplanation = useCallback(async (qid: number, force = false): Promise<ExplanationFetchResult> => {
    if (!force && cache[qid]) return cache[qid]
    try {
      const htmlRes = await fetch(`/explanations/q-${qid}.html`, { cache: 'no-store' })
      if (htmlRes.status === 404) {
        const r: ExplanationFetchResult = { status: 'miss' }
        setCache(c => ({ ...c, [qid]: r }))
        return r
      }
      if (!htmlRes.ok) throw new Error(`HTTP ${htmlRes.status}`)
      const html = await htmlRes.text()
      let meta: ExplanationMeta | undefined
      try {
        const metaRes = await fetch(`/explanations/q-${qid}.meta.json`, { cache: 'no-store' })
        if (metaRes.ok) meta = await metaRes.json()
      } catch { /* meta optional */ }
      const r: ExplanationFetchResult = { status: 'hit', html, meta }
      setCache(c => ({ ...c, [qid]: r }))
      return r
    } catch (e) {
      const r: ExplanationFetchResult = { status: 'miss' }
      setCache(c => ({ ...c, [qid]: r }))
      return r
    }
  }, [cache])

  return { fetchExplanation, cache }
}
```

> **Note:** Vite serves files from `public/` and project root. We need explanations/ to be served too. We'll handle that in Task 11 by symlinking or via a tiny Vite middleware. For now, the hook assumes `/explanations/q-{id}.html` is reachable.

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useExplanations.ts
git commit -m "Add useExplanations hook with cache hit/miss"
```

---

### Task 11: Vite plugin to serve `explanations/` from project root

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Update `vite.config.ts` to serve `/explanations/*` from repo root**

```typescript
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

const explanationsRoot = path.resolve(__dirname, 'explanations')

function serveExplanations() {
  return {
    name: 'serve-explanations',
    configureServer(server: any) {
      server.middlewares.use('/explanations', (req: any, res: any, next: any) => {
        const url = (req.url || '').split('?')[0]
        const filePath = path.join(explanationsRoot, url)
        if (!filePath.startsWith(explanationsRoot)) { res.statusCode = 403; return res.end() }
        if (!existsSync(filePath)) { res.statusCode = 404; return res.end() }
        const ext = path.extname(filePath).toLowerCase()
        const ct = ext === '.html' ? 'text/html; charset=utf-8'
                 : ext === '.json' ? 'application/json'
                 : 'application/octet-stream'
        res.setHeader('Content-Type', ct)
        res.end(readFileSync(filePath))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), serveExplanations()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

- [ ] **Step 2: Create explanations dir + sample to verify**

```bash
mkdir -p explanations
echo '<h1>Test</h1>' > explanations/q-1.html
```

- [ ] **Step 3: Verify Vite serves it**

```bash
pnpm dev &
sleep 2
curl -s http://localhost:5173/explanations/q-1.html
kill %1
```

Expected: `<h1>Test</h1>`.

- [ ] **Step 4: Remove sample file**

```bash
rm explanations/q-1.html
```

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts
git commit -m "Vite plugin: serve /explanations/* from repo root"
```

---

## Phase E: App shell

### Task 12: Routing + sidebar layout

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/Sidebar.tsx`
- Create: stub files for routes (will fill in later phases)

- [ ] **Step 1: Install router**

```bash
pnpm add react-router-dom
```

- [ ] **Step 2: Create stubbed route files**

```bash
mkdir -p src/routes
for f in Home Test Practice Weak Stats Settings; do
  cat > "src/routes/$f.tsx" <<EOF
export default function $f() {
  return <div className="p-6"><h2 className="text-xl font-semibold">$f</h2></div>
}
EOF
done
```

- [ ] **Step 3: Write `src/components/Sidebar.tsx`**

```tsx
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/',         label: '▶ Ostrý test',   highlight: true },
  { to: '/practice', label: '📚 Procvičování' },
  { to: '/weak',     label: '🎯 Slabiny' },
  { to: '/stats',    label: '📊 Statistiky' },
  { to: '/settings', label: '⚙ Nastavení' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 shrink-0 bg-white border-r border-neutral-200 p-4 flex flex-col gap-1">
      <div className="font-bold text-base mb-4">⚓ VMP M Trenažér</div>
      {items.map(i => (
        <NavLink key={i.to} to={i.to} end className={({ isActive }) => `px-3 py-2 rounded text-sm ${isActive ? 'bg-primary-light text-primary-dark font-medium' : 'text-neutral-700 hover:bg-neutral-100'}`}>
          {i.label}
        </NavLink>
      ))}
    </aside>
  )
}
```

- [ ] **Step 4: Replace `src/App.tsx`**

```tsx
import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './routes/Home'
import Test from './routes/Test'
import Practice from './routes/Practice'
import Weak from './routes/Weak'
import Stats from './routes/Stats'
import Settings from './routes/Settings'

export default function App() {
  return (
    <HashRouter>
      <div className="flex h-screen">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/test" element={<Test />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/weak" element={<Weak />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
```

- [ ] **Step 5: Verify dev server**

Run: `pnpm dev` and visit `http://localhost:5173`. Click each sidebar item. Expected: each navigates to a stub page. Stop with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add routing and sidebar layout"
```

---

## Phase F: Core components

### Task 13: `QuestionCard` component

**Files:**
- Create: `src/components/QuestionCard.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { Question } from '../types'

interface Props {
  question: Question
  selectedKey: 'a' | 'b' | 'c' | null
  revealedCorrect: 'a' | 'b' | 'c' | null  // when null = not revealed; non-null = reveal mode
  onSelect: (key: 'a' | 'b' | 'c') => void
}

export default function QuestionCard({ question, selectedKey, revealedCorrect, onSelect }: Props) {
  return (
    <div>
      {question.image && (
        <div className="mb-4">
          <img src={question.image} alt="" className="max-h-64 rounded border border-neutral-200" />
        </div>
      )}
      <div className="text-base font-semibold leading-snug mb-4">{question.text}</div>
      <div className="flex flex-col gap-2">
        {question.options.map(opt => {
          const isSelected = selectedKey === opt.key
          const isCorrect = revealedCorrect === opt.key
          const isWrongChosen = revealedCorrect !== null && isSelected && !isCorrect
          let cls = 'border rounded px-4 py-3 text-sm cursor-pointer transition'
          if (revealedCorrect !== null) {
            cls += isCorrect ? ' border-primary bg-primary-light'
                 : isWrongChosen ? ' border-danger bg-danger-light'
                 : ' border-neutral-200 text-neutral-500'
          } else {
            cls += isSelected ? ' border-accent bg-accent/5' : ' border-neutral-200 hover:border-neutral-400'
          }
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => revealedCorrect === null && onSelect(opt.key)}
              className={cls}
              disabled={revealedCorrect !== null}
            >
              <span className="text-neutral-500 font-semibold mr-2">{opt.key})</span>
              {opt.text}
              {revealedCorrect === opt.key && <span className="ml-2 text-primary-dark text-xs font-medium">✓ správně</span>}
              {isWrongChosen && <span className="ml-2 text-danger text-xs font-medium">✗ tvoje odpověď</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/QuestionCard.tsx
git commit -m "Add QuestionCard component"
```

---

### Task 14: `Timer` component

**Files:**
- Create: `src/components/Timer.tsx`, `src/components/Timer.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import Timer from './Timer'

describe('Timer', () => {
  it('renders mm:ss', () => {
    const { container } = render(<Timer remainingSec={150} />)
    expect(container.textContent).toContain('02:30')
  })

  it('calls onExpire when count reaches 0', async () => {
    vi.useFakeTimers()
    const onExpire = vi.fn()
    render(<Timer remainingSec={2} onExpire={onExpire} ticking />)
    act(() => { vi.advanceTimersByTime(2100) })
    expect(onExpire).toHaveBeenCalled()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm test src/components/Timer.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/components/Timer.tsx`**

```tsx
import { useEffect, useState } from 'react'

interface Props {
  remainingSec: number
  ticking?: boolean
  onExpire?: () => void
}

function fmt(s: number) {
  const mm = Math.floor(s / 60).toString().padStart(2, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

export default function Timer({ remainingSec, ticking, onExpire }: Props) {
  const [s, setS] = useState(remainingSec)
  useEffect(() => { setS(remainingSec) }, [remainingSec])
  useEffect(() => {
    if (!ticking) return
    if (s <= 0) { onExpire?.(); return }
    const id = setInterval(() => setS(prev => Math.max(0, prev - 1)), 1000)
    return () => clearInterval(id)
  }, [ticking, s, onExpire])
  return <span className={`tabular-nums ${s <= 60 ? 'text-danger' : ''}`}>⏱ {fmt(s)}</span>
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `pnpm test src/components/Timer.test.tsx`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/Timer.tsx src/components/Timer.test.tsx
git commit -m "Add Timer component"
```

---

### Task 15: `ExplainModal` + `ExplainButton`

**Files:**
- Create: `src/components/ExplainModal.tsx`, `src/components/ExplainButton.tsx`

- [ ] **Step 1: Write `src/components/ExplainModal.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useExplanations, type ExplanationFetchResult } from '../hooks/useExplanations'
import { sanitizeExplanationHtml } from '../lib/sanitize'
import { buildExplainLink } from '../lib/coworkLink'

interface Props {
  qid: number
  open: boolean
  onClose: () => void
  projectRoot: string
}

export default function ExplainModal({ qid, open, onClose, projectRoot }: Props) {
  const { fetchExplanation } = useExplanations()
  const [result, setResult] = useState<ExplanationFetchResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetchExplanation(qid).then(r => { setResult(r); setLoading(false) })
  }, [open, qid, fetchExplanation])

  if (!open) return null

  const reload = async () => {
    setLoading(true)
    const r = await fetchExplanation(qid, true)
    setResult(r); setLoading(false)
  }

  const coworkUrl = projectRoot ? buildExplainLink({ qid, folder: projectRoot }) : null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">Vysvětlení k otázce #{qid}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900">✕</button>
        </div>

        {loading && <div className="text-sm text-neutral-500">Načítám...</div>}

        {!loading && result?.status === 'hit' && (
          <>
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeExplanationHtml(result.html ?? '') }} />
            {result.meta?.session_url && (
              <a href={result.meta.session_url} className="inline-block mt-4 px-3 py-2 bg-accent text-white text-sm rounded">
                Pokračovat v Cowork ↗
              </a>
            )}
          </>
        )}

        {!loading && result?.status === 'miss' && (
          <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm">
            <p className="mb-3">Vysvětlení zatím nemáme.</p>
            {coworkUrl ? (
              <>
                <a href={coworkUrl} className="inline-block px-4 py-2 bg-primary text-white rounded font-medium">
                  ▶ Vygeneruj přes Cowork
                </a>
                <p className="mt-3 text-neutral-600">Po dokončení v Cowork klikni níže.</p>
                <button onClick={reload} className="mt-2 px-3 py-2 border border-neutral-300 rounded text-neutral-700 hover:bg-neutral-100 w-full">
                  ↻ Načíst výsledek
                </button>
              </>
            ) : (
              <p className="text-danger">Není nastavena cesta k repu — otevři Nastavení.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/ExplainButton.tsx`**

```tsx
import { useState } from 'react'
import ExplainModal from './ExplainModal'

interface Props {
  qid: number
  projectRoot: string
}

export default function ExplainButton({ qid, projectRoot }: Props) {
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
      <ExplainModal qid={qid} open={open} onClose={() => setOpen(false)} projectRoot={projectRoot} />
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ExplainModal.tsx src/components/ExplainButton.tsx
git commit -m "Add ExplainModal + ExplainButton with cache hit/miss + Cowork deep link"
```

---

## Phase G: Routes

### Task 16: `Home` route

**Files:**
- Modify: `src/routes/Home.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Link } from 'react-router-dom'
import { useProgress } from '../hooks/useProgress'

export default function Home() {
  const { store } = useProgress()
  const recent = store.testHistory.slice(0, 5)
  return (
    <div className="p-8 max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">Připraven na zkoušku?</h2>

      <Link to="/test" className="block bg-primary hover:bg-primary-dark text-white rounded-lg p-6 mb-6 transition">
        <div className="text-xs uppercase tracking-wide opacity-90">▶ Hlavní akce</div>
        <div className="text-2xl font-bold mt-1">Spustit ostrý test</div>
        <div className="text-sm opacity-90 mt-1">35 otázek · 30 minut · min. 30 bodů</div>
      </Link>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Link to="/practice" className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-primary transition">
          <div className="text-2xl">📚</div>
          <div className="font-semibold mt-1">Procvičování</div>
          <div className="text-xs text-neutral-500">oblasti / mix slabin</div>
        </Link>
        <Link to="/weak" className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-primary transition">
          <div className="text-2xl">🎯</div>
          <div className="font-semibold mt-1">Slabiny</div>
          <div className="text-xs text-neutral-500">opakuj co pleteš</div>
        </Link>
        <Link to="/stats" className="bg-white border border-neutral-200 rounded-lg p-4 hover:border-primary transition">
          <div className="text-2xl">📊</div>
          <div className="font-semibold mt-1">Statistiky</div>
          <div className="text-xs text-neutral-500">úspěšnost</div>
        </Link>
      </div>

      {recent.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Posledních 5 testů</div>
          <div className="flex flex-col gap-2">
            {recent.map((t, i) => {
              const pct = (t.score / t.total) * 100
              const passed = t.score >= 30
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-neutral-500 w-24">{new Date(t.at).toLocaleString()}</span>
                  <div className="flex-1 bg-neutral-100 h-3 rounded">
                    <div className={`h-3 rounded ${passed ? 'bg-primary' : 'bg-danger'}`} style={{ width: `${pct}%` }}/>
                  </div>
                  <span className="font-semibold tabular-nums">{t.score}/{t.total}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify visually**

Run: `pnpm dev`, open `/` → check layout. Stop server.

- [ ] **Step 3: Commit**

```bash
git add src/routes/Home.tsx
git commit -m "Implement Home route"
```

---

### Task 17: `Test` route — runner

**Files:**
- Modify: `src/routes/Test.tsx`
- Create: `src/components/TestResults.tsx`

- [ ] **Step 1: Implement `src/routes/Test.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuestions } from '../hooks/useQuestions'
import { useProgress } from '../hooks/useProgress'
import { sampleTestQuestions } from '../lib/testStructure'
import QuestionCard from '../components/QuestionCard'
import Timer from '../components/Timer'
import TestResults from '../components/TestResults'
import type { Question, GroupId } from '../types'

const TIMER_SEC = 30 * 60

export default function Test() {
  const { data, error, loading } = useQuestions()
  const { recordAttempt, recordTestHistory } = useProgress()
  const navigate = useNavigate()

  const sampled = useMemo<Question[]>(() => {
    if (!data) return []
    return sampleTestQuestions(data.questions, data.testStructure)
  }, [data])

  const [answers, setAnswers] = useState<Record<number, 'a'|'b'|'c'>>({})
  const [idx, setIdx] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [startedAt] = useState(() => Date.now())

  if (loading) return <div className="p-8">Načítám otázky…</div>
  if (error) return <div className="p-8 text-danger">Chyba: {error.message}</div>
  if (!data || sampled.length === 0) return <div className="p-8">Žádné otázky.</div>

  const q = sampled[idx]
  const answeredCount = Object.keys(answers).length

  const submit = () => {
    setSubmitted(true)
    const at = new Date().toISOString()
    let score = 0
    const perGroup: Record<GroupId, { correct: number; total: number }> = {} as any
    for (const sq of sampled) {
      const ans = answers[sq.id]
      const correct = ans === sq.correct
      if (correct) score++
      recordAttempt(sq.id, correct, 'test')
      const g = sq.group
      if (!perGroup[g]) perGroup[g] = { correct: 0, total: 0 }
      perGroup[g].total++
      if (correct) perGroup[g].correct++
    }
    recordTestHistory({
      at, score, total: sampled.length,
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      perGroup,
      questionIds: sampled.map(s => s.id),
    })
  }

  if (submitted) {
    return <TestResults questions={sampled} answers={answers} onHome={() => navigate('/')} projectRoot={import.meta.env.VITE_PROJECT_ROOT ?? ''} />
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex justify-between items-center mb-2 text-sm">
        <span className="text-neutral-500">Otázka <strong className="text-neutral-900">{idx + 1} / {sampled.length}</strong> · {q.group}</span>
        <Timer remainingSec={TIMER_SEC - Math.round((Date.now() - startedAt) / 1000)} ticking onExpire={submit} />
      </div>
      <div className="h-1 bg-neutral-200 rounded mb-6">
        <div className="h-1 bg-primary rounded" style={{ width: `${((idx+1)/sampled.length)*100}%` }}/>
      </div>

      <QuestionCard
        question={q}
        selectedKey={answers[q.id] ?? null}
        revealedCorrect={null}
        onSelect={(k) => setAnswers(a => ({ ...a, [q.id]: k }))}
      />

      <div className="flex justify-between items-center mt-6">
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} className="px-4 py-2 border border-neutral-300 rounded text-sm" disabled={idx === 0}>← Předchozí</button>
        <span className="text-xs text-neutral-500">Odpovězeno: {answeredCount} / {sampled.length}</span>
        {idx < sampled.length - 1 ? (
          <button onClick={() => setIdx(i => i + 1)} className="px-4 py-2 bg-primary text-white rounded text-sm">Další →</button>
        ) : (
          <button onClick={submit} className="px-4 py-2 bg-primary text-white rounded text-sm font-semibold">Odeslat test</button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `src/components/TestResults.tsx`**

```tsx
import type { Question, GroupId } from '../types'
import QuestionCard from './QuestionCard'
import ExplainButton from './ExplainButton'

interface Props {
  questions: Question[]
  answers: Record<number, 'a'|'b'|'c'>
  projectRoot: string
  onHome: () => void
}

export default function TestResults({ questions, answers, projectRoot, onHome }: Props) {
  const score = questions.filter(q => answers[q.id] === q.correct).length
  const passed = score >= 30
  const perGroup: Record<GroupId, { correct: number; total: number }> = {} as any
  for (const q of questions) {
    if (!perGroup[q.group]) perGroup[q.group] = { correct: 0, total: 0 }
    perGroup[q.group].total++
    if (answers[q.id] === q.correct) perGroup[q.group].correct++
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className={`rounded-lg p-6 mb-6 text-white ${passed ? 'bg-primary' : 'bg-danger'}`}>
        <div className="text-sm opacity-90">{passed ? 'Splněno!' : 'Nesplněno'}</div>
        <div className="text-3xl font-bold mt-1">{score} / {questions.length}</div>
        <div className="text-sm opacity-90 mt-1">Pro splnění je potřeba minimálně 30 bodů.</div>
      </div>

      <div className="mb-6 bg-white border border-neutral-200 rounded p-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Po skupinách</div>
        {Object.entries(perGroup).map(([g, s]) => (
          <div key={g} className="flex justify-between text-sm py-1">
            <span>{g}</span>
            <span className="tabular-nums">{s.correct}/{s.total}</span>
          </div>
        ))}
      </div>

      <h3 className="text-lg font-semibold mb-3">Otázky</h3>
      <div className="flex flex-col gap-6">
        {questions.map(q => (
          <div key={q.id} className="bg-white border border-neutral-200 rounded p-5">
            <QuestionCard question={q} selectedKey={answers[q.id] ?? null} revealedCorrect={q.correct} onSelect={() => {}} />
            <div className="mt-3"><ExplainButton qid={q.id} projectRoot={projectRoot} /></div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button onClick={onHome} className="px-4 py-2 bg-primary text-white rounded">Domů</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `pnpm dev`, navigate to `/test`. Pick answers, submit, see results. Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Test.tsx src/components/TestResults.tsx
git commit -m "Implement Test route with timer, navigation, results"
```

---

### Task 18: `Practice` route (setup screen + runner)

**Files:**
- Modify: `src/routes/Practice.tsx`
- Create: `src/components/PracticeRunner.tsx`

- [ ] **Step 1: Implement `src/routes/Practice.tsx`**

```tsx
import { useState } from 'react'
import { useQuestions } from '../hooks/useQuestions'
import { useProgress } from '../hooks/useProgress'
import { sampleTestQuestions } from '../lib/testStructure'
import { sampleByMix } from '../lib/sampleQuestions'
import PracticeRunner from '../components/PracticeRunner'
import type { Question, MixMode, GroupId } from '../types'

type SubMode = 'structure' | 'groups'

export default function Practice() {
  const { data, loading, error } = useQuestions()
  const { store } = useProgress()
  const [subMode, setSubMode] = useState<SubMode>('structure')
  const [mix, setMix] = useState<MixMode>('mix')
  const [count, setCount] = useState(25)
  const [selectedGroups, setSelectedGroups] = useState<GroupId[]>([])
  const [run, setRun] = useState<Question[] | null>(null)

  if (loading) return <div className="p-8">Načítám…</div>
  if (error) return <div className="p-8 text-danger">{error.message}</div>
  if (!data) return null

  if (run) return <PracticeRunner questions={run} onDone={() => setRun(null)} />

  const start = () => {
    let pool: Question[]
    let final: Question[]
    if (subMode === 'structure') {
      pool = data.questions
      // sample by structure first, then re-rank by mix mode within each segment
      final = sampleTestQuestions(pool, data.testStructure)
    } else {
      pool = data.questions.filter(q => selectedGroups.includes(q.group))
      final = sampleByMix(pool, store.questions, mix, Math.min(count, pool.length), Date.now())
    }
    if (subMode === 'structure' && mix !== 'random') {
      // Apply mix preference within structure: re-rank using bucket priority
      final = sampleByMix(final, store.questions, mix, final.length, Date.now())
    }
    setRun(final)
  }

  const toggleGroup = (g: GroupId) => {
    setSelectedGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-6">Procvičování</h2>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => setSubMode('structure')}
          className={`text-left rounded-lg p-4 border-2 ${subMode === 'structure' ? 'border-primary bg-primary-light' : 'border-neutral-200'}`}>
          <div className={`text-sm font-semibold ${subMode === 'structure' ? 'text-primary-dark' : ''}`}>● Struktura ostrého testu</div>
          <div className="text-xs text-neutral-600 mt-1">35 otázek dle reálné struktury (16/7/5/3/4). Bez timeru.</div>
        </button>
        <button onClick={() => setSubMode('groups')}
          className={`text-left rounded-lg p-4 border-2 ${subMode === 'groups' ? 'border-primary bg-primary-light' : 'border-neutral-200'}`}>
          <div className={`text-sm font-semibold ${subMode === 'groups' ? 'text-primary-dark' : ''}`}>○ Vybrat oblasti</div>
          <div className="text-xs text-neutral-600 mt-1">Vyber konkrétní skupiny + počet.</div>
        </button>
      </div>

      {subMode === 'groups' && (
        <div className="mb-6 bg-white border border-neutral-200 rounded p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Skupiny</div>
          {data.groups.map(g => (
            <label key={g.id} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={selectedGroups.includes(g.id)} onChange={() => toggleGroup(g.id)} />
              <span>{g.name}</span>
              <span className="text-neutral-500 text-xs">
                ({data.questions.filter(q => q.group === g.id).length} otázek)
              </span>
            </label>
          ))}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-neutral-600">Počet:</span>
            {[10, 25, 50, -1].map(n => (
              <button key={n} onClick={() => setCount(n === -1 ? 99999 : n)}
                className={`px-3 py-1 rounded text-sm border ${count === (n === -1 ? 99999 : n) ? 'border-primary bg-primary-light' : 'border-neutral-300'}`}>
                {n === -1 ? 'vše' : n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Zaměření výběru</div>
        <div className="grid grid-cols-3 gap-2">
          {([['random','Náhodně'],['mix','⚖ Mix slabiny + známé'],['weak','Hlavně slabiny']] as const).map(([m, label]) => (
            <button key={m} onClick={() => setMix(m)}
              className={`px-3 py-3 rounded text-sm border-2 ${mix === m ? 'border-primary bg-primary-light text-primary-dark font-semibold' : 'border-neutral-200'}`}>
              {label}
            </button>
          ))}
        </div>
        {mix === 'mix' && (
          <p className="text-xs text-neutral-500 mt-2">
            40% otázek které občas pleteš, 30% nových, 15% nedávno správně, 15% dlouho neviděných.
          </p>
        )}
      </div>

      <div className="text-right">
        <button onClick={start}
          disabled={subMode === 'groups' && selectedGroups.length === 0}
          className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded font-semibold disabled:opacity-50">
          ▶ Spustit procvičování
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `src/components/PracticeRunner.tsx`**

```tsx
import { useState } from 'react'
import QuestionCard from './QuestionCard'
import ExplainButton from './ExplainButton'
import { useProgress } from '../hooks/useProgress'
import type { Question } from '../types'

interface Props {
  questions: Question[]
  onDone: () => void
}

export default function PracticeRunner({ questions, onDone }: Props) {
  const { recordAttempt } = useProgress()
  const [idx, setIdx] = useState(0)
  const [selected, setSelected] = useState<'a'|'b'|'c'|null>(null)
  const [revealed, setRevealed] = useState(false)
  const projectRoot = import.meta.env.VITE_PROJECT_ROOT ?? ''
  const q = questions[idx]
  const total = questions.length

  const submit = () => {
    if (selected === null) return
    setRevealed(true)
    recordAttempt(q.id, selected === q.correct, 'practice')
  }

  const next = () => {
    if (idx + 1 >= total) { onDone(); return }
    setIdx(idx + 1); setSelected(null); setRevealed(false)
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="text-sm text-neutral-500 mb-2">Otázka <strong>{idx + 1} / {total}</strong> · {q.group}</div>
      <div className="h-1 bg-neutral-200 rounded mb-6">
        <div className="h-1 bg-primary rounded" style={{ width: `${((idx+1)/total)*100}%` }}/>
      </div>

      <QuestionCard
        question={q}
        selectedKey={selected}
        revealedCorrect={revealed ? q.correct : null}
        onSelect={k => setSelected(k)}
      />

      <div className="flex justify-between items-center mt-6">
        <ExplainButton qid={q.id} projectRoot={projectRoot} />
        {!revealed ? (
          <button onClick={submit} disabled={selected === null}
            className="px-4 py-2 bg-primary text-white rounded text-sm font-semibold disabled:opacity-40">
            Odpovědět
          </button>
        ) : (
          <button onClick={next} className="px-4 py-2 bg-primary text-white rounded text-sm font-semibold">
            {idx + 1 >= total ? 'Konec' : 'Další otázka →'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `pnpm dev`, navigate to `/practice`. Spustit procvičování → po výběru zobrazí reveal. Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Practice.tsx src/components/PracticeRunner.tsx
git commit -m "Implement Practice route with structure/groups sub-modes and mix selector"
```

---

### Task 19: `Weak` route (slabiny shortcut)

**Files:**
- Modify: `src/routes/Weak.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuestions } from '../hooks/useQuestions'
import { useProgress } from '../hooks/useProgress'
import { sampleByMix } from '../lib/sampleQuestions'
import PracticeRunner from '../components/PracticeRunner'
import type { Question } from '../types'

export default function Weak() {
  const { data, loading } = useQuestions()
  const { store } = useProgress()
  const [run, setRun] = useState<Question[] | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!data) return
    const picked = sampleByMix(data.questions, store.questions, 'weak', 20, Date.now())
    setRun(picked.slice(0, 20))
  }, [data, store.questions])

  if (loading || !run) return <div className="p-8">Načítám…</div>
  if (run.length === 0) return (
    <div className="p-8">
      <h2 className="text-xl font-semibold">Žádné slabiny zatím nemáme.</h2>
      <p className="text-neutral-600 mt-2">Udělej pár testů a vrať se sem.</p>
      <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-primary text-white rounded">Domů</button>
    </div>
  )
  return <PracticeRunner questions={run} onDone={() => navigate('/')} />
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/Weak.tsx
git commit -m "Implement Weak shortcut route"
```

---

### Task 20: `Stats` route

**Files:**
- Modify: `src/routes/Stats.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useQuestions } from '../hooks/useQuestions'
import { useProgress } from '../hooks/useProgress'
import type { GroupId } from '../types'

export default function Stats() {
  const { data, loading } = useQuestions()
  const { store } = useProgress()

  if (loading || !data) return <div className="p-8">Načítám…</div>

  const perGroup: Record<GroupId, { count: number; attempts: number; correct: number; lastSeen: string | null }> = {} as any
  for (const g of data.groups) {
    perGroup[g.id] = { count: 0, attempts: 0, correct: 0, lastSeen: null }
  }
  for (const q of data.questions) perGroup[q.group].count++
  for (const [qid, p] of Object.entries(store.questions)) {
    const q = data.questions.find(qq => qq.id === Number(qid))
    if (!q) continue
    perGroup[q.group].attempts += p.attempts.length
    perGroup[q.group].correct += p.attempts.filter(a => a.correct).length
    if (!perGroup[q.group].lastSeen || p.lastSeen > (perGroup[q.group].lastSeen ?? '')) {
      perGroup[q.group].lastSeen = p.lastSeen
    }
  }

  const history = store.testHistory.slice(0, 10).reverse()

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-6">Statistiky</h2>

      <div className="bg-white border border-neutral-200 rounded p-4 mb-6 overflow-x-auto">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Po skupinách</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="py-2">Skupina</th>
              <th className="py-2">Otázek</th>
              <th className="py-2">Pokusů</th>
              <th className="py-2">Úspěšnost</th>
              <th className="py-2">Naposledy</th>
            </tr>
          </thead>
          <tbody>
            {data.groups.map(g => {
              const s = perGroup[g.id]
              const pct = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : null
              return (
                <tr key={g.id} className="border-t border-neutral-100">
                  <td className="py-2">{g.name}</td>
                  <td className="py-2">{s.count}</td>
                  <td className="py-2">{s.attempts}</td>
                  <td className="py-2 tabular-nums">{pct === null ? '—' : `${pct}%`}</td>
                  <td className="py-2 text-neutral-500">{s.lastSeen ? new Date(s.lastSeen).toLocaleDateString() : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-neutral-200 rounded p-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Poslední ostré testy</div>
        {history.length === 0 ? <div className="text-sm text-neutral-500">Zatím žádné testy.</div> : (
          <div className="flex items-end gap-2 h-32">
            {history.map((t, i) => {
              const h = (t.score / t.total) * 100
              const passed = t.score >= 30
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${t.score}/${t.total}`}>
                  <div className={`w-full rounded-t ${passed ? 'bg-primary' : 'bg-danger'}`} style={{ height: `${h}%` }} />
                  <div className="text-[10px] text-neutral-500 mt-1">{t.score}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/Stats.tsx
git commit -m "Implement Stats route with per-group table and history bar chart"
```

---

### Task 21: `Settings` route

**Files:**
- Modify: `src/routes/Settings.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from 'react'
import { useProgress } from '../hooks/useProgress'

export default function Settings() {
  const { reset } = useProgress()
  const projectRoot = import.meta.env.VITE_PROJECT_ROOT ?? ''
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="max-w-2xl p-8">
      <h2 className="text-2xl font-bold mb-6">Nastavení</h2>

      <div className="bg-white border border-neutral-200 rounded p-4 mb-4">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Cesta k repu (VITE_PROJECT_ROOT)</div>
        <code className="block bg-neutral-100 rounded p-2 text-sm break-all">{projectRoot || '(nenastaveno)'}</code>
        <p className="text-xs text-neutral-500 mt-2">
          Nastaveno přes <code>.env.local</code>. Po změně restartuj <code>pnpm dev</code>.
          Tato cesta jde do parametru <code>folder</code> u Cowork deep linku.
        </p>
      </div>

      <div className="bg-white border border-neutral-200 rounded p-4">
        <div className="text-sm font-semibold mb-2">Smazat veškerý progress</div>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="px-3 py-2 border border-danger text-danger rounded text-sm hover:bg-danger hover:text-white transition">
            Reset progress
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-danger">Opravdu? Toto smaže celou historii.</span>
            <button onClick={() => { reset(); setConfirmReset(false) }} className="px-3 py-2 bg-danger text-white rounded text-sm">Ano, smazat</button>
            <button onClick={() => setConfirmReset(false)} className="px-3 py-2 border border-neutral-300 rounded text-sm">Zpět</button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/Settings.tsx
git commit -m "Implement Settings route with project root display and progress reset"
```

---

## Phase H: Cowork integration

### Task 22: Cowork skill (`.claude/skills/explain-vmp-question/`)

**Files:**
- Create: `.claude/skills/explain-vmp-question/SKILL.md`
- Create: `.claude/skills/explain-vmp-question/template.html`

- [ ] **Step 1: Write `SKILL.md`**

```markdown
---
name: explain-vmp-question
description: Vygeneruj detailní vysvětlení k otázce z VMP M testu. Aktivuj když uživatel požádá o vysvětlení otázky #ID nebo zmíní VMP test. Načti otázku z public/data/questions.json, prozkoumej souvisejíci právní/praktický kontext a ulož HTML do explanations/q-{ID}.html.
---

# Skill: Explain VMP M test question

## Inputs

User prompt obsahuje `qid` (např. "otázka #12" nebo "explain question 12"). Pokud je nejednoznačné, zeptej se uživatele.

## Steps

1. Identifikuj `qid` z promptu.
2. Přečti `public/data/questions.json` a najdi otázku s `id === qid`. Poznamenej `text`, `correct`, `options`, `group`.
3. Web research:
   - Hledej kontext k tématu skupiny v českých zdrojích — zákon č. 114/1995 Sb. (zákon o vnitrozemské plavbě), vyhláška č. 67/2015 Sb. o pravidlech plavebního provozu, případně související vyhlášky a předpisy.
   - Pro skupiny `signalizace-rizeni-plavby`, `vytyceni-vodnich-cest`, `zvukove-signaly` a `nocni-denni-signalizace` najdi referenční obrázky/popisy.
4. Načti šablonu `.claude/skills/explain-vmp-question/template.html`. Vyplň 4 sekce:
   - **Krátké vysvětlení** (1-2 věty proč je správná odpověď správná)
   - **Pozadí** (právní / technický kontext, paragrafy)
   - **Praktická aplikace** (kdy se to v reálu projeví)
   - **Zdroje** (číslované odkazy)
5. Sanitizuj HTML — žádné `<script>`, žádné externí JS, povoleny pouze `h2-h4, p, ul/ol/li, strong, em, a, img, code, blockquote, table, tr, td, th, div, span, hr`.
6. Ulož do `explanations/q-{qid}.html`.
7. Ulož metadata do `explanations/q-{qid}.meta.json`:

   ```json
   {
     "qid": <qid>,
     "generated_at": "<ISO 8601 timestamp>",
     "sources": ["<url1>", "<url2>"],
     "model": "<model-id>"
   }
   ```

8. V chatu potvrď jednou větou, např.: *"Vygenerováno: explanations/q-12.html, hlavní zdroj: vyhláška 67/2015 §X."*

## Žádné regenerace bez požadavku

Pokud `explanations/q-{qid}.html` už existuje a uživatel neřekl výslovně "regeneruj" / "nová verze", **vrať obsah aktuálního souboru a neměň ho.**
```

- [ ] **Step 2: Write `template.html`**

```html
<article class="vmp-explanation">
  <section>
    <h2>Krátké vysvětlení</h2>
    <p><!-- 1-2 věty proč je správná odpověď správná --></p>
  </section>

  <section>
    <h2>Pozadí</h2>
    <p><!-- právní / technický kontext, citace paragrafů --></p>
  </section>

  <section>
    <h2>Praktická aplikace</h2>
    <p><!-- kdy se to v reálu projeví, příklady z provozu --></p>
  </section>

  <section>
    <h2>Zdroje</h2>
    <ol>
      <li><a href="..."><!-- název zdroje --></a></li>
    </ol>
  </section>
</article>
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/explain-vmp-question/
git commit -m "Add Cowork skill: explain-vmp-question"
```

---

### Task 23: Package skill script

**Files:**
- Create: `scripts/package-skill.sh`

- [ ] **Step 1: Write script**

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/.claude/skills/explain-vmp-question"
OUT_DIR="$ROOT/dist"
OUT_ZIP="$OUT_DIR/explain-vmp-question.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT_ZIP"

cd "$ROOT/.claude/skills"
zip -r "$OUT_ZIP" explain-vmp-question \
  -x '*/.DS_Store' \
  > /dev/null

echo "Wrote $OUT_ZIP"
```

- [ ] **Step 2: Make executable + test**

```bash
chmod +x scripts/package-skill.sh
pnpm package-skill
unzip -l dist/explain-vmp-question.zip
```

Expected: ZIP listing shows `explain-vmp-question/SKILL.md` and `template.html`.

- [ ] **Step 3: Add `dist/` to .gitignore**

```bash
echo 'dist/' >> .gitignore
```

(verify `.gitignore` already has `dist/` from Task 1 — if so skip; if not, add it).

- [ ] **Step 4: Commit**

```bash
git add scripts/package-skill.sh .gitignore
git commit -m "Add package-skill.sh: bundle Cowork skill into ZIP for upload"
```

---

## Phase I: Wrap-up

### Task 24: README setup instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# VMP M Trenažér

Lokální webová appka na trénink otázek pro zkoušku VMP M (Vůdce malého plavidla, kategorie M 2015).

## Setup (jednorázově)

```bash
pnpm install
pnpm scrape          # stáhne otázky a obrázky ze spspraha.cz
cp .env.local.example .env.local
# Edituj .env.local — nastav VITE_PROJECT_ROOT na absolutní cestu k tomuto folderu
```

## Spuštění

```bash
pnpm dev
```

Otevře se `http://localhost:5173`.

## Cowork skill (volitelně, pro AI vysvětlení)

1. `pnpm package-skill` — vytvoří `dist/explain-vmp-question.zip`
2. Otevři Claude Desktop → **Cowork** → **Customize** → **Skills** → **Upload** → vyber ten ZIP.
3. **Projects** → **Import existing** → vyber tento folder.
4. Project instructions: *"Když uživatel požádá o vysvětlení otázky, použij skill explain-vmp-question."*

V appce klikni "🧠 Vysvětlení" u otázky → otevře Cowork s předvyplněným promptem.

## Módy

- **Ostrý test** — 35 otázek, 30 minut, struktura 16/7/5/3/4
- **Procvičování** — buď struktura ostrého testu (bez timeru), nebo vlastní výběr oblastí
- **Slabiny** — automaticky vybere 20 otázek které pleteš
- **Statistiky** — úspěšnost po skupinách + historie testů

Progress je v localStorage prohlížeče. Vysvětlení se commitují do `explanations/`.

## Skripty

| Skript | Co dělá |
|---|---|
| `pnpm dev` | dev server (vite) |
| `pnpm build` | produkční build do `dist/` |
| `pnpm test` | spustí vitest |
| `pnpm scrape` | jednorázový scraper otázek |
| `pnpm package-skill` | zazipuje Cowork skill |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add README with setup, Cowork integration steps, modes overview"
```

---

### Task 25: Final QA pass

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: all green.

- [ ] **Step 2: Type-check**

Run: `pnpm build`
Expected: builds without TS errors. `dist/` produced.

- [ ] **Step 3: Manual smoke test**

Run: `pnpm dev`. Walk through:
- Home — sidebar nav viditelný, hero CTA visible
- Test — start, answer a few, submit, see results
- Practice — switch sub-modes (structure / groups), pick mix mode, run a short practice
- Practice runner — pick answer, see reveal, klik "Vysvětlení" → modal s cache miss + Cowork tlačítko (deep link otevře Cowork app, pokud je nainstalovaný)
- Weak — pokud je nějaký progress, ukáže slabiny; jinak prázdný stav
- Stats — tabulka po skupinách + bar chart
- Settings — vidí VITE_PROJECT_ROOT, reset progress funguje

Stop server.

- [ ] **Step 4: Verify Cowork integration end-to-end**

Pokud máš nainstalovaný Claude Desktop:
1. `pnpm package-skill`
2. Upload ZIP do Claude Desktop → Customize → Skills
3. Vytvoř Project pro tento folder
4. V app klikni "Vysvětlení" u nějaké otázky → Cowork se otevře
5. Po dokončení v Cowork klikni "Načíst výsledek" v modal → vidí HTML

Pokud Claude Desktop nemáš, deep link generuje validní URL — to ověřilo unit test.

- [ ] **Step 5: Commit any cleanup**

Pokud je co (drobné fixy, gitignore doplnění):
```bash
git status
git add ...
git commit -m "Final QA pass"
```

Jinak skip.

---

## Self-review checklist (post-write)

- [x] Spec coverage:
  - §2 Stack: Tasks 1, 11
  - §3 Data: Tasks 2, 3, 11
  - §4 Modes: Tasks 17 (test), 18 (practice), 19 (weak), 20 (stats)
  - §5 Mix algorithm: Task 5
  - §6 localStorage progress: Task 9
  - §7 Cowork integration: Tasks 6 (link), 15 (modal), 22 (skill), 23 (package)
  - §8 Components: Tasks 12, 13, 14, 15
  - §9 Error handling: Tasks 8 (load fail), 11 (404 → miss), 21 (reset)
  - §10 Testing: Tasks 4, 5, 6, 9, 14
- [x] No placeholders / TBD
- [x] Type consistency: all types live in `src/types.ts`, imported throughout
- [x] All file paths absolute or repo-relative

**Plan saved to:** `docs/superpowers/plans/2026-05-04-vmp-m-trainer.md`
