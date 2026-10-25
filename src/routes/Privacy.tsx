import { Link } from 'react-router-dom'

const CONTACT_EMAIL = 'info@vmp-trenazer.cz'
const UPDATED = '18. 10. 2026'

/**
 * Zásady ochrany osobních údajů. Linked from the Google/Seznam consent screens, so keep it public
 * (outside /app) and keep it true: update it whenever the app starts storing or sharing new data.
 */
export default function Privacy() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/" className="text-sm text-accent hover:underline">← VMP trenažér</Link>
        <article className="prose prose-neutral mt-6">
          <h1>Ochrana osobních údajů</h1>
          <p className="text-sm text-neutral-500">Platné od {UPDATED}</p>

          <p>
            VMP trenažér (vmp-trenazer.cz) je nekomerční aplikace na procvičování otázek ke zkoušce vůdce
            malého plavidla. Provozuje ji David Esner (dále „provozovatel“), kontakt:{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h2>Jaké údaje zpracováváme</h2>
          <ul>
            <li>
              <strong>Účet:</strong> e-mailová adresa. Při registraci e-mailem i heslo, uložené jen jako
              jednosměrný hash (argon2), nikdy v čitelné podobě.
            </li>
            <li>
              <strong>Přihlášení přes Google nebo Seznam:</strong> identifikátor tvého účtu u poskytovatele
              a e-mail, který nám poskytovatel předá. Nedostáváme tvé heslo ani přístup k e-mailům,
              kontaktům či jiným datům u poskytovatele.
            </li>
            <li>
              <strong>Průběh procvičování:</strong> které otázky jsi zodpověděl(a) a jestli správně, výsledky
              cvičných testů (skóre, čas, datum).
            </li>
            <li>
              <strong>Přihlášení bez účtu (host):</strong> anonymní záznam bez e-mailu, aby fungovala
              relace.
            </li>
            <li>
              <strong>Cookies a úložiště prohlížeče:</strong> jedna nezbytná cookie s identifikátorem relace
              (platnost 30 dní) a krátkodobá cookie po dobu přihlašování přes Google/Seznam. V úložišti
              prohlížeče si pamatujeme zvolenou kategorii zkoušky. Nepoužíváme analytické ani reklamní
              cookies.
            </li>
            <li>
              <strong>Zpětná vazba k otázkám:</strong> text, který odešleš, se zveřejní jako issue ve
              veřejném repozitáři projektu na GitHubu, bez tvého e-mailu a jiných údajů o účtu. Nepiš do
              něj proto nic osobního.
            </li>
          </ul>

          <h2>Proč je zpracováváme</h2>
          <p>
            Jen kvůli tomu, aby aplikace fungovala: abys se mohl(a) přihlásit a aby se ti ukládal průběh
            procvičování. Právním základem je plnění smlouvy, tj. poskytnutí služby, o kterou sis řekl(a).
            Údaje neprodáváme, nepoužíváme k reklamě ani k profilování.
          </p>

          <h2>Kdo k nim má přístup a kde jsou</h2>
          <p>
            Provozovatel a poskytovatelé infrastruktury, na které aplikace běží: Vercel Inc. (hosting) a
            Turso / ChiselStrike Inc. (databáze). Údaje o účtu a průběhu procvičování se ukládají a
            zpracovávají v EU: databáze běží v Irsku, aplikační server ve Frankfurtu.
          </p>
          <p>Mimo EU se mohou dostat:</p>
          <ul>
            <li>
              provozní záznamy hostingu (např. IP adresa a čas požadavku), které Vercel zpracovává podle
              svých podmínek, a to i v USA;
            </li>
            <li>text zpětné vazby k otázkám, který se zveřejňuje na GitHubu (GitHub Inc., USA).</li>
            <li>
              údaje pro ověření, že nejsi robot (např. IP adresa a technické údaje o prohlížeči), které při
              registraci e-mailem a při spuštění trenažéru bez účtu zpracovává služba Cloudflare Turnstile
              (Cloudflare, Inc., USA). Na registrační stránce se načítá s formulářem, u trenažéru bez účtu
              teprve po kliknutí na tlačítko.
            </li>
          </ul>
          <p>
            Vercel i Turso jsou americké společnosti; zpracování se řídí jejich smluvními podmínkami a
            standardními smluvními doložkami EU. Při přihlášení přes Google nebo Seznam se zpracování na
            jejich straně řídí jejich vlastními zásadami.
          </p>

          <h2>Jak dlouho je uchováváme</h2>
          <p>
            Po dobu existence účtu. Průběh procvičování si můžeš kdykoli smazat sám v Nastavení.
          </p>
          <p>
            Tamtéž můžeš kdykoli trvale smazat celý účet (sekce „Smazat účet“). Tím okamžitě odstraníme
            e-mail, hash hesla, propojení s Google či Seznamem, průběh procvičování, výsledky testů a všechna
            přihlášení na všech zařízeních. Smazané údaje mohou ještě omezenou dobu zůstat v automatických
            zálohách databáze u poskytovatele, dokud tyto zálohy nevyprší. Pokud se k účtu nedostaneš
            (třeba jsi zapomněl(a) heslo), napiš na <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> a účet
            smažeme do 30 dnů.
          </p>
          <p>
            Zpětná vazba zveřejněná na GitHubu s účtem spojená není, takže ji smazání účtu nijak neovlivní.
            Pokud chceš odstranit konkrétní text, napiš nám.
          </p>

          <h2>Tvoje práva</h2>
          <p>
            Máš právo na přístup ke svým údajům, jejich opravu, výmaz, omezení zpracování a přenositelnost
            a právo vznést námitku. Výmaz účtu zvládneš sám v Nastavení, ve všech ostatních případech stačí
            napsat na <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            Pokud se ti nebude líbit, jak s údaji nakládáme, můžeš podat stížnost u Úřadu pro ochranu
            osobních údajů (<a href="https://uoou.gov.cz" target="_blank" rel="noopener noreferrer">uoou.gov.cz</a>).
          </p>
        </article>
      </div>
    </div>
  )
}
