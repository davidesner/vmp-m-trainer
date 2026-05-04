---
name: explain-vmp-question
description: Vysvětli otázku z VMP M testu uživateli konverzačně, s vizualizacemi tam, kde pomohou. Aktivuj když uživatel požádá o vysvětlení otázky #ID nebo zmíní VMP test. Cílem je porozumění, ne článek — HTML pro uložení nabídni teprve potom.
---

# Skill: Explain VMP M test question

**Hlavní cíl:** pomoct uživateli pochopit, **proč** je správná odpověď správná. Konverzuj. Nepiš HTML hned. Až po vysvětlení nabídni uložení.

---

## Krok 1 — Najdi otázku

1. Identifikuj `qid` z promptu (např. "otázka #12"). Pokud nejednoznačné, zeptej se.
2. Přečti `public/data/questions.json`, najdi `id === qid`. Poznamenej `text`, `correct`, `options`, `group`, `image`.

## Krok 2 — Vysvětli v chatu (konverzačně)

Vysvětli **přímo v chatu**, ne v souboru. Strukturu volíš podle otázky — typicky:

- **Jádro** — proč je správná odpověď správná, 1–3 věty
- **Pozadí** — právní zdroj (zákon č. 114/1995 Sb. o vnitrozemské plavbě, vyhláška č. 67/2015 Sb. o pravidlech plavebního provozu, případně související předpisy) nebo technické vysvětlení
- **Proč ne ostatní možnosti** — když to pomáhá k pochopení (zejména pro chytlavé varianty)
- **Praktická aplikace** — kdy/jak se to v reálu projeví

Cituj zdroje. Pokud si nejsi jistý nebo otázka vyžaduje hlubší kontext, hledej online (úplné znění zákonů na zakonyprolidi.cz, web Státní plavební správy).

### Vizualizace — udělej, kdykoliv to pomůže

Pro otázky o **signalizaci, světlech na plavidle, plavebních značkách, vytyčení vodních cest, zvukových signálech (rytmus), manévrech, situacích na vodě, anatomii plavidla** atp. **vyrob vizualizaci**. Nejde o ozdobu — vizualizace často vysvětlí to, co text nikdy nevysvětlí stejně dobře.

Možnosti, které máš v artefaktu k dispozici:

- **Statická SVG schémata** — schéma plavidla s označením světel, plavební značka v perspektivě, znakové pole signalizace
- **Interaktivní React komponenta** — animované blikání/přerušování světla podle reálného rytmu, slider pro porovnání variant ("Co je rozdíl mezi A a B?"), kliknutelné prvky, které popíší detail
- **Mermaid diagram** — rozhodovací strom pro pravidla míjení/předjíždění, postupy první pomoci, sled kroků
- **Tabulka** — rychlý přehled (např. "kdy svítí které světlo: plující × kotvící × nasedlé na mělčině")

Vizualizace má **přidat hodnotu**. Pro otázky o definicích nebo prostých číselných hodnotách ji většinou nepotřebuješ.

## Krok 3 — Nabídni uložení do HTML

**Až po vysvětlení** (a případných follow-up otázkách) nabídni:

> *"Chceš tohle uložit jako HTML do `explanations/q-{qid}.html`? Při dalším otevření v appce se zobrazí přímo v modalu."*

### Když uživatel souhlasí

Vyrob HTML, které **zachytí to, co bylo důležité v konverzaci** (vč. SVG nebo statické verze vizualizace). Nepřepisuj všechno doslova — zhušti tak, aby to fungovalo i samostatně.

Strukturu odvoď z toho, co dávalo smysl v chatu (kostra v `template.html` jen jako inspirace, ne pevné pravidlo). Typicky stačí: **Jádro → Pozadí → Vizualizace (pokud byla) → Praktická aplikace → Zdroje**.

**Sanitizace pro uložené HTML:**

- **Žádné `<script>`, žádné `<style>`, žádné externí JS** — appka HTML projíždí přes DOMPurify, scripty by stejně odstranila
- Povolené tagy: `h2-h4, p, ul/ol/li, strong, em, a, img, code, blockquote, table, thead/tbody/tr/td/th, div, span, hr, svg + děti (path, circle, rect, line, polyline, polygon, text, g, defs, marker, use)` a inline `style` na SVG elementech (barvy, výplně) je OK
- **Interaktivní React/JS verze vizualizace** musí být v uloženém HTML převedena na **statický SVG** (animaci popiš slovy v komentáři u obrázku, např. "světlo bliká přerušovaně 1× za 4s")

**Soubory k uložení:**

1. `explanations/q-{qid}.html` — sanitizovaný HTML obsah
2. `explanations/q-{qid}.meta.json` — metadata:

   ```json
   {
     "qid": <qid>,
     "generated_at": "<ISO 8601 timestamp>",
     "sources": ["<url1>", "<url2>"],
     "model": "<model-id>"
   }
   ```

Potvrď jednou větou: *"Uloženo: explanations/q-{qid}.html"*

### Když uživatel řekne ne (nebo se ptá dál)

**Neukládej nic.** Pokračuj v konverzaci.

---

## Bez automatické regenerace

Pokud `explanations/q-{qid}.html` už existuje a uživatel neřekl výslovně "regeneruj" / "udělej nové vysvětlení":

1. Vrať obsah aktuálního HTML jako základ konverzace
2. Zeptej se: *"Vysvětlení už existuje. Chceš ho rozšířit/upravit, nebo mě zajímá jiná část?"*
3. HTML přepiš jen po výslovném souhlasu
