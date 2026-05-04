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
