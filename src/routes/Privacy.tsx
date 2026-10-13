import { Link } from 'react-router-dom'

const CONTACT_EMAIL = 'esnerda@gmail.com'
const UPDATED = '13. 10. 2026'

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

          <h2>Kdo k nim má přístup</h2>
          <p>
            Provozovatel a poskytovatelé infrastruktury, na které aplikace běží: Vercel Inc. (hosting) a
            Turso / ChiselStrike Inc. (databáze). Data se zpracovávají a ukládají v EU (servery ve Frankfurtu
            a v Irsku). Oba poskytovatelé jsou americké společnosti, případný přístup z USA se řídí jejich
            smluvními podmínkami a standardními smluvními doložkami EU. Při přihlášení přes Google nebo
            Seznam se řídí zpracování na jejich straně jejich vlastními zásadami.
          </p>

          <h2>Jak dlouho je uchováváme</h2>
          <p>
            Po dobu existence účtu. Průběh procvičování si můžeš kdykoli smazat sám v Nastavení. Smazání
            celého účtu provedeme na požádání e-mailem, a to do 30 dnů.
          </p>

          <h2>Tvoje práva</h2>
          <p>
            Máš právo na přístup ke svým údajům, jejich opravu, výmaz, omezení zpracování a přenositelnost
            a právo vznést námitku. Stačí napsat na <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            Pokud se ti nebude líbit, jak s údaji nakládáme, můžeš podat stížnost u Úřadu pro ochranu
            osobních údajů (<a href="https://uoou.gov.cz" target="_blank" rel="noopener noreferrer">uoou.gov.cz</a>).
          </p>
        </article>
      </div>
    </div>
  )
}
