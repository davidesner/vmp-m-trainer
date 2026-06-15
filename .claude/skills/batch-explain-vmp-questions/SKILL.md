---
name: batch-explain-vmp-questions
description: Hromadně vygeneruj chybějící vysvětlení (HTML) pro otázky VMP testu (M nebo C). Aktivuj když user řekne "batch explanations", "vygeneruj všechny", "doplň chybějící explanations", "generuj vysvětlení pro C", apod. Spustí Workflow fan-out — jeden subagent na otázku.
---

# Skill: Batch generování vysvětlení (Workflow fan-out)

Slouží k hromadnému vygenerování chybějících `public/explanations/{testId}/q-{qid}.html` souborů. Místo per-otázka `claude -p` cyklu (cold-start session × N) spustí Workflow s `pipeline()` agentem per otázka uvnitř jedné session.

**Tento skill nezpracovává jednu otázku.** Pro single-question chat workflow použij `explain-vmp-question`.

## Krok 1 — Zjisti stav

1. Zeptej se uživatele co chce, pokud to není z promptu jasné:
   - **Kterou kategorii?** `M` nebo `C` (i obě = dvě běhy)
   - **Jaký filtr?** Možnosti: všechny chybějící, jen s obrázkem, jen určité zkratky (např. "jen MP1"), konkrétní IDs ("3, 7, 19"), limit (např. "max 10")
2. Otevři `public/data/questions-{testId}.json` (přes Read tool), získej seznam všech qids. Pro filtry s obrázkem si všímej `image: string | null`.
3. Spusť `ls public/explanations/{testId}/` (přes Bash) abys získal seznam existujících HTML souborů.
4. Vyfiltruj **chybějící** qids (těch, které nemají `q-{qid}.html` v dané složce) podle uživatelových kritérií.
5. Stručně potvrď uživateli: *"Vygeneruji X chybějících explanations pro test {testId} — filtr: …"*. Když je seznam delší než 30, ukaž jen prvních pár a celkový počet.

## Krok 2 — Spusť Workflow s fan-outem

Vol Workflow tool. Skript:

```js
export const meta = {
  name: 'batch-explanations',
  description: 'Generate missing explanations for VMP test questions',
  phases: [{ title: 'Generate' }],
}

const TEST_ID = args.testId     // 'M' | 'C'
const MISSING_IDS = args.ids    // number[]

const SKILL_PROMPT = `<inline prompt z explain-vmp-question SKILL.md, viz níž>`

const results = await parallel(
  MISSING_IDS.map(qid => () =>
    agent(
      `Vygeneruj HTML vysvětlení pro otázku #${qid} z testu ${TEST_ID}.

${SKILL_PROMPT}

POKYNY PRO TENTO BATCH RUN:
- Nepiš v chatu, jen vygeneruj a ulož HTML.
- Spusť: python3 .claude/skills/explain-vmp-question/scripts/load_question.py ${qid} --test ${TEST_ID} --json
- Pokud má otázka obrázek, přečti ho Read toolem.
- Vyrob HTML přímo (žádná konverzace s uživatelem) a ulož do public/explanations/${TEST_ID}/q-${qid}.html
- Zároveň ulož public/explanations/${TEST_ID}/q-${qid}.meta.json s metadaty.
- Vrať jednu větu: "OK qid=${qid}" nebo "FAIL qid=${qid}: <důvod>"`,
      { label: \`q-\${qid}\`, phase: 'Generate' }
    )
  )
)

const ok = results.filter(r => typeof r === 'string' && r.startsWith('OK')).length
const fail = results.length - ok
return { ok, fail, results }
```

Předej `{ testId, ids: missingIds }` přes `args`.

## Krok 3 — Inline prompt z `explain-vmp-question/SKILL.md`

Otevři `.claude/skills/explain-vmp-question/SKILL.md` a inlinuj jeho relevantní obsah do agent promptu z Kroku 2 (sekce "Krok 2", "Krok 3", pravidla pro citace, sanitizaci HTML, atd.). **Vynechej** sekce o konverzaci s uživatelem, vynechej "Hard rule: nikdy neukládej bez výslovného souhlasu" (batch je explicitní souhlas k hromadnému uložení), a vynechej "Krok 3 — Nabídni uložení" (subagent ukládá rovnou).

**Hard pravidla, která musí v inlined promptu zůstat:**
- Nikdy neoznačuj odpovědi písmenem (a/b/c) — appka shuffluje
- Sanitizace HTML pro DOMPurify (žádné `<script>`, `<style>`, atd.)
- Vizualizace jako statické SVG (žádný JS v HTML)

## Krok 4 — Report

Po dokončení Workflow vrať uživateli stručný report:

> Vygenerováno: **X OK, Y FAIL** (test {testId})
>
> Failed qids: …  (nabídni retry)

Pokud >0 fail, zeptej se: *"Chceš retry pro selhané otázky?"*. Pokud ano, opakuj Krok 2 jen pro tu podmnožinu.

## Filtry — interpretace přirozeného jazyka

| User řekne | Co dělat |
|---|---|
| "Vygeneruj všechny chybějící pro M" | testId=M, všechny missing |
| "Jen s obrázkem" | filter `image != null` |
| "Prvních 10" | sliced first N missing |
| "Otázky 5, 7, 12" | exact ids |
| "Skupina MP1" | filter `zkratka === 'MP1'` |
| "Retry failed" | reuse failed list z předchozího runu |
| "Po jedné z každé skupiny C" | pro každou unikátní zkratku v C vezmi první missing |

## Limity

- Workflow concurrency cap = 16 (default), zbylé v queue
- Když je missing > 200, **zeptej se uživatele před spuštěním** ("vygeneruji 215 explanations, OK?") — to je dost tokenů
- Pro test runs preferuj malé filtry (limit=5, ids=...) ať si uživatel ověří kvalitu

## Kdy NE-používat tento skill

- Single-question prompty ("vysvětli mi #42") → použij `explain-vmp-question`
- Když user explicitně chce konverzovat o jedné otázce → `explain-vmp-question`
- Když není potřeba ukládat HTML (jen chat) → `explain-vmp-question`
