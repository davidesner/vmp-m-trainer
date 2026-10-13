import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import LoginForm from '../components/LoginForm'
import { LANDING_CATEGORIES, LANDING_SAMPLES } from '../lib/landingSamples'
import { shuffleQuestionOptions } from '../lib/shuffleOptions'
import { sanitizeExplanationHtml } from '../lib/sanitize'
import { TESTS } from '../lib/tests'

const REPO_URL = 'https://github.com/davidesner/vmp-m-trainer'

const SOURCES = [
  { href: 'https://sps.gov.cz/', title: 'Státní plavební správa', note: 'úřad, který zkoušky vůdce malého plavidla pořádá' },
  { href: 'https://sps.gov.cz/dok-os/nova-opravneni-2023', title: 'Zveřejnění souborů otázek', note: 'oficiální soubory otázek ke zkouškám způsobilosti' },
  { href: 'https://sps.gov.cz/dok-os/el-podani', title: 'Přihlášení na zkoušku vůdce malého plavidla', note: 'elektronické podání žádosti o průkaz' },
  { href: 'https://www.spspraha.cz/zkousky/otazky.asp?zp=M', title: 'Testové otázky SPS', note: 'odtud trenažér otázky a obrázky přebírá' },
]

// Illustrative numbers for the readiness preview; not tied to any real user.
const DEMO_GROUPS: Array<{ name: string; accuracy: number }> = [
  { name: 'Plavební provoz', accuracy: 91 },
  { name: 'Noční a denní signalizace', accuracy: 64 },
  { name: 'Signální znaky', accuracy: 78 },
  { name: 'Konstrukce plavidel', accuracy: 88 },
  { name: 'První pomoc', accuracy: 42 },
]

function useGuestStart() {
  const { loginAsGuest } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function start() {
    setBusy(true)
    setError(null)
    const res = await loginAsGuest()
    setBusy(false)
    if (res.ok) navigate('/app')
    else setError(res.error ?? 'Nepodařilo se spustit trenažér')
  }
  return { start, busy, error }
}

const LOGIN_ID = 'prihlaseni'

const PRIMARY_CTA = 'inline-block text-center whitespace-nowrap px-7 py-4 rounded-md bg-primary text-river-deep font-display font-bold text-lg hover:bg-[#9ad455] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 transition-colors'

/** Main call to action: start as a guest, or go straight into the app when already signed in. */
function GuestButton() {
  const { user } = useAuth()
  const { start, busy, error } = useGuestStart()
  if (user) return <Link to="/app" className={PRIMARY_CTA}>Pokračovat do trenažéru</Link>
  return (
    <>
      <button type="button" onClick={() => void start()} disabled={busy} className={PRIMARY_CTA}>
        {busy ? 'Spouštím…' : 'Vyzkoušet bez přihlášení'}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </>
  )
}

function HeroActions() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const signedIn = Boolean(user && !user.guest)
  return (
    <div>
      <GuestButton />
      {!user && (
        <p className="mt-3 text-sm text-river-line max-w-xl">
          Bez účtu máš procvičování, ostré testy i vysvětlení.
          Sledování pokroku a otázky podle slabin potřebují účet. Ten je zdarma a slouží jen k uložení
          historie tvých pokusů, žádná analytika, reklamy ani sledování.
        </p>
      )}
      {!signedIn && <div id={LOGIN_ID} className="mt-8 pt-6 border-t border-white/15 max-w-xl scroll-mt-8">
        <h2 className="font-display font-bold text-lg mb-3">Máš účet? Přihlas se</h2>
        <LoginForm tone="dark" inline onSuccess={() => navigate('/app')} />
      </div>}
    </div>
  )
}

function BottomLoginButton() {
  const { user } = useAuth()
  if (user && !user.guest) return null
  return (
    <button type="button" onClick={focusLogin}
      className="px-6 py-4 rounded-md border border-white/40 text-white font-medium whitespace-nowrap hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors">
      Přihlásit se
    </button>
  )
}

function focusLogin() {
  const section = document.getElementById(LOGIN_ID)
  section?.scrollIntoView({ behavior: 'smooth' })
  section?.querySelector<HTMLInputElement>('input[name="email"]')?.focus({ preventScroll: true })
}

function SampleQuestion() {
  const [idx, setIdx] = useState(0)
  const sample = LANDING_SAMPLES[idx]
  const question = useMemo(() => shuffleQuestionOptions(sample.question), [sample])
  const [answer, setAnswer] = useState<'a' | 'b' | 'c' | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)

  function pick(i: number) {
    setIdx(i)
    setAnswer(null)
    setExplanation(null)
  }

  useEffect(() => {
    if (!answer) return
    let cancelled = false
    fetch(`${TESTS[sample.testId].explanationsBase}/q-${sample.question.id}.html`)
      .then(r => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(html => { if (!cancelled) setExplanation(sanitizeExplanationHtml(html)) })
      .catch(() => { if (!cancelled) setExplanation('') })
    return () => { cancelled = true }
  }, [answer, sample])

  return (
    <div className="bg-white text-neutral-900 rounded-xl shadow-[0_24px_60px_-20px_rgba(4,24,31,0.6)] overflow-hidden">
      <div role="tablist" aria-label="Ukázkové otázky" className="flex gap-1 px-3 pt-3 overflow-x-auto">
        {LANDING_SAMPLES.map((s, i) => (
          <button key={s.label} role="tab" aria-selected={i === idx} onClick={() => pick(i)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              i === idx ? 'bg-river text-white' : 'text-neutral-600 hover:bg-river-mist'}`}>
            {s.label}
            {s.testId !== 'M' && <span className="ml-1 opacity-70">({s.testId})</span>}
          </button>
        ))}
      </div>

      <div className="p-5 sm:p-6">
        <div className="text-xs text-neutral-500 mb-2">
          Kategorie {sample.testId}, otázka č. {question.id}
        </div>
        <p className="font-medium text-lg leading-snug mb-4">{question.text}</p>
        {question.image && (
          <img src={question.image} alt="Obrázek k otázce"
            className="max-h-40 mb-4 rounded border border-neutral-200 bg-white" />
        )}
        <div className="flex flex-col gap-2">
          {question.options.map(o => {
            const answered = answer !== null
            const isCorrect = o.key === question.correct
            const isPicked = o.key === answer
            const state = !answered ? 'border-neutral-300 hover:border-river hover:bg-river-mist'
              : isCorrect ? 'border-primary bg-primary-light'
              : isPicked ? 'border-danger bg-danger-light'
              : 'border-neutral-200 opacity-60'
            return (
              <button key={o.key} type="button" disabled={answered} onClick={() => setAnswer(o.key)}
                className={`text-left flex gap-3 px-4 py-3 rounded-md border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${state}`}>
                <span className="font-semibold text-neutral-500">{o.key})</span>
                <span>{o.text}</span>
              </button>
            )
          })}
        </div>

        {answer === null && (
          <p className="mt-4 text-sm text-neutral-500">Vyber odpověď a hned uvidíš vysvětlení.</p>
        )}
      </div>

      {answer !== null && (
        <div className="border-t border-neutral-200 bg-neutral-50">
          <div className="px-5 sm:px-6 pt-4 flex items-baseline justify-between gap-3">
            <p className={`font-semibold ${answer === question.correct ? 'text-primary-dark' : 'text-danger'}`}>
              {answer === question.correct ? 'Správně.' : `Špatně, správně je ${question.correct}).`}
            </p>
            <span className="text-xs text-neutral-500">Vysvětlení z trenažéru</span>
          </div>
          <div className="px-5 sm:px-6 pb-5">
            {explanation === null && <p className="text-sm text-neutral-500 py-3">Načítám vysvětlení…</p>}
            {explanation === '' && <p className="text-sm text-neutral-500 py-3">Vysvětlení se nepodařilo načíst.</p>}
            {explanation && (
              <article
                className="prose prose-sm prose-neutral max-w-none prose-h2:text-base prose-h2:mt-3 prose-h3:text-sm [&_svg]:max-w-full [&_svg]:h-auto [&_table]:text-xs"
                dangerouslySetInnerHTML={{ __html: explanation }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ReadinessPreview() {
  return (
    <div className="order-2 lg:order-1 bg-white rounded-xl border border-river-line p-5 sm:p-6" aria-label="Ukázka přehledu připravenosti">
      <div className="flex items-end justify-between gap-4 mb-1">
        <div>
          <div className="text-sm text-neutral-600">Odhad úspěchu u zkoušky M</div>
          <div className="font-display text-5xl font-bold text-amber-600 leading-none mt-1">71 %</div>
        </div>
        <div className="text-right text-sm text-neutral-600">
          Očekávaný výsledek<br /><strong className="text-neutral-900">30,4 / 35</strong>
        </div>
      </div>
      <div className="h-2 bg-neutral-100 rounded mt-4 mb-6">
        <div className="h-2 bg-amber-500 rounded" style={{ width: '71%' }} />
      </div>
      <ul className="flex flex-col gap-3">
        {DEMO_GROUPS.map(g => (
          <li key={g.name} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
            <span>{g.name}</span>
            <span className={`tabular-nums font-medium ${g.accuracy >= 80 ? 'text-primary-dark' : g.accuracy >= 50 ? 'text-amber-600' : 'text-danger'}`}>
              {g.accuracy} %
            </span>
            <div className="col-span-2 h-1.5 bg-neutral-100 rounded">
              <div className={`h-1.5 rounded ${g.accuracy >= 80 ? 'bg-primary' : g.accuracy >= 50 ? 'bg-amber-500' : 'bg-danger'}`}
                style={{ width: `${g.accuracy}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-neutral-500">Ilustrační data. Tvoje čísla se počítají z tvých odpovědí.</p>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="min-h-full bg-white text-neutral-900">
      <section className="bg-river-deep text-white relative overflow-hidden">
        {/* Waterline: the one decorative element, echoing the wave hatch in the exam's own diagrams */}
        <svg aria-hidden="true" className="absolute bottom-0 left-0 w-full h-16 text-river opacity-70" viewBox="0 0 1200 64" preserveAspectRatio="none">
          <path d="M0 32 Q 50 12 100 32 T 200 32 T 300 32 T 400 32 T 500 32 T 600 32 T 700 32 T 800 32 T 900 32 T 1000 32 T 1100 32 T 1200 32 V64 H0 Z" fill="currentColor" />
        </svg>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-24 sm:pt-20 sm:pb-32 grid lg:grid-cols-[1fr_minmax(0,32rem)] gap-12 lg:gap-16 items-start">
          <div className="lg:pt-6">
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl xl:text-[3.5rem] leading-[1.05] text-balance tracking-tight">
              Trenažér na zkoušku Vůdce Malého Plavidla (VMP)
            </h1>
            <p className="mt-6 text-lg text-river-line max-w-xl leading-relaxed">
              Otázky podle tvých slabin, odhad připravenosti a vysvětlení ke každé otázce. Zdarma.
            </p>
            <div className="mt-9">
              <HeroActions />
            </div>
          </div>

          <SampleQuestion />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-[minmax(0,26rem)_1fr] gap-12 lg:gap-20 items-center">
        <ReadinessPreview />
        <div className="order-1 lg:order-2">
          <h2 className="font-display font-bold text-3xl sm:text-4xl leading-tight">Víš, jestli na zkoušku máš</h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-700 max-w-xl">
            S účtem trenažér z tvých odpovědí spočítá pravděpodobnost, že u ostrého testu dosáhneš potřebného počtu bodů,
            a ukáže, ve kterých okruzích ztrácíš. Nemusíš hádat, jestli už stačí ještě jeden večer, nebo deset.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 grid lg:grid-cols-[1fr_minmax(0,34rem)] gap-12 lg:gap-20 items-center">
        <div>
          <h2 className="font-display font-bold text-3xl sm:text-4xl leading-tight">Procvičuj, co potřebuješ</h2>
          <p className="mt-5 text-lg leading-relaxed text-neutral-700 max-w-xl">
            Vyber si oblasti, které chceš procvičit, třeba jen noční signalizaci nebo první pomoc, a kolik otázek chceš.
            Nebo nech trenažér namíchat otázky ve stejném poměru jako u zkoušky.
          </p>
        </div>
        <img src="/landing/practice-areas.webp" width={1200} height={1042} loading="lazy"
          alt="Obrazovka procvičování s vybranými oblastmi Noční a denní signalizace a Základy první pomoci"
          className="w-full h-auto rounded-xl border border-river-line shadow-[0_20px_50px_-24px_rgba(11,43,53,0.45)]" />
      </section>

      <section className="bg-river-mist">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid md:grid-cols-3 gap-10">
          <div>
            <h3 className="font-display font-bold text-xl">Otázky podle tvých slabin</h3>
            <p className="mt-3 text-neutral-700 leading-relaxed">
              Procvičování míchá hlavně otázky, ve kterých chybuješ, a ty, které jsi ještě neviděl.
              Co už umíš, se vrací jen občas, aby se to nevykouřilo z hlavy. Funguje s účtem.
            </p>
          </div>
          <div>
            <h3 className="font-display font-bold text-xl">Vysvětlení ke každé otázce</h3>
            <p className="mt-3 text-neutral-700 leading-relaxed">
              Nejen která odpověď je správná, ale proč. S odkazem na předpis, schématem světel nebo znaku
              a tipem, jak si to zapamatovat.
            </p>
          </div>
          <div>
            <h3 className="font-display font-bold text-xl">Ostrý test jako u zkoušky</h3>
            <p className="mt-3 text-neutral-700 leading-relaxed">
              Stejný počet otázek ze stejných okruhů, stejný časový limit a stejná hranice úspěchu
              jako u Státní plavební správy. Rychle, i na mobilu.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <h2 className="font-display font-bold text-3xl sm:text-4xl">Kategorie</h2>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left min-w-[36rem]">
            <thead className="text-sm text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th className="py-3 pr-4 font-normal">Kategorie</th>
                <th className="py-3 px-4 font-normal text-right">Otázek v sadě</th>
                <th className="py-3 px-4 font-normal text-right">Test</th>
                <th className="py-3 px-4 font-normal text-right">Na úspěch</th>
                <th className="py-3 pl-4 font-normal text-right">Čas</th>
              </tr>
            </thead>
            <tbody>
              {LANDING_CATEGORIES.map(c => (
                <tr key={c.id} className="border-b border-neutral-100 align-baseline">
                  <td className="py-4 pr-4">
                    <span className="font-display font-bold text-2xl text-river mr-3">{c.id}</span>
                    <span className="font-medium">{c.name}</span>
                  </td>
                  <td className="py-4 px-4 text-right tabular-nums">{c.questions}</td>
                  <td className="py-4 px-4 text-right tabular-nums">{c.testSize} otázek</td>
                  <td className="py-4 px-4 text-right tabular-nums">{c.passScore} správně</td>
                  <td className="py-4 pl-4 text-right tabular-nums">{c.minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-t border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid lg:grid-cols-2 gap-12 lg:gap-20">
          <div>
            <h2 className="font-display font-bold text-3xl">Proč to vzniklo</h2>
            <div className="mt-5 text-lg leading-relaxed text-neutral-700 space-y-4 max-w-xl">
              <p>
                Oficiální testy jsou pomalé a krkolomné, ostatní trenažéry na internetu bývají placené a taky nic moc.
                A nikde z nich nevyčteš, jak dobře jsi připravený.
                Chtěl jsem nástroj, který mi bude servírovat otázky podle toho, kde mám slabiny, dokud se je nenaučím.
              </p>
              <p>
                Tak vznikl tenhle trenažér. Je zdarma, bez reklam a jeho kód je veřejný na{' '}
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">GitHubu</a>.
                Chybu v otázce nebo vysvětlení můžeš nahlásit přímo v appce.
              </p>
            </div>
          </div>
          <div>
            <h2 className="font-display font-bold text-3xl">Zdroje</h2>
            <ul className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200">
              {SOURCES.map(s => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer"
                    className="block py-3 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
                    <span className="font-medium text-river group-hover:underline">{s.title}</span>
                    <span className="block text-sm text-neutral-600">{s.note}</span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-neutral-600 leading-relaxed">
              Trenažér není oficiální aplikace Státní plavební správy. Otázky odpovídají zveřejněným souborům,
              vysvětlení jsou připravená s pomocí AI a mohou obsahovat chyby. Rozhoduje znění předpisů.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-river-deep text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <h2 className="font-display font-bold text-3xl sm:text-4xl max-w-md leading-tight">
            Celý trenažér je zdarma, s účtem i bez něj.
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <GuestButton />
            <BottomLoginButton />
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-sm text-neutral-500 flex flex-col sm:flex-row justify-between gap-2">
        <span>
          Trenažér vůdce malého plavidla, open source projekt. Vytvořil{' '}
          <a href="https://github.com/davidesner" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-neutral-800">David Esner</a>.
        </span>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-800">Zdrojový kód na GitHubu</a>
      </footer>
    </div>
  )
}
