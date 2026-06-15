---
name: batch-explain-vmp-questions
description: Hromadně vygeneruj chybějící vysvětlení (HTML) pro otázky VMP testu (M nebo C). Aktivuj když user řekne "batch explanations", "vygeneruj všechny", "doplň chybějící explanations", "generuj vysvětlení pro C", apod. Spustí Workflow fan-out — jeden subagent na otázku.
---

# Skill: Batch generování vysvětlení (Workflow fan-out)

Hromadné vygenerování `public/explanations/{testId}/q-{qid}.html`. Místo per-otázka cold-start session spustí Workflow s `parallel()` fan-outem subagentů (concurrency cap 16, default model **sonnet** — rychlejší a levnější než opus).

**Tento skill nezpracovává jednu otázku.** Pro single-question chat workflow použij `explain-vmp-question`.

## Jak to spustit

1. Zeptej se uživatele (jen pokud z promptu není jasné):
   - **Kterou kategorii?** `M` nebo `C`
   - **Filter?** všechny chybějící (default), jen s obrázkem, určité zkratky, konkrétní IDs, limit
   - **Model?** default sonnet; opus pouze pokud uživatel chce vyšší kvalitu a má rozpočet

2. Spusť Workflow s `scriptPath: ".claude/skills/batch-explain-vmp-questions/workflow.mjs"` (nebo absolutní cestou). Předej `args` jako JSON object:

   ```js
   Workflow({
     scriptPath: "/Users/esner/Documents/Fun/VMP_TEST/.claude/skills/batch-explain-vmp-questions/workflow.mjs",
     args: {
       testId: "C",                       // 'M' nebo 'C'
       // ids: [1, 5, 7],                  // optional: konkrétní IDs (override)
       filter: { onlyMissing: true },      // optional, default; další: onlyWithImage, zkratky, limit
       model: "sonnet",                    // optional, default
       generatedAt: "2026-06-15T20:00:00Z" // optional
     }
   })
   ```

   ⚠️ **Workflow harness posílá `args` do skriptu jako STRING, ne object.** Skript to defenzivně parsuje (`JSON.parse(args)`). Když píšeš vlastní workflow skript, použij stejný pattern:
   ```js
   const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
   ```

3. Workflow nejdřív spustí **preflight agent** (pokud `ids` nepřišly), který:
   - Listne `public/explanations/{testId}/` přes Bash
   - Načte `public/data/questions-{testId}.json` přes Read
   - Aplikuje filter (onlyMissing, onlyWithImage, zkratky, limit)
   - Vrátí JSON pole IDs

4. Pak fan-out **parallel()** přes IDs: každý subagent vygeneruje HTML + meta.json pro 1 otázku.

5. Vrátí `{ testId, ok, fail, failedIds, total }`. Pro fail > 0 nabídni retry s tímtéž skriptem a `args.ids = failedIds`.

## Filtry — interpretace přirozeného jazyka

| User řekne | args |
|---|---|
| "Vygeneruj všechny chybějící pro M" | `{testId:'M', filter:{onlyMissing:true}}` |
| "Jen s obrázkem v C" | `{testId:'C', filter:{onlyMissing:true, onlyWithImage:true}}` |
| "Prvních 10" | `{testId, filter:{onlyMissing:true, limit:10}}` |
| "Otázky 5, 7, 12" | `{testId, ids:[5,7,12]}` |
| "Skupina MP1" | `{testId:'C', filter:{onlyMissing:true, zkratky:['MP1']}}` |
| "Retry failed" | reuse `failedIds` z předchozího runu jako `ids` |

## Cena a čas

- Default **sonnet** (claude-sonnet-4-6) — ~20k tokenů / otázka, ~5–10s / otázka
- Pro 200 otázek očekávej ~4M tokenů, ~25 min wall-clock (cap 16 paralelně)
- Opus stojí ~6× víc, nepotřebuješ ho pokud nemá hodně obrázkových otázek se schematickou vizualizací

## Limity a sanity checks

- Workflow concurrency cap = 16 (default), zbylé v queue
- Pokud `ids.length > 200` → krátké potvrzení uživateli před spuštěním
- Pokud workflow selže s "args undefined" nebo "TypeError" → check že script používá `typeof args === 'string' ? JSON.parse(args) : args`
- Pro testovací run preferuj `filter.limit: 5` a ověř kvalitu

## Kdy NE-používat tento skill

- Single-question prompty ("vysvětli mi #42") → použij `explain-vmp-question`
- Konverzace o jedné otázce → `explain-vmp-question`
- Když není potřeba ukládat HTML → `explain-vmp-question`
