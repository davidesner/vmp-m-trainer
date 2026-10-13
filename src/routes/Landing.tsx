import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AuthOptions from '../components/AuthOptions'
import ExplainButton from '../components/ExplainButton'
import { LANDING_CATEGORIES, LANDING_SAMPLES } from '../lib/landingSamples'
import { LANDING_FAQ } from '../lib/landingFaq'
import { shuffleQuestionOptions } from '../lib/shuffleOptions'

const REPO_URL = 'https://github.com/davidesner/vmp-m-trainer'
const COFFEE_URL = 'https://buymeacoffee.com/davidesner'

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

/** GitHub's mark (Octicons `mark-github`), in the link's text colour. */
function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="w-4 h-4 shrink-0" fill="currentColor">
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  )
}

/** Small cup for the Buy Me a Coffee link, filled in that platform's yellow so it reads as theirs. */
function CoffeeCup() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8z" fill="#FFDD00" />
      <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8.5 2.5v2M12 2.5v2" />
    </svg>
  )
}

function AnchorMark({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className}
      fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="6" r="3" />
      <path d="M16 9v19" />
      <path d="M10 14h12" />
      <path d="M5 19c0 5 5 9 11 9s11-4 11-9" />
      <path d="M5 19l-2 2M5 19l2.5 1.5M27 19l2 2M27 19l-2.5 1.5" />
    </svg>
  )
}

// Anchor geometry in its 32-unit viewBox: the chain attaches at the top of the ring (y = 3).
const RING_TOP = 3 / 32
// The hawse hole the anchor pays out of, in px.
const HAWSE_W = 72
const HAWSE_H = 44
// Chain showing between the hawse rim and the anchor ring before any scrolling, in px.
const START_CHAIN = 20
// Chain link pitch in px (height of the chain pattern tile).
const LINK_PITCH = 22
// The anchor is fully under the waves once the hero's bottom edge has scrolled up to this share of the screen.
const SUBMERGED_AT = 0.35

/**
 * Anchor hanging from a hawse hole level with the hero heading. As the page
 * scrolls it pays out on its chain and sinks steadily under the waves, so it
 * never shows up over the white sections below. Only from 1400px (where the
 * margin beside the content fits the anchor) and without reduced motion;
 * elsewhere the static anchor rests in the waves.
 */
function SinkingAnchor() {
  const layerRef = useRef<HTMLDivElement>(null)
  const hawseRef = useRef<SVGSVGElement>(null)
  const chainRef = useRef<SVGSVGElement>(null)
  const linksRef = useRef<SVGPatternElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const layer = layerRef.current
    const hawse = hawseRef.current
    const chain = chainRef.current
    const links = linksRef.current
    const anchor = anchorRef.current
    if (!layer || !hawse || !chain || !links || !anchor) return
    let frame = 0

    const update = () => {
      frame = 0
      const hero = layer.getBoundingClientRect()
      if (hero.height === 0) return  // hidden on this screen size
      const size = anchor.offsetHeight
      // The hawse hole sits level with the top of the hero heading.
      const title = layer.parentElement?.querySelector('h1')
      const hawseTop = title ? title.getBoundingClientRect().top - hero.top : 0
      const hawseCenter = hawseTop + HAWSE_H / 2
      // At rest the anchor hangs just below the hole on a short length of chain. Fully paid out: under the waterline.
      const stowed = hawseTop + HAWSE_H + START_CHAIN - size * RING_TOP
      const submerged = hero.height
      const scrollToSubmerge = Math.max(1, hero.height - window.innerHeight * SUBMERGED_AT)
      const scrolled = Math.max(0, -hero.top)
      const y = Math.min(submerged, stowed + (submerged - stowed) * (scrolled / scrollToSubmerge))
      const chainLength = Math.max(0, y + size * RING_TOP - hawseCenter)

      // `top`, not transform: both are centred horizontally with a translate class.
      hawse.style.top = `${hawseTop}px`
      chain.style.top = `${hawseCenter}px`
      chain.style.height = `${chainLength}px`
      // Shift the links with the paid-out length so they run out of the hole instead of sliding past it.
      links.setAttribute('y', String(chainLength % LINK_PITCH))
      anchor.style.transform = `translateY(${y}px)`
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  // Centred in the free margin right of the max-w-6xl content (72rem + 1.5rem padding), so the hawse hole
  // clears the question card. Opacity sits on the whole layer, not in the colour, so overlapping strokes
  // don't stack into brighter joints.
  return (
    <div ref={layerRef} aria-hidden="true"
      className="hidden min-[1400px]:motion-safe:block absolute inset-y-0 right-[calc((100%_-_72rem)/4_+_0.75rem_-_5rem)] w-40 pointer-events-none text-[#5f8f9c] opacity-35">
      {/* Hawse hole; the chain is drawn after it so it runs out of the opening and over the lower rim. */}
      <svg ref={hawseRef} viewBox={`0 0 ${HAWSE_W} ${HAWSE_H}`} width={HAWSE_W} height={HAWSE_H}
        className="absolute top-0 left-1/2 -translate-x-1/2">
        <ellipse cx={HAWSE_W / 2} cy={HAWSE_H / 2} rx={HAWSE_W / 2 - 1} ry={HAWSE_H / 2 - 1} fill="currentColor" />
        <ellipse cx={HAWSE_W / 2} cy={HAWSE_H / 2} rx={HAWSE_W / 2 - 9} ry={HAWSE_H / 2 - 8} fill="#020f13" />
      </svg>
      <AnchorRig chainRef={chainRef} linksRef={linksRef} anchorRef={anchorRef} />
    </div>
  )
}

/**
 * Chain plus anchor, positioned by the caller through the refs: the chain's
 * `top`/`height` and the links pattern `y`, the anchor's `transform`.
 */
function AnchorRig({ chainRef, linksRef, anchorRef }: {
  chainRef: React.RefObject<SVGSVGElement | null>
  linksRef: React.RefObject<SVGPatternElement | null>
  anchorRef: React.RefObject<HTMLDivElement | null>
}) {
  const patternId = useId()
  return (
    <>
      {/* Chain of alternating front-on and side-on links. */}
      <svg ref={chainRef} className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-0 overflow-visible">
        <defs>
          {/* Dark outlines keep the links readable where the chain crosses the same-coloured hawse rim. */}
          <pattern ref={linksRef} id={patternId} width="16" height={LINK_PITCH} patternUnits="userSpaceOnUse">
            <rect x="3" y="1" width="10" height="13" rx="5" fill="none" stroke="#020f13" strokeWidth="5" />
            <rect x="3" y="1" width="10" height="13" rx="5" fill="none" stroke="currentColor" strokeWidth="3" />
            <rect x="6.5" y="12" width="3" height="11" rx="1.5" fill="currentColor" stroke="#020f13" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <div ref={anchorRef} className="absolute top-0 left-0 w-full aspect-square will-change-transform">
        <AnchorMark className="block w-full h-full" />
      </div>
    </>
  )
}

// How far the bottom of the landed anchor's box sits above the bottom of the closing panel. The artwork ends
// ~18px above the box bottom, so this rests the flukes a few px into the mound below.
const SEABED_REST = 12

// Gentle seabed with a mound on the right (about where the anchor column lands) for it to rest on.
const SEABED_PATH = 'M0 34 C 180 24 380 20 560 28 S 860 34 980 22 S 1080 8 1120 8 S 1180 14 1200 18 V48 H0 Z'

/** Seabed along the bottom of the closing panel; drawn after the anchor so it covers the flukes. */
function Seabed() {
  return (
    <svg aria-hidden="true" className="absolute bottom-0 left-0 w-full h-12 text-river-wave" viewBox="0 0 1200 48" preserveAspectRatio="none">
      <path d={SEABED_PATH} fill="currentColor" />
    </svg>
  )
}

// Share of the closing panel's scroll spent descending; the rest is spent tipping over onto the seabed.
const TOUCHDOWN_AT = 0.8
// How far the anchor tips over to the left once it rests on the seabed, in degrees.
const TIP_ANGLE = -28
// Pivot for tipping: the bottom of the anchor's arc (y = 28 of the 32-unit viewBox).
const ARC_BOTTOM = 28 / 32
// Distance between consecutive links along the chain (half the pattern pitch: front link, then side link).
const LINK_STEP = LINK_PITCH / 2
// Where the chain comes in, above the panel's top edge, so its end is never visible.
const CHAIN_ENTRY = -40
// Share of the tipped ring's sideways shift the chain keeps at the panel's top edge (0 = hangs fully plumb).
const CHAIN_LEAN = 0.25
// Enough links to cover the panel height plus the slack curve.
const MAX_LINKS = 60

type Point = { x: number; y: number }

/** Point on a quadratic Bezier at t. */
function bezier(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }
}

/**
 * The same anchor arriving in the closing panel: it comes down on its chain
 * from the panel's top edge as the panel scrolls into view, touches the seabed
 * and, by the time the page reaches its end, tips over onto its left fluke the
 * way a dropped anchor settles. The chain doesn't rotate with it: it is laid
 * out link by link along a curve that hangs nearly plumb over wherever the
 * tipped ring ends up.
 */
function LandingAnchor() {
  const layerRef = useRef<HTMLDivElement>(null)
  const linksRef = useRef<SVGGElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const layer = layerRef.current
    const linkGroup = linksRef.current
    const anchor = anchorRef.current
    if (!layer || !linkGroup || !anchor) return
    const links = Array.from(linkGroup.children) as SVGGraphicsElement[]
    let frame = 0

    const update = () => {
      frame = 0
      const panel = layer.getBoundingClientRect()
      if (panel.height === 0) return  // hidden on this screen size
      const size = anchor.offsetHeight
      // Progress from the panel's top edge entering the screen (0) to the end of the page (1).
      const panelTop = panel.top + window.scrollY
      const startScroll = panelTop - window.innerHeight
      const endScroll = document.documentElement.scrollHeight - window.innerHeight
      const progress = endScroll > startScroll
        ? Math.min(1, Math.max(0, (window.scrollY - startScroll) / (endScroll - startScroll)))
        : 1
      const descent = Math.min(1, progress / TOUCHDOWN_AT)
      const tip = Math.max(0, (progress - TOUCHDOWN_AT) / (1 - TOUCHDOWN_AT))
      const angle = TIP_ANGLE * (1 - (1 - tip) ** 2)  // eases out as it comes to rest

      const above = -size
      const landed = panel.height - SEABED_REST - size
      const y = above + (landed - above) * descent
      anchor.style.transform = `translateY(${y}px) rotate(${angle}deg)`

      // Where the chain meets the ring once the anchor is rotated about the bottom of its arc.
      const cx = layer.offsetWidth / 2
      const reach = (ARC_BOTTOM - RING_TOP) * size
      const rad = (angle * Math.PI) / 180
      const ring: Point = { x: cx + reach * Math.sin(rad), y: y + ARC_BOTTOM * size - reach * Math.cos(rad) }
      // The chain hangs plumb over the ring, with a slight lean back towards where it came down at the top.
      // Straight while the anchor hangs.
      const entry: Point = { x: ring.x + (cx - ring.x) * CHAIN_LEAN, y: CHAIN_ENTRY }
      const control: Point = { x: ring.x, y: entry.y + (ring.y - entry.y) * 0.5 }

      // Sample the curve from the ring upwards, then drop a link every LINK_STEP along it.
      const samples: Point[] = []
      for (let k = 0; k <= 48; k++) samples.push(bezier(ring, control, entry, k / 48))
      let travelled = 0
      let next = LINK_STEP / 2
      let used = 0
      for (let k = 1; k < samples.length && used < links.length; k++) {
        const a = samples[k - 1]
        const b = samples[k]
        const seg = Math.hypot(b.x - a.x, b.y - a.y)
        while (next <= travelled + seg && used < links.length) {
          const f = (next - travelled) / seg
          const px = a.x + (b.x - a.x) * f
          const py = a.y + (b.y - a.y) * f
          const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90
          links[used].setAttribute('transform', `translate(${px} ${py}) rotate(${deg})`)
          links[used].style.display = ''
          used++
          next += LINK_STEP
        }
        travelled += seg
      }
      for (let k = used; k < links.length; k++) links[k].style.display = 'none'
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  // Same column, size and look as the hero's SinkingAnchor.
  return (
    <div ref={layerRef} aria-hidden="true"
      className="hidden min-[1400px]:motion-safe:block absolute inset-y-0 right-[calc((100%_-_72rem)/4_+_0.75rem_-_5rem)] w-40 pointer-events-none text-[#5f8f9c] opacity-35">
      <svg className="absolute inset-0 w-full h-full overflow-visible">
        {/* Links centred on the origin; alternate front-on rings and side-on bars, like the hero chain. */}
        <g ref={linksRef}>
          {Array.from({ length: MAX_LINKS }, (_, k) => k % 2 === 0
            ? <rect key={k} x="-5" y="-6.5" width="10" height="13" rx="5" fill="none" stroke="currentColor" strokeWidth="3" />
            : <rect key={k} x="-1.5" y="-5.5" width="3" height="11" rx="1.5" fill="currentColor" />)}
        </g>
      </svg>
      <div ref={anchorRef} className="absolute top-0 left-0 w-full aspect-square will-change-transform"
        style={{ transformOrigin: `50% ${ARC_BOTTOM * 100}%` }}>
        <AnchorMark className="block w-full h-full" />
      </div>
    </div>
  )
}

// FAQPage structured data built from the same items the section renders, so the two can't drift apart.
const FAQ_JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: LANDING_FAQ.map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
})

/** Common questions about the exam and the trainer; answers stay in the HTML when collapsed, so crawlers read them. */
function Faq() {
  return (
    <section className="border-t border-neutral-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="font-display font-bold text-3xl sm:text-4xl">Časté otázky</h2>
        <div className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
          {LANDING_FAQ.map(item => (
            <details key={item.question} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-lg marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                {item.question}
                <span aria-hidden="true" className="shrink-0 text-river text-2xl leading-none transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="pb-5 text-neutral-700 leading-relaxed">
                <p>{item.answer}</p>
                {item.links && (
                  <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                    {item.links.map(l => (
                      <li key={l.href}>
                        <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{l.label}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_JSON_LD }} />
    </section>
  )
}

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

const SECONDARY_CTA = 'inline-block text-center whitespace-nowrap px-6 py-4 rounded-md border border-white/40 text-white font-medium hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors'

/** Main call to action: start as a guest, or go straight into the app when already signed in. */
function GuestButton() {
  const { user } = useAuth()
  const { start, busy, error } = useGuestStart()
  if (user?.guest) return <Link to="/app" className={SECONDARY_CTA}>Pokračovat bez účtu</Link>
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
  const auth = (heading: string) => (
    <div id={LOGIN_ID} className="scroll-mt-8">
      <h2 className="font-display font-bold text-lg mb-3">{heading}</h2>
      <AuthOptions tone="dark" onSuccess={() => navigate('/app')} />
    </div>
  )

  if (user && !user.guest) return <GuestButton />

  if (user?.guest) {
    return (
      <div className="max-w-xl">
        {auth('Přihlas se nebo si vytvoř účet')}
        <p className="mt-4 text-sm text-river-line">
          Účet je zdarma a slouží jen k uložení historie tvých pokusů, žádná analytika, reklamy ani sledování.
        </p>
        <div className="mt-8 pt-6 border-t border-white/15">
          <GuestButton />
          <p className="mt-3 text-sm text-river-line">
            Bez účtu máš procvičování, ostré testy i vysvětlení. Pokrok se ale neukládá,
            takže nevidíš odhad připravenosti a nedostaneš otázky podle svých slabin.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <GuestButton />
      <p className="mt-3 text-sm text-river-line max-w-xl">
        Bez účtu máš procvičování, ostré testy i vysvětlení.
        Sledování pokroku a otázky podle slabin potřebují účet. Ten je zdarma a slouží jen k uložení
        historie tvých pokusů, žádná analytika, reklamy ani sledování.
      </p>
      <div className="mt-8 pt-6 border-t border-white/15 max-w-xl">{auth('Chceš ukládat pokrok?')}</div>
    </div>
  )
}

function BottomActions() {
  const { user } = useAuth()
  const login = (primary: boolean) => (
    <button type="button" onClick={focusLogin} className={primary ? PRIMARY_CTA : SECONDARY_CTA}>
      {primary ? 'Vytvořit účet nebo se přihlásit' : 'Přihlásit se'}
    </button>
  )
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {user?.guest ? <>{login(true)}<GuestButton /></> : <><GuestButton />{!user && login(false)}</>}
    </div>
  )
}

function focusLogin() {
  const section = document.getElementById(LOGIN_ID)
  section?.scrollIntoView({ behavior: 'smooth' })
  section?.querySelector<HTMLElement>('button:not([disabled]), a')?.focus({ preventScroll: true })
}

function SampleQuestion() {
  const [idx, setIdx] = useState(0)
  const sample = LANDING_SAMPLES[idx]
  const question = useMemo(() => shuffleQuestionOptions(sample.question), [sample])
  const [answer, setAnswer] = useState<'a' | 'b' | 'c' | null>(null)

  function pick(i: number) {
    setIdx(i)
    setAnswer(null)
  }

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

        {/* Same as in the app: verdict after answering, explanation in a modal behind an always-present button. */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {answer === null
            ? <p className="text-sm text-neutral-500">Vyber odpověď, nebo se rovnou podívej na vysvětlení.</p>
            : <p className={`font-semibold ${answer === question.correct ? 'text-primary-dark' : 'text-danger'}`}>
                {answer === question.correct ? 'Správně.' : `Špatně, správně je ${question.correct}).`}
              </p>}
          <ExplainButton question={question} userAnswer={answer} testId={sample.testId} showFeedback={false} />
        </div>
      </div>
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
        {/* Anchors are drawn before the waves so the waves cover them: a static one resting on the bottom, or one that sinks on scroll. */}
        <AnchorMark className="min-[1400px]:motion-safe:hidden absolute right-[4%] bottom-0 w-36 h-36 lg:w-48 lg:h-48 text-river-wave" />
        <SinkingAnchor />
        {/* Waterline echoing the wave hatch in the exam's own diagrams. Opaque, so the anchor sinks under it. */}
        <svg aria-hidden="true" className="absolute bottom-0 left-0 w-full h-16 text-river-wave" viewBox="0 0 1200 64" preserveAspectRatio="none">
          <path d="M0 32 Q 50 12 100 32 T 200 32 T 300 32 T 400 32 T 500 32 T 600 32 T 700 32 T 800 32 T 900 32 T 1000 32 T 1100 32 T 1200 32 V64 H0 Z" fill="currentColor" />
        </svg>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-40 sm:pt-20 lg:pb-48 grid lg:grid-cols-[1fr_minmax(0,32rem)] gap-12 lg:gap-16 items-start">
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
                Tak vznikl tenhle trenažér. Dávám ho zdarma, protože provoz i vývoj skoro nic nestojí a chci pomoct komunitě.
                Platit za tak triviální nástroj je nesmysl.
                Je bez reklam a jeho kód je veřejný na{' '}
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">GitHubu</a>.
                Chybu v otázce nebo vysvětlení můžeš nahlásit přímo v appce.
              </p>
              <p>
                Jestli ti trenažér pomohl, můžeš mi{' '}
                <a href={COFFEE_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">koupit kafe</a>.
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

      <Faq />

      <section className="relative overflow-hidden bg-river-deep text-white">
        <LandingAnchor />
        <Seabed />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-24 sm:pt-16 sm:pb-28 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <h2 className="font-display font-bold text-3xl sm:text-4xl max-w-md leading-tight">
            Celý trenažér je zdarma, s účtem i bez něj.
          </h2>
          <BottomActions />
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-sm text-neutral-500 flex flex-col sm:flex-row justify-between gap-2">
        <span>
          Vytvořil{' '}
          <a href="https://github.com/davidesner" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-neutral-800">David Esner</a>, květen 2026
        </span>
        <div className="flex flex-col sm:flex-row gap-x-6 gap-y-2">
          <a href={COFFEE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-neutral-800">
            <CoffeeCup />
            Kup mi kafe
          </a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-neutral-800">
            <GitHubMark />
            Kód na GitHubu
          </a>
        </div>
      </footer>
    </div>
  )
}
