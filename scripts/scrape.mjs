#!/usr/bin/env node
// Scraper for spspraha.cz question banks.
// Per-category config in test-configs.mjs.
//
// Usage:
//   pnpm scrape            # all categories
//   pnpm scrape M          # just M
//   pnpm scrape C          # just C

import { writeFileSync, mkdirSync, createWriteStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'
import { CATEGORIES } from './test-configs.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function outJsonPath(catId) { return join(ROOT, `public/data/questions-${catId}.json`) }
function outImgDir (catId) { return join(ROOT, `public/data/images/${catId}`) }

async function downloadImage(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch ${url}: ${res.status}`)
  await pipeline(res.body, createWriteStream(dest))
}

function normalizeWs(s) {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Parser pro kategorii M (2015)
// HTML structure: each question = bg row (s číslem a zkratkou)
// + rows pro Otázka, Odpověď a)/b)/c) jako samostatné <th>.
// "Správná odpověď a)" / "Odpověď b)" jsou v <th> jednoho řádku.
// ---------------------------------------------------------------------------
function parseM($, config) {
  const zkratkaPattern = new RegExp(`(${Object.keys(config.zkratkaToGroup).join('|')})\\s*2015`)

  const questions = []
  let currentBuf = null

  $('tr').each((_, tr) => {
    const $tr = $(tr)

    if ($tr.hasClass('bg')) {
      if (currentBuf && currentBuf.text && currentBuf.options.length === 3 && currentBuf.correct) {
        questions.push(currentBuf)
      }
      const tds = $tr.find('td')
      const cislo = parseInt(($(tds[0]).text().match(/\d+/) || ['0'])[0], 10)
      const zkrText = $(tds[1]).text()
      const zkrMatch = zkrText.match(zkratkaPattern)
      currentBuf = {
        zkratka: zkrMatch ? zkrMatch[1] : null,
        num: cislo,
        text: '',
        image: null,
        options: [],
        correct: null,
      }
      return
    }

    if (!currentBuf) return

    const $th = $tr.find('th').first()
    const headerText = normalizeWs($th.text())

    if (headerText.startsWith('Otázka')) {
      const $tds = $tr.find('td')
      currentBuf.text = normalizeWs($tds.first().text())
      const $img = $tr.find('img').first()
      if ($img.length) currentBuf.image = $img.attr('src') || null
      return
    }

    const optMatch = headerText.match(/Odpověď\s*([abc])\)/)
    const correctMatch = headerText.match(/Správná\s+odpověď\s*([abc])\)/)
    if (correctMatch) {
      const key = correctMatch[1]
      currentBuf.options.push({ key, text: normalizeWs($tr.find('td').first().text()) })
      currentBuf.correct = key
      return
    }
    if (optMatch) {
      const key = optMatch[1]
      currentBuf.options.push({ key, text: normalizeWs($tr.find('td').first().text()) })
      return
    }
  })

  if (currentBuf && currentBuf.text && currentBuf.options.length === 3 && currentBuf.correct) {
    questions.push(currentBuf)
  }
  return questions
}

// ---------------------------------------------------------------------------
// Parser pro kategorii C
// HTML structure: bg row obsahuje "Zkratka souboru otázek:</i></span> XXX"
// (bez "2015"). Otázka/Odpověď v dalších <tr>, ale `Správná odpověď a)` je
// inline header u jedné z možností (ne separate row).
// ---------------------------------------------------------------------------
function parseC($, config) {
  const allowed = new Set(Object.keys(config.zkratkaToGroup))

  const questions = []
  let currentBuf = null

  $('tr').each((_, tr) => {
    const $tr = $(tr)

    if ($tr.hasClass('bg')) {
      if (currentBuf && currentBuf.text && currentBuf.options.length === 3 && currentBuf.correct) {
        questions.push(currentBuf)
      }
      const rowText = normalizeWs($tr.text())
      // "č. 1 Zkratka souboru otázek: MP1"
      const numMatch = rowText.match(/č\.\s*(\d+)/)
      const zkrMatch = rowText.match(/Zkratka souboru otázek:\s*([A-Z0-9]+)/)
      const zkratka = zkrMatch && allowed.has(zkrMatch[1]) ? zkrMatch[1] : null
      currentBuf = {
        zkratka,
        num: numMatch ? parseInt(numMatch[1], 10) : 0,
        text: '',
        image: null,
        options: [],
        correct: null,
      }
      return
    }

    if (!currentBuf) return

    const $th = $tr.find('th').first()
    const headerText = normalizeWs($th.text())

    if (headerText.startsWith('Otázka')) {
      const $tds = $tr.find('td')
      currentBuf.text = normalizeWs($tds.first().text())
      const $img = $tr.find('img').first()
      if ($img.length) currentBuf.image = $img.attr('src') || null
      return
    }

    const correctMatch = headerText.match(/Správná\s+odpověď\s*([abc])\)/)
    const optMatch = headerText.match(/^Odpověď\s*([abc])\)/)
    if (correctMatch) {
      const key = correctMatch[1]
      currentBuf.options.push({ key, text: normalizeWs($tr.find('td').first().text()) })
      currentBuf.correct = key
      return
    }
    if (optMatch) {
      const key = optMatch[1]
      currentBuf.options.push({ key, text: normalizeWs($tr.find('td').first().text()) })
      return
    }
  })

  if (currentBuf && currentBuf.text && currentBuf.options.length === 3 && currentBuf.correct) {
    questions.push(currentBuf)
  }
  return questions
}

const PARSERS = { parseM, parseC }

// ---------------------------------------------------------------------------

async function scrapeCategory(catId) {
  const config = CATEGORIES[catId]
  if (!config) throw new Error(`Unknown category: ${catId}`)

  console.log(`\n=== Scraping ${catId} (${config.name}) ===`)
  console.log(`URL: ${config.url}`)

  const res = await fetch(config.url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${config.url}`)
  const html = await res.text()
  const $ = cheerio.load(html)

  const parser = PARSERS[config.parser]
  if (!parser) throw new Error(`Unknown parser: ${config.parser}`)
  const rawQuestions = parser($, config)
  console.log(`Parsed: ${rawQuestions.length} raw questions`)

  // sort options by key (a/b/c)
  for (const q of rawQuestions) {
    q.options.sort((a, b) => a.key.localeCompare(b.key))
  }

  const imgDir = outImgDir(catId)
  mkdirSync(imgDir, { recursive: true })

  const final = []
  let id = 1
  for (const q of rawQuestions) {
    if (!q.zkratka || !config.zkratkaToGroup[q.zkratka]) {
      console.warn(`Skipping question (no zkratka): ${q.text.slice(0, 60)}`)
      continue
    }
    let imageRel = null
    if (q.image) {
      const ext = q.image.split('.').pop().split('?')[0]
      const filename = `q-${id}.${ext}`
      const dest = join(imgDir, filename)
      try {
        await downloadImage(q.image, dest)
        imageRel = `/data/images/${catId}/${filename}`
      } catch (e) {
        console.warn(`Image fail for #${id}: ${e.message}`)
      }
    }
    final.push({
      id,
      zkratka: q.zkratka,
      group: config.zkratkaToGroup[q.zkratka],
      text: q.text,
      image: imageRel,
      options: q.options,
      correct: q.correct,
    })
    id++
  }

  const bundle = {
    testId: catId,
    version: config.version,
    name: config.name,
    scrapedAt: new Date().toISOString(),
    groups: config.groups,
    testStructure: config.testStructure,
    passing: config.passing,
    questions: final,
  }

  const outPath = outJsonPath(catId)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(bundle, null, 2), 'utf8')
  console.log(`✓ Wrote ${final.length} questions to ${outPath}`)

  // group breakdown
  const perGroup = {}
  for (const q of final) perGroup[q.group] = (perGroup[q.group] || 0) + 1
  console.log('  Per group:')
  for (const g of config.groups) {
    console.log(`    ${g.id}: ${perGroup[g.id] || 0}`)
  }
}

async function main() {
  const args = process.argv.slice(2).map(a => a.toUpperCase())
  const targets = args.length ? args : Object.keys(CATEGORIES)

  for (const catId of targets) {
    if (!CATEGORIES[catId]) {
      console.error(`Unknown category: ${catId}. Known: ${Object.keys(CATEGORIES).join(', ')}`)
      process.exit(2)
    }
  }

  for (const catId of targets) {
    await scrapeCategory(catId)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
