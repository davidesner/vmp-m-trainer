#!/usr/bin/env node
// Post-build step: generates the public, indexable content pages (no JavaScript) from the same data the app uses.
//
//   /kapitanske-zkousky                    hub: categories, topics, links to SPS
//   /testy/<kat>                           one page per exam category (format + topic mix)
//   /otazky/<kat>/<oblast>                 all questions of one topic with the correct answer marked
//   /otazky/<kat>/<oblast>/<id>            one question with its full explanation and sources
//   /sitemap.xml                           every page above plus the landing page
//
// Everything is read at build time from public/data/questions-*.json, public/explanations/<kat>/q-<id>.html
// (+ .meta.json) and scripts/test-configs.mjs (official SPS source URL per category). Adding or changing a question,
// category, topic or explanation needs no change here: rebuild and the pages follow.
//
// Usage:
//   node scripts/build-seo-pages.mjs                 # writes into dist/ (run after `vite build`)
//   node scripts/build-seo-pages.mjs --out <dir>     # writes elsewhere, e.g. for a quick look
//   node scripts/build-seo-pages.mjs --out <dir> --relative
//        links between pages become relative (open the files straight from disk) and images point at the live site
//
// No dependencies on purpose: it runs anywhere Node runs and the pages carry their own small stylesheet.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES } from './test-configs.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://vmp-trenazer.cz'
const REPO = 'https://github.com/davidesner/vmp-m-trainer'
const SPS_LINKS = [
  { href: 'https://sps.gov.cz/dok-os/zkousky', label: 'Zkoušky a soubory otázek (Státní plavební správa)' },
  { href: 'https://sps.gov.cz/dok-os/el-podani-prehled', label: 'Elektronické podání žádosti o zkoušku' },
  { href: 'https://terminy-zkousek.plavebniurad.cz/index.asp', label: 'Termíny zkoušek' },
]

// Hand-written one-liners per category. Optional: a category missing here still gets its pages from the data.
// Facts mirror src/lib/landingFaq.ts; keep the two in sync.
const CATEGORY_NOTES = {
  M: 'Základní zkouška vůdce malého plavidla. Stejné otázky platí i pro M20.',
  S: 'Doplňková zkouška pro plachetnice (i pro S20). Skládá se po kategorii M nebo M20.',
  C: 'Zkouška pro příbřežní plavbu na moři. Skládat ji můžeš, až když máš aspoň M20 nebo M.',
}

// Same palette and display font as the landing page (tailwind.config.ts). Written to /seo.css, shared by all pages.
const CSS = `
:root{--deep:#0b2b35;--river:#123f4c;--mist:#e6eff1;--line:#c9dadf;--green:#86c441;--green-dark:#6ba830;--green-light:#eef9e1;--accent:#5a6cdb;--text:#171717;--muted:#525252}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:var(--text);background:#fff}
a{color:var(--accent);text-underline-offset:2px}
img{max-width:100%;height:auto}
.wrap{max-width:52rem;margin:0 auto;padding:0 16px}
.top{background:var(--deep);color:#fff}
.top-in{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 24px;padding-top:14px;padding-bottom:14px}
.brand{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-weight:800;font-size:1.25rem;color:#fff;text-decoration:none}
.topnav{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:.95rem}
.topnav a{color:var(--line);text-decoration:none}
.topnav a:hover,.brand:hover{color:#fff;text-decoration:underline}
.crumbs ol{list-style:none;margin:0;padding:14px 16px 0;display:flex;flex-wrap:wrap;gap:4px;font-size:.85rem;color:var(--muted)}
.crumbs ol{padding-left:0}
.crumbs li+li:before{content:"›";margin:0 6px 0 2px;color:#a3a3a3}
.crumbs a{color:var(--muted);text-decoration:none}
.crumbs a:hover{text-decoration:underline}
main{padding-bottom:48px}
h1,h2,h3{font-family:"Bricolage Grotesque",system-ui,sans-serif;line-height:1.15;color:var(--deep)}
h1{font-size:clamp(1.8rem,5vw,2.6rem);font-weight:800;margin:20px 0 12px;letter-spacing:-.01em}
h1.qh1{font-size:clamp(1.5rem,4vw,2rem)}
.h1sub{display:block;font-size:.55em;font-weight:700;color:var(--muted);margin-top:6px}
h2{font-size:1.6rem;margin:40px 0 12px}
h3{font-size:1.2rem;margin:28px 0 8px}
.lead{font-size:1.1rem;color:#404040}
.kicker{margin:24px 0 0;font-size:.9rem;color:var(--muted)}
.muted{color:var(--muted);font-size:.9rem}
.source{font-size:.85rem;color:var(--muted);border-left:3px solid var(--line);padding:4px 0 4px 12px;margin:20px 0}
.tablewrap{overflow-x:auto}
table{width:100%;border-collapse:collapse}
table.wide{min-width:30rem}
th{font-weight:400;vertical-align:bottom;font-size:.85rem;color:var(--muted);text-align:left;padding:8px 12px 8px 0;border-bottom:1px solid #e5e5e5}
td{padding:12px 12px 12px 0;border-bottom:1px solid #f0f0f0;vertical-align:top}
.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
td a{text-decoration:none}
td a:hover{text-decoration:underline}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:12px}
.facts div{background:var(--mist);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column}
.facts .big{font-family:"Bricolage Grotesque",system-ui,sans-serif;font-weight:800;font-size:1.9rem;color:var(--river);line-height:1.1}
.facts span:last-child{font-size:.9rem;color:#404040}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(14rem,1fr));gap:8px 32px}
.cols h3{margin-top:12px}
ul.plain{list-style:none;padding:0;margin:0}
ul.plain li{padding:4px 0}
.cta{margin:36px 0;background:var(--deep);color:#fff;border-radius:14px;padding:20px 22px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px}
.cta p{margin:0;max-width:34rem;color:var(--mist)}
.btn{display:inline-block;background:var(--green);color:var(--deep);font-weight:700;text-decoration:none;padding:10px 18px;border-radius:10px;white-space:nowrap}
.btn:hover{background:var(--green-dark);color:#fff}
.qlist{list-style:none;padding:0;margin:24px 0}
.q{border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 14px;scroll-margin-top:16px}
.q:target{outline:3px solid var(--accent)}
.qhead{display:flex;gap:12px;align-items:baseline}
.qnum{flex:none;font-size:.8rem;font-weight:700;color:var(--river);background:var(--mist);border-radius:6px;padding:2px 7px}
.qtext{color:var(--text);font-weight:600;text-decoration:none}
.qtext:hover{text-decoration:underline}
.qimg{display:block;margin:12px 0;border-radius:6px}
.qimg.big{margin:16px 0}
.opts{list-style:none;padding:0;margin:10px 0 0}
.opts li{display:flex;gap:8px;align-items:flex-start;padding:7px 10px;border-radius:8px;margin:3px 0}
.opts li.ok{background:var(--green-light);box-shadow:inset 3px 0 0 var(--green)}
.mark{flex:none;width:1em;text-align:center;font-weight:700;color:#a3a3a3}
.opts li.ok .mark{color:var(--green-dark)}
.otext{flex:1}
.oimg{display:block;margin-top:6px}
.badge{flex:none;font-size:.8rem;font-weight:700;color:var(--green-dark);white-space:nowrap}
.qfoot{display:flex;flex-wrap:wrap;gap:4px 18px;justify-content:space-between;margin:10px 0 0;font-size:.9rem}
.qfoot a{text-decoration:none}
.qfoot a:hover{text-decoration:underline}
.expl{margin-top:32px;border-top:1px solid #e5e5e5}
.exh{margin-top:28px}
.explbody{overflow-x:auto}
.explbody h2{font-size:1.3rem;margin:28px 0 8px}
.explbody h3{font-size:1.1rem}
.explbody svg{max-width:100%;height:auto}
.explbody table{min-width:0}
.explbody td,.explbody th{padding:6px 8px}
.srcs{font-size:.9rem;color:#404040}
.ainote,.report{font-size:.9rem;color:var(--muted)}
.report{background:#fafafa;border:1px solid #eee;border-radius:8px;padding:10px 14px}
.pager{display:flex;justify-content:space-between;gap:12px;margin:28px 0;font-size:.95rem}
.pager a{text-decoration:none}
.pager a:hover{text-decoration:underline}
.foot{border-top:1px solid #e5e5e5;color:var(--muted);font-size:.85rem;padding:20px 0 32px}
.foot-links{display:flex;flex-wrap:wrap;gap:6px 18px}
.foot-links a{color:var(--muted)}
`

// ---------------------------------------------------------------------------------------------------------------
// CLI
const args = process.argv.slice(2)
const argValue = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const OUT = path.resolve(argValue('--out') ?? path.join(ROOT, 'dist'))
const RELATIVE = args.includes('--relative')

// ---------------------------------------------------------------------------------------------------------------
// Data
const DATA_DIR = path.join(ROOT, 'public/data')
const EXPL_DIR = path.join(ROOT, 'public/explanations')

const configOrder = Object.keys(CATEGORIES)
const categories = fs.readdirSync(DATA_DIR)
  .map(f => f.match(/^questions-([A-Za-z0-9]+)\.json$/)?.[1])
  .filter(Boolean)
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  .map(loadCategory)

function rank(id) { const i = configOrder.indexOf(id); return i < 0 ? 999 : i }

function loadCategory(id) {
  const bundle = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `questions-${id}.json`), 'utf8'))
  const config = CATEGORIES[id] ?? {}
  const slug = id.toLowerCase()
  const sourceUrl = config.url ? config.url.replace(/^http:\/\/(www\.)?/, 'https://www.') : null
  const groups = bundle.groups
    .map(g => ({ ...g, questions: bundle.questions.filter(q => q.group === g.id) }))
    .filter(g => g.questions.length > 0)
  for (const g of groups) {
    g.questions.sort((a, b) => a.id - b.id)
    for (const q of g.questions) q.explanation = loadExplanation(id, q.id)
  }
  return { id, slug, bundle, groups, sourceUrl, note: CATEGORY_NOTES[id] }
}

function loadExplanation(catId, qid) {
  const htmlPath = path.join(EXPL_DIR, catId, `q-${qid}.html`)
  if (!fs.existsSync(htmlPath)) return null
  const metaPath = path.join(EXPL_DIR, catId, `q-${qid}.meta.json`)
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {}
  return { html: cleanExplanation(fs.readFileSync(htmlPath, 'utf8')), sources: meta.sources ?? [], generatedAt: meta.generated_at ?? null }
}

/** The explanations are our own files, but the app sanitizes them before display, so strip the same risky bits here. */
function cleanExplanation(html) {
  return html
    .replace(/<(script|style|iframe|object|embed|form|template)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|link|meta)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"')
    .replace(/(src)=(["'])\/data\//g, `$1=$2${RELATIVE ? SITE : ''}/data/`)
    .trim()
}

// ---------------------------------------------------------------------------------------------------------------
// URLs and helpers
const urls = {
  hub: '/kapitanske-zkousky',
  category: c => `/testy/${c.slug}`,
  topic: (c, g) => `/otazky/${c.slug}/${g.id}`,
  question: (c, g, q) => `/otazky/${c.slug}/${g.id}/${q.id}`,
}

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const stripTags = html => html.replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()
const truncate = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,;:–-]$/, '') + '…'
const czDate = iso => { const d = new Date(iso); return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}` }
const isoDay = iso => new Date(iso).toISOString().slice(0, 10)
const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`
const otazek = n => plural(n, 'otázka', 'otázky', 'otázek')

/** Width/height of a JPEG/PNG/WebP from its header, so images reserve space and don't shift the layout. */
const sizeCache = new Map()
function imageSize(src) {
  if (sizeCache.has(src)) return sizeCache.get(src)
  let size = null
  try {
    const buf = fs.readFileSync(path.join(ROOT, 'public', src))
    if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') size = { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
    else if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue }
        const marker = buf[i + 1]
        const len = buf.readUInt16BE(i + 2)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          size = { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
          break
        }
        i += 2 + len
      }
    } else if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 12, 16) === 'VP8X') {
      size = { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) }
    }
  } catch { /* missing image: render without dimensions */ }
  sizeCache.set(src, size)
  return size
}

// Width and height are the displayed size (scaled down to maxHeight), so the browser reserves the space before the
// image loads and nothing below it jumps. `eager` is for the image above the fold, which is often the page's LCP.
function img(src, alt, cls = '', { maxHeight = Infinity, eager = false } = {}) {
  const size = imageSize(src)
  const scale = size ? Math.min(1, maxHeight / size.h) : 1
  const dims = size ? ` width="${Math.round(size.w * scale)}" height="${Math.round(size.h * scale)}"` : ''
  const url = RELATIVE ? SITE + src : src
  const loading = eager ? ' fetchpriority="high"' : ' loading="lazy"'
  return `<img src="${esc(url)}" alt="${esc(alt)}"${dims}${loading} decoding="async"${cls ? ` class="${cls}"` : ''}>`
}

function issueUrl(c, g, q) {
  const title = `Chyba v otázce ${c.id} č. ${q.id}`
  const body = [
    `Kategorie: ${c.id} (${c.bundle.name})`,
    `Oblast: ${g.name}`,
    `Otázka č. ${q.id}: ${q.text}`,
    `Stránka: ${SITE}${urls.question(c, g, q)}`,
    '',
    'Co je špatně (otázka, odpověď nebo vysvětlení):',
    '',
  ].join('\n')
  return `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
}

// ---------------------------------------------------------------------------------------------------------------
// Page shell
const pages = []

function addPage({ path: p, title, description, breadcrumbs, body, noindex = false, lastmod }) {
  pages.push({ path: p, title, description, breadcrumbs, body, noindex, lastmod })
}

function href(from, to) {
  if (!RELATIVE) return to
  const fromDir = from === '/' ? '' : from.slice(1)
  const target = to === '/' ? 'index.html' : `${to.slice(1)}/index.html`
  const rel = path.posix.relative(fromDir || '.', target)
  return rel || 'index.html'
}

/** A file written next to the pages (not a page): root-relative on the site, file-relative with --relative. */
function asset(from, file) {
  if (!RELATIVE) return file
  return path.posix.relative(from === '/' ? '.' : from.slice(1), file.slice(1))
}

function renderPage(page) {
  const link = to => href(page.path, to)
  const canonical = page.notFound ? null : SITE + page.path
  const crumbs = [{ name: 'Trenažér VMP', path: '/' }, ...page.breadcrumbs]
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.path })),
  }
  const nav = categories.map(c => `<a href="${link(urls.category(c))}">Kategorie ${c.id}</a>`).join('')
  const body = page.body(link)
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
${canonical ? `<link rel="canonical" href="${canonical}">\n` : ''}${page.noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta name="theme-color" content="#0b2b35">
<link rel="icon" type="image/svg+xml" href="${RELATIVE ? SITE : ''}/favicon.svg">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Trenažér VMP">
<meta property="og:locale" content="cs_CZ">
${canonical ? `<meta property="og:url" content="${canonical}">\n` : ''}<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
${page.notFound ? '' : `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n`}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${asset(page.path, '/seo.css')}">
</head>
<body>
<header class="top"><div class="wrap top-in">
<a class="brand" href="${link('/')}">Trenažér VMP</a>
<nav class="topnav"><a href="${link(urls.hub)}">Kapitánské zkoušky</a>${nav}</nav>
</div></header>
${page.notFound ? '' : `<nav class="wrap crumbs" aria-label="Drobečková navigace"><ol>${crumbs.map((c, i) => i === crumbs.length - 1
    ? `<li aria-current="page">${esc(c.name)}</li>`
    : `<li><a href="${link(c.path)}">${esc(c.name)}</a></li>`).join('')}</ol></nav>\n`}<main class="wrap">
${body}
</main>
<footer class="foot"><div class="wrap">
<p>Trenažér není oficiální aplikace Státní plavební správy. Otázky a správné odpovědi odpovídají zveřejněným souborům otázek SPS, vysvětlení jsou připravená s pomocí AI a mohou obsahovat chyby. Rozhoduje znění předpisů.</p>
<p class="foot-links"><a href="${link('/')}">Trenažér zdarma</a><a href="${link(urls.hub)}">Kapitánské zkoušky</a>${categories.map(c => `<a href="${link(urls.category(c))}">Testy ${c.id}</a>`).join('')}<a href="${REPO}" rel="noopener">Kód na GitHubu</a></p>
</div></footer>
</body>
</html>
`
}

// The landing page's top section is where people choose: continue without an account (with what that means),
// or sign in, with the note that an account only stores attempt history. Visitors from search haven't seen it yet.
const cta = (link, text = 'Procvičuj otázky nanečisto, zdarma, s účtem i bez něj.') =>
  `<aside class="cta"><p>${text}</p><a class="btn" href="${link('/')}">Spustit trenažér</a></aside>`

function segmentsOf(c) {
  // testStructure says how many questions of the real test come from which topics.
  const byId = Object.fromEntries(c.groups.map(g => [g.id, g]))
  return c.bundle.testStructure
    .map(s => ({ count: s.count, groups: s.groups.map(id => byId[id]).filter(Boolean) }))
    .filter(s => s.groups.length > 0)
}

function testShareSentence(c, g) {
  const seg = segmentsOf(c).find(s => s.groups.includes(g))
  if (!seg) return ''
  if (seg.groups.length === 1) return `V ostrém testu kategorie ${c.id} dostaneš ${otazek(seg.count)} z této oblasti.`
  return `V ostrém testu kategorie ${c.id} dostaneš ${otazek(seg.count)} dohromady z oblastí ${seg.groups.map(x => x.name).join(', ')}.`
}

function sourceNote(c) {
  const when = c.bundle.scrapedAt ? `, stav k ${czDate(c.bundle.scrapedAt)}` : ''
  const link = c.sourceUrl ? `<a href="${esc(c.sourceUrl)}" rel="noopener">soubor otázek kategorie ${c.id} na webu SPS</a>` : `soubor otázek kategorie ${c.id}`
  return `Zdroj otázek a správných odpovědí: Státní plavební správa, ${link} (verze ${esc(c.bundle.version)}${when}).`
}

/**
 * SPS publishes every question with the correct answer first and the app shuffles them. Do the same here, but with a
 * seed from the question so a page stays identical between builds; no a/b/c letters, since they'd change too.
 */
function displayOrder(c, q) {
  let seed = [...`${c.id}-${q.id}`].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 2166136261)
  const rnd = () => ((seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0) / 4294967296)
  const out = q.options.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function optionsList(c, q, compact = false) {
  return `<ul class="opts">${displayOrder(c, q).map(o => {
    const ok = o.key === q.correct
    return `<li class="${ok ? 'ok' : ''}"><span class="mark" aria-hidden="true">${ok ? '✓' : '·'}</span><span class="otext">${esc(o.text)}${o.image ? img(o.image, `Možnost k otázce č. ${q.id}: ${o.text}`, 'oimg', { maxHeight: 120 }) : ''}</span>${ok ? `<span class="badge">${compact ? 'správně' : 'správná odpověď'}</span>` : ''}</li>`
  }).join('')}</ul>`
}

// ---------------------------------------------------------------------------------------------------------------
// Pages
const latest = categories.map(c => c.bundle.scrapedAt).filter(Boolean).sort().at(-1)

// Hub
addPage({
  path: urls.hub,
  title: 'Kapitánské zkoušky VMP: testy a otázky ke zkoušce zdarma',
  description: `Kapitánské zkoušky („řidičák na loď“) na vůdce malého plavidla: formát testů ${categories.map(c => c.id).join(', ')}, všechny otázky SPS se správnými odpověďmi a vysvětlením a trenažér zdarma.`,
  breadcrumbs: [{ name: 'Kapitánské zkoušky', path: urls.hub }],
  lastmod: latest,
  body: link => `
<h1>Kapitánské zkoušky VMP: testy a otázky ke zkoušce</h1>
<p class="lead">Kapitánské zkoušky (lidově taky „řidičák na loď“) je běžný název pro zkoušku vůdce malého plavidla (VMP), kterou pořádá Státní plavební správa. Teoretická část je test na počítači: každá otázka má tři možnosti a správná je vždy jedna. Tady najdeš formát testu pro každou kategorii a všechny zveřejněné otázky se správnou odpovědí a vysvětlením.</p>
<h2>Kategorie a formát testu</h2>
<div class="tablewrap"><table class="wide">
<thead><tr><th>Kategorie</th><th class="num">Otázek v testu</th><th class="num">Na úspěch</th><th class="num">Čas</th><th class="num">Otázek v sadě</th></tr></thead>
<tbody>${categories.map(c => `<tr><td><a href="${link(urls.category(c))}"><strong>${c.id}</strong> ${esc(c.bundle.name)}</a></td><td class="num">${c.bundle.passing.total}</td><td class="num">${c.bundle.passing.score} správně</td><td class="num">${c.bundle.passing.durationMin} min</td><td class="num">${c.bundle.questions.length}</td></tr>`).join('')}</tbody>
</table></div>
${categories.filter(c => c.note).map(c => `<p><strong>${c.id}:</strong> ${esc(c.note)}</p>`).join('')}
<h2>Otázky podle oblastí</h2>
<div class="cols">${categories.map(c => `<section><h3><a href="${link(urls.category(c))}">Kategorie ${c.id}</a></h3><ul class="plain">${c.groups.map(g => `<li><a href="${link(urls.topic(c, g))}">${esc(g.name)}</a> <span class="muted">${otazek(g.questions.length)}</span></li>`).join('')}</ul></section>`).join('')}</div>
${cta(link)}
<h2>Přihláška a termíny</h2>
<p>Na zkoušku se přihlašuješ u Státní plavební správy, nejjednodušeji elektronicky. Aktuální podmínky, poplatky a termíny najdeš vždy na jejím webu.</p>
<ul>${SPS_LINKS.map(l => `<li><a href="${l.href}" rel="noopener">${esc(l.label)}</a></li>`).join('')}</ul>
`,
})

for (const c of categories) {
  const segs = segmentsOf(c)
  const p = c.bundle.passing
  // Category
  addPage({
    path: urls.category(c),
    title: `Testy VMP kategorie ${c.id} – ${c.bundle.name}: otázky a test nanečisto`,
    description: `Test kategorie ${c.id} (${c.bundle.name}): ${otazek(p.total)}, ${p.durationMin} minut, na úspěch ${p.score} správně. Všech ${c.bundle.questions.length} otázek SPS se správnými odpověďmi a vysvětlením, test nanečisto zdarma.`,
    breadcrumbs: [{ name: 'Kapitánské zkoušky', path: urls.hub }, { name: `Kategorie ${c.id}`, path: urls.category(c) }],
    lastmod: c.bundle.scrapedAt,
    body: link => `
<h1>Testy VMP kategorie ${c.id}: ${esc(c.bundle.name)}</h1>
${c.note ? `<p class="lead">${esc(c.note)}</p>` : ''}
<h2>Formát testu</h2>
<div class="facts">
<div><span class="big">${p.total}</span><span>otázek v testu</span></div>
<div><span class="big">${p.durationMin} min</span><span>časový limit</span></div>
<div><span class="big">${p.score}</span><span>správně na úspěch</span></div>
<div><span class="big">${c.bundle.questions.length}</span><span>otázek v sadě</span></div>
</div>
<h2>Z čeho se test skládá</h2>
<div class="tablewrap"><table>
<thead><tr><th>Oblast</th><th class="num">Otázek v testu</th><th class="num">Otázek v sadě</th></tr></thead>
<tbody>${segs.map(s => `<tr><td>${s.groups.map(g => `<a href="${link(urls.topic(c, g))}">${esc(g.name)}</a>`).join('<br>')}</td><td class="num">${s.count}</td><td class="num">${s.groups.reduce((n, g) => n + g.questions.length, 0)}</td></tr>`).join('')}</tbody>
</table></div>
${segs.some(s => s.groups.length > 1) ? '<p class="muted">Kde je v řádku víc oblastí, test vybírá uvedený počet otázek z nich dohromady.</p>' : ''}
${cta(link, `Zkus si test kategorie ${c.id} nanečisto: stejný počet otázek, stejný čas a stejná hranice úspěchu jako u zkoušky.`)}
<p class="source">${sourceNote(c)}</p>
`,
  })

  for (const g of c.groups) {
    // Topic
    addPage({
      path: urls.topic(c, g),
      title: `Otázky VMP ${c.id}: ${g.name} (${otazek(g.questions.length)} se správnými odpověďmi)`,
      description: `Všech ${otazek(g.questions.length)} z oblasti ${g.name} ke zkoušce vůdce malého plavidla, kategorie ${c.id}. Správné odpovědi, obrázky a vysvětlení ke každé otázce.`,
      breadcrumbs: [{ name: 'Kapitánské zkoušky', path: urls.hub }, { name: `Kategorie ${c.id}`, path: urls.category(c) }, { name: g.name, path: urls.topic(c, g) }],
      lastmod: c.bundle.scrapedAt,
      body: link => `
<h1>Otázky VMP: ${esc(g.name)} <span class="h1sub">kategorie ${c.id}</span></h1>
<p class="lead">${otazek(g.questions.length)} z oblasti ${esc(g.name)}. ${testShareSentence(c, g)}</p>
<p class="source">${sourceNote(c)}</p>
<ol class="qlist">${g.questions.map(q => `
<li id="q-${q.id}" class="q">
<div class="qhead"><span class="qnum">č. ${q.id}</span><a href="${link(urls.question(c, g, q))}" class="qtext">${esc(q.text)}</a></div>
${q.image ? img(q.image, `Obrázek k otázce č. ${q.id}: ${q.text}`, 'qimg', { maxHeight: 220 }) : ''}
${optionsList(c, q, true)}
<p class="qfoot">${q.explanation ? `<a href="${link(urls.question(c, g, q))}">Proč? Vysvětlení →</a>` : ''}${c.sourceUrl ? `<a class="muted" href="${esc(c.sourceUrl)}" rel="noopener">Zdroj: SPS, otázka č. ${q.id}</a>` : ''}</p>
</li>`).join('')}
</ol>
${cta(link, `Procvič si oblast ${g.name} v trenažéru: otázky v náhodném pořadí a s vyhodnocením.`)}
`,
    })

    // Questions
    g.questions.forEach((q, i) => {
      const correct = q.options.find(o => o.key === q.correct)
      const prev = g.questions[i - 1]
      const next = g.questions[i + 1]
      const ex = q.explanation
      const exText = ex ? stripTags(ex.html) : ''
      addPage({
        path: urls.question(c, g, q),
        title: truncate(`${q.text.replace(/:$/, '')}: ${correct?.text.replace(/\.$/, '') ?? ''}`, 80) + ` | VMP ${c.id} č. ${q.id}`,
        description: truncate(ex ? `Správně: ${correct?.text} ${exText}` : `Otázka č. ${q.id} ke zkoušce VMP, kategorie ${c.id}, oblast ${g.name}. Správná odpověď: ${correct?.text}`, 158),
        breadcrumbs: [{ name: 'Kapitánské zkoušky', path: urls.hub }, { name: `Kategorie ${c.id}`, path: urls.category(c) }, { name: g.name, path: urls.topic(c, g) }, { name: `Otázka č. ${q.id}`, path: urls.question(c, g, q) }],
        // Without an explanation the page is just a copy of the topic list entry; keep it out of the index until one exists.
        noindex: !ex,
        lastmod: [c.bundle.scrapedAt, ex?.generatedAt].filter(Boolean).sort().at(-1),
        body: link => `
<p class="kicker">Kategorie ${c.id} · ${esc(g.name)} · otázka č. ${q.id}</p>
<h1 class="qh1">${esc(q.text)}</h1>
${q.image ? img(q.image, `Obrázek k otázce č. ${q.id}: ${q.text}`, 'qimg big', { maxHeight: 340, eager: true }) : ''}
${optionsList(c, q)}
<p class="source">Zdroj otázky: Státní plavební správa, ${c.sourceUrl ? `<a href="${esc(c.sourceUrl)}" rel="noopener">soubor otázek kategorie ${c.id}</a>` : `soubor otázek kategorie ${c.id}`} (verze ${esc(c.bundle.version)}), otázka č. ${q.id}.</p>
${ex ? `
<section class="expl">
<h2 class="exh">Vysvětlení</h2>
<div class="explbody">${ex.html}</div>
${ex.sources.length ? `<h3>Zdroje vysvětlení</h3><ul class="srcs">${ex.sources.map(s => /^https?:\/\//.test(s) ? `<li><a href="${esc(s)}" rel="noopener nofollow">${esc(s.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></li>` : `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
<p class="ainote">Vysvětlení je připravené s pomocí AI${ex.generatedAt ? ` (${czDate(ex.generatedAt)})` : ''} a může obsahovat chybu. Rozhoduje znění předpisů.</p>
</section>` : '<p class="muted">Vysvětlení k této otázce zatím chybí.</p>'}
<p class="report">Našel jsi chybu v otázce nebo vysvětlení? <a href="${issueUrl(c, g, q)}" rel="noopener">Nahlas ji na GitHubu</a>.</p>
<nav class="pager">${prev ? `<a href="${link(urls.question(c, g, prev))}">← č. ${prev.id}</a>` : '<span></span>'}<a href="${link(urls.topic(c, g))}#q-${q.id}">Všechny otázky z oblasti</a>${next ? `<a href="${link(urls.question(c, g, next))}">č. ${next.id} →</a>` : '<span></span>'}</nav>
${cta(link)}
`,
      })
    })
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Write
let written = 0
let biggest = { path: '', bytes: 0 }
for (const page of pages) {
  const html = renderPage(page)
  const bytes = Buffer.byteLength(html)
  if (bytes > biggest.bytes) biggest = { path: page.path, bytes }
  // SeznamBot skips HTML over 1 MB; fail loudly rather than publish a page it ignores.
  if (bytes > 900 * 1024) throw new Error(`build-seo-pages: ${page.path} is ${Math.round(bytes / 1024)} kB, over the 900 kB budget`)
  const dir = path.join(OUT, page.path.slice(1))
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), html)
  written++
}

// Vercel serves dist/404.html with status 404 for every path that matches no file and no rewrite.
// It is served at any depth, so its links stay root-relative (in --relative previews they resolve from the root).
fs.writeFileSync(path.join(OUT, '404.html'), renderPage({
  path: '/',
  notFound: true,
  noindex: true,
  title: 'Stránka nenalezena | Trenažér VMP',
  description: 'Tahle stránka neexistuje. Pokračuj na testy a otázky ke zkoušce vůdce malého plavidla.',
  breadcrumbs: [],
  body: link => `
<h1>Stránka nenalezena</h1>
<p class="lead">Tahle adresa neexistuje, nebo se přesunula. Otázky a testy najdeš tady:</p>
<ul>
<li><a href="${link(urls.hub)}">Kapitánské zkoušky: formát testů a všechny otázky</a></li>
${categories.map(c => `<li><a href="${link(urls.category(c))}">Testy kategorie ${c.id}: ${esc(c.bundle.name)}</a></li>`).join('\n')}
</ul>
${cta(link)}
`,
}))

const sitemapEntries = [{ path: '/', lastmod: latest }, ...pages.filter(p => !p.noindex)]
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(p => `  <url><loc>${SITE}${p.path}</loc>${p.lastmod ? `<lastmod>${isoDay(p.lastmod)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`
fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap)
fs.writeFileSync(path.join(OUT, 'seo.css'), CSS.trim() + '\n')

console.log(`build-seo-pages: ${written} pages (${pages.filter(p => p.noindex).length} noindex), sitemap with ${sitemapEntries.length} URLs, largest ${biggest.path} ${Math.round(biggest.bytes / 1024)} kB → ${path.relative(ROOT, OUT) || OUT}`)
