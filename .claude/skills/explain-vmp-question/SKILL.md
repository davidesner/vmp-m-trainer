---
name: explain-vmp-question
description: Vysvětli otázku z VMP M testu uživateli konverzačně, s vizualizacemi tam, kde pomohou. Aktivuj když uživatel požádá o vysvětlení otázky #ID nebo zmíní VMP test. Cílem je porozumění, ne článek — HTML pro uložení nabídni teprve potom.
---

# Skill: Explain VMP M test question

**Hlavní cíl:** pomoct uživateli pochopit, **proč** je správná odpověď správná. Konverzuj. Nepiš HTML hned. Až po vysvětlení nabídni uložení.

## Hard rule: nikdy neukládej bez výslovného souhlasu

Soubory `explanations/q-{qid}.html` a `explanations/q-{qid}.meta.json` **nikdy nezapisuj ani nepřepisuj** bez toho, aby uživatel řekl "ano, ulož to" (nebo ekvivalent — "jo", "save it", "ulož", atp.). To platí **vždy** — pro nové vysvětlení i pro úpravu existujícího.

Pokud sis právě uvědomil, že chceš ukládat, nedělej to. **Zeptej se nejdřív.**

## Hard rule: nikdy neoznačuj odpovědi písmenem

Appka při zobrazení **náhodně přerendlí pořadí odpovědí a přepíše písmena a/b/c**. Konkrétní písmeno z `questions.json` (`correct: 'a'`) tedy v UI nemá platnost — uživatel právě vidí jinou odpověď pod stejným písmenem.

**Pravidlo:**
- **Nikdy nepiš** "správná odpověď je a)" / "možnost (b) je správná" / "viz odpověď a" / "zatímco varianta c říká…" ani v chatu, ani v ukládaném HTML.
- **Vždy odkazuj na obsah** — buď doslovnou citací, nebo parafrází. Např.:
  - ❌ *"Správná odpověď je a)."*
  - ✅ *"Správná odpověď je '__ovladatelné těleso určené k pohybu nebo stání na vodě…__'."*
  - ✅ *"Správná je definice, která zahrnuje 'ovladatelné těleso' — širší pojetí pokrývající i plovoucí zařízení a stroje."*
- Stejně tak u **chytlavých variant**: identifikuj je obsahem, ne písmenem. *"Varianta, která tvrdí, že plavidlo musí mít vlastní pohon, je nesprávná, protože…"* místo *"Odpověď b) je nesprávná."*

Tohle pravidlo platí pro chat **i** uložené HTML — uložené HTML se otevírá v appce, kde je shuffle stále aktivní.

## Web research jen v nutném případě

**Nehledej online preventivně.** Většinu otázek umíš vysvětlit z vlastní znalosti — vyhláška č. 67/2015 Sb. o pravidlech plavebního provozu, zákon č. 114/1995 Sb. o vnitrozemské plavbě, základy první pomoci a konstrukce plavidel jsou standardní rozsah.

**WebSearch / WebFetch použij pouze pokud:**

- Otázka se opírá o **konkrétní číslo / paragraf / odstavec**, kterým si nejsi jistý a špatná citace by změnila odpověď
- Zaznamenáváš nedávnou novelizaci nebo specifický termín mimo standardní rozsah
- Sám si **ne jsi jistý** věcnou správností — pak ano, ověř

**Pokud web nepoužiješ:**

- V sekci `Zdroje` stačí uvést právní zdroj jménem a paragrafem (např. *„vyhláška č. 67/2015 Sb., §X odst. Y"*) bez URL
- Necituj zdroj, který jsi reálně neotevřel (žádné „pravděpodobně-správné" URL)

Cíl: rychlé, věcně správné vysvětlení. Web research zdvojnásobí čas runu — vyhrazuj ho pro reálné pochybnosti.

---

## Krok 1 — Najdi otázku

1. Identifikuj `qid` z promptu (např. "otázka #12"). Pokud nejednoznačné, zeptej se.
2. **Spusť helper skript** — jediným voláním vytáhne text, options, správnou odpověď, image path (i s informací jestli existuje) a stav existujícího vysvětlení v `explanations/`:

   ```bash
   python3 .claude/skills/explain-vmp-question/scripts/load_question.py <qid>
   # nebo --json pro strojové zpracování:
   python3 .claude/skills/explain-vmp-question/scripts/load_question.py <qid> --json
   ```

   Skript hledá repo root automaticky (najde `public/data/questions.json` u sebe nebo u některého předka), takže ho můžeš volat odkudkoliv. **Nepokoušej se parsovat `questions.json` ručně** — má top-level objekt s polem `questions[]`, ne pole na top-levelu, a tohle si chytá skript za tebe.
3. **Pokud helper hlásí, že obrázek existuje** (typicky `/data/images/q-{qid}.jpg` → soubor v `public/data/images/q-{qid}.jpg`), **přečti ho hned tooly Read** — neignoruj. Obrázek je často podstatnou částí zadání (schéma plavidla, plavební značka, světelný znak, situace na vodě, šipky popisující manévr) a bez něj odpověď často nepostavíš správně.
4. Pokud helper hlásí, že existuje `explanations/q-{qid}.html`, přečti ho — viz sekci „Když HTML už existuje" níž.

### Jak číst test images — konvence VMP

V tištěných test materiálech jsou některé jevy zobrazené **schematicky**, ne fotorealisticky. Než navrhneš výklad, dekóduj symbol:

- **Kroužek se čtyřmi černo-bílými výsečemi** = blikající světlo (střídání černé a bílé znázorňuje rozsvíceno/zhasnuto). Jeden kroužek = 1 světlo, dva vedle sebe = 2 světla.
- **Plné vybarvené kruhy/obdélníky v barvě** = stálá světla té barvy (červené, zelené, bílé, žluté).
- **Šipky u plavidla** = směr plavby / směr manévru.
- **Schéma plavidla shora vs. zboku** — pohled určuje, která světla jsou viditelná (boční × stěžňové × záďové).
- **Plavební značky** v testu jsou typicky vykreslené čelně, bez perspektivy — barevný a tvarový kód značky drž (čtverec/obdélník/kruh/trojúhelník, červená/bílá/zelená/žlutá).

Pokud si konvencí nejsi jistý, popiš v chatu, co na obrázku vidíš, a ať uživatel potvrdí — lepší než postavit vysvětlení na špatné interpretaci.

### Vizualizace ať vychází z obrázku v zadání

Když otázka má `image` a chystáš vlastní vizualizaci, **nestav ji od nuly na obecné představě** — vyjdi z toho, co je skutečně na obrázku. Dobrý vzor je dvouúrovňová vizualizace: vlevo přesně to, co vidí uživatel v testu (symbol/schéma 1:1), vpravo „překlad" do reality (jak to vypadá na vodě / na plavidle / na značce). Tím se naučí dekódovat tištěnou konvenci, ne jen memorovat odpověď.

## Krok 2 — Vysvětli v chatu (konverzačně)

Vysvětli **přímo v chatu**, ne v souboru. Strukturu volíš podle otázky — typicky:

- **Jádro** — proč je správná odpověď správná, 1–3 věty
- **Pozadí** — právní zdroj (zákon č. 114/1995 Sb. o vnitrozemské plavbě, vyhláška č. 67/2015 Sb. o pravidlech plavebního provozu, případně související předpisy) nebo technické vysvětlení
- **Proč ne ostatní možnosti** — když to pomáhá k pochopení (zejména pro chytlavé varianty)
- **Praktická aplikace** — kdy/jak se to v reálu projeví

Cituj zdroje — typicky stačí název předpisu a paragraf (např. *„vyhláška č. 67/2015 Sb., §X odst. Y"*). Web research jen v případě reálné pochybnosti, viz sekce výš.

### Vizualizace — udělej, kdykoliv to pomůže

Pro otázky o **signalizaci, světlech na plavidle, plavebních značkách, vytyčení vodních cest, zvukových signálech (rytmus), manévrech, situacích na vodě, anatomii plavidla** atp. **vyrob vizualizaci**. Nejde o ozdobu — vizualizace často vysvětlí to, co text nikdy nevysvětlí stejně dobře.

Možnosti, které máš v artefaktu k dispozici:

- **Statická SVG schémata** — schéma plavidla s označením světel, plavební značka v perspektivě, znakové pole signalizace
- **Interaktivní React komponenta** — animované blikání/přerušování světla podle reálného rytmu, slider pro porovnání variant ("Co je rozdíl mezi A a B?"), kliknutelné prvky, které popíší detail
- **Mermaid diagram** — rozhodovací strom pro pravidla míjení/předjíždění, postupy první pomoci, sled kroků
- **Tabulka** — rychlý přehled (např. "kdy svítí které světlo: plující × kotvící × nasedlé na mělčině")

Vizualizace má **přidat hodnotu**. Pro otázky o definicích nebo prostých číselných hodnotách ji většinou nepotřebuješ.

## Krok 3 — Nabídni uložení do HTML (vždy ručně potvrdit)

**Až po vysvětlení** (a případných follow-up otázkách) **se zeptej**:

> *"Chceš tohle uložit jako HTML do `explanations/q-{qid}.html`? Při dalším otevření v appce se zobrazí přímo v modalu."*

Pokud má soubor už existovat a ty ho přepisuješ, formulace musí být jednoznačná, např.:

> *"Tohle nahradí současný `explanations/q-{qid}.html`. Uložit?"*

**Počkej na výslovné potvrzení.** Mlčení nebo follow-up otázka **nikdy** neznamená souhlas.

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

## Když HTML už existuje

1. Přečti existující `explanations/q-{qid}.html` a použij jeho obsah jako základ konverzace
2. Zeptej se uživatele, co potřebuje: *"Vysvětlení už existuje. Chceš ho rozšířit / upravit, nebo se chceš zeptat na něco konkrétního?"*
3. Konverzuj normálně podle Kroku 2
4. **Nikdy nepřepisuj soubor automaticky.** I když uživatel řekne "regeneruj" nebo "udělej nové", nejdřív vyrob navrhovanou verzi v chatu, pak se zeptej *"Tohle nahradí současný explanations/q-{qid}.html. Uložit?"* a počkej na potvrzení.
