// Workflow skript pro batch generování vysvětlení.
//
// Args (JSON object — Workflow harness ho posílá jako string, parsujeme sami):
//   { testId: 'M' | 'C',
//     ids?: number[],            // konkrétní IDs (override)
//     filter?: {                 // pokud ids chybí, preflight agent najde missing dle filtru
//       onlyMissing?: boolean,   // default true: jen ty co nemají q-N.html
//       onlyWithImage?: boolean, // jen otázky s obrázkem
//       zkratky?: string[],      // např. ['MP1', 'MP2']
//       limit?: number,
//     },
//     model?: 'sonnet' | 'opus' | 'haiku',  // default 'sonnet'
//     generatedAt?: string,                  // ISO timestamp, default '2026-06-15T20:00:00Z'
//   }

export const meta = {
  name: 'batch-explain-vmp',
  description: 'Generate missing explanations for VMP test questions (Workflow fan-out)',
  phases: [{ title: 'Preflight' }, { title: 'Generate' }],
}

// Workflow harness posílá args jako string — defenzivně parse.
const A = typeof args === 'string' ? JSON.parse(args) : (args || {})
const TEST_ID = A.testId
const MODEL = A.model || 'sonnet'
const GENERATED_AT = A.generatedAt || '2026-06-15T20:00:00Z'
const FILTER = A.filter || { onlyMissing: true }

if (!TEST_ID || !['M', 'C'].includes(TEST_ID)) {
  throw new Error(`Bad args.testId: ${TEST_ID}. Expected 'M' or 'C'.`)
}

log(`Batch explain — test=${TEST_ID}, model=${MODEL}`)

// ---------- Krok 1: získat seznam IDs ----------

let IDS = Array.isArray(A.ids) ? A.ids : null

if (!IDS) {
  log('Spouštím preflight — agent spočítá chybějící IDs z filesystému')
  const filterDesc = JSON.stringify(FILTER)
  const raw = await agent(
    `Spočítej IDs otázek pro batch generování vysvětlení testu ${TEST_ID}.

Filter: ${filterDesc}

POSTUP:
1. Spusť bash: ls /Users/esner/Documents/Fun/VMP_TEST/public/explanations/${TEST_ID}/ 2>/dev/null | grep -oE 'q-[0-9]+\\.html' | sed 's/q-//;s/\\.html//' | sort -n
   Z výstupu si poznamenej seznam EXISTING ids (čísla).
2. Přečti soubor: /Users/esner/Documents/Fun/VMP_TEST/public/data/questions-${TEST_ID}.json
   Tam je top-level objekt s polem .questions[]. Každá otázka má .id (number), .zkratka (string), .image (string|null).
3. Aplikuj filter:
   - onlyMissing: true → vrátit jen id které nejsou v EXISTING
   - onlyWithImage: true → jen otázky kde image != null
   - zkratky: ['MP1', ...] → jen otázky s touto zkratkou
   - limit: N → vzít prvních N po filtraci
4. Vrať POUZE JSON pole čísel ve formátu [1,5,7,42] na samostatném řádku, nic jiného. Žádný markdown, žádné komentáře, jen pole.`,
    { label: 'preflight', phase: 'Preflight' }
  )

  // Extract JSON array from agent response (může mít whitespace okolo)
  const match = String(raw).match(/\[\s*(?:\d+(?:\s*,\s*\d+)*)?\s*\]/)
  if (!match) {
    throw new Error(`Preflight agent nevrátil JSON pole. Got: ${String(raw).slice(0, 200)}`)
  }
  IDS = JSON.parse(match[0])
  log(`Preflight nalezl ${IDS.length} otázek k zpracování`)
}

if (IDS.length === 0) {
  log('Nic k vygenerování — všechny otázky pro daný filtr už existují.')
  return { ok: 0, fail: 0, failedIds: [], total: 0 }
}

// ---------- Krok 2: fan-out per qid ----------

const SKILL_INLINE = `
Vygeneruj HTML vysvětlení pro JEDNU otázku z VMP testu kategorie ${TEST_ID}.

POSTUP:
1. Spusť pomocí Bash:
   python3 .claude/skills/explain-vmp-question/scripts/load_question.py <qid> --test ${TEST_ID} --json
   Vrátí JSON s text otázky, options, správnou odpověď a image path.
2. Pokud image.exists je true, přečti obrázek Read toolem (path je v image.resolved_path).
3. Vyrob HTML vysvětlení v češtině se sekcemi: Jádro / Pozadí / (volitelně Vizualizace) / Praktická aplikace / Zdroje.

HARD PRAVIDLA:
- NIKDY neoznačuj odpovědi písmenem (a/b/c) — appka shuffluje. Vždy odkazuj na OBSAH (parafráze nebo doslovná citace).
- HTML musí projít DOMPurify: žádné <script>, <style>, externí JS, ani onclick.
- Povolené tagy: h2, h3, h4, p, ul, ol, li, strong, em, a, img, code, blockquote, table, thead, tbody, tr, td, th, div, span, hr, svg, path, circle, rect, line, polyline, polygon, text, g, defs, marker, use. Inline style="..." na SVG je OK.
- Vizualizace JEN statické SVG (žádný JS, žádné animace).
- Cituj stručně (název předpisu + paragraf). Web research jen pokud si nejsi jistý konkrétním paragrafem (zde to ale není kritické pro batch).

OBSAH:
- Jádro: 1–3 věty proč je odpověď správná (cituj OBSAH).
- Pozadí: právní/technický kontext (předpis + paragraf nebo COLREG pravidlo pro test C).
- Vizualizace (volitelná): pro signalizaci, světla, plavební značky, navigaci, manévry, kompasy, plavidla, IALA bóje — statický SVG diagram. Pro prostá čísla/definice ne.
- Praktická aplikace: kdy/jak se to v reálu projeví.
- Zdroje: očíslovaný seznam jmen předpisů s paragrafy.

ULOŽ DVA SOUBORY (absolutní cesty, použij Write tool):
1. /Users/esner/Documents/Fun/VMP_TEST/public/explanations/${TEST_ID}/q-<qid>.html
   Začíná <article class="vmp-explanation">, končí </article>. Žádné <html>/<head>/<body>.
2. /Users/esner/Documents/Fun/VMP_TEST/public/explanations/${TEST_ID}/q-<qid>.meta.json
   { "qid": <qid>, "test_id": "${TEST_ID}", "generated_at": "${GENERATED_AT}", "sources": [...], "model": "${MODEL}" }

Po uložení vrať POUZE jednu řádku:
- "OK qid=<qid>" pokud uloženo
- "FAIL qid=<qid>: <důvod>" při chybě

ŽÁDNÁ KONVERZACE, žádný markdown navíc.
`.trim()

const results = await parallel(
  IDS.map(qid => () =>
    agent(
      `Otázka qid=${qid}, test=${TEST_ID}.\n\n${SKILL_INLINE.replace(/<qid>/g, String(qid))}`,
      { label: `q-${qid}`, phase: 'Generate', model: MODEL }
    ).catch(e => `FAIL qid=${qid}: ${e?.message || 'error'}`)
  )
)

const ok = results.filter(r => typeof r === 'string' && r.startsWith('OK')).length
const fail = results.length - ok
const failedIds = results
  .map((r, i) => ({ r, qid: IDS[i] }))
  .filter(x => !(typeof x.r === 'string' && x.r.startsWith('OK')))
  .map(x => x.qid)

log(`Hotovo: ${ok} OK, ${fail} FAIL`)
return { testId: TEST_ID, ok, fail, failedIds, total: IDS.length }
