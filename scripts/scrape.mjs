#!/usr/bin/env node
// One-off scraper for spspraha.cz VMP M 2015 questions.
// Reads the single index page, extracts all questions, downloads images,
// and writes public/data/questions.json.

import { writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import fetch from 'node-fetch'
import * as cheerio from 'cheerio'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE_URL = 'http://www.spspraha.cz/zkousky/otazky.asp?zp=M+2015'
const OUT_JSON = join(ROOT, 'public/data/questions.json')
const OUT_IMG_DIR = join(ROOT, 'public/data/images')

const ZKRATKA_TO_GROUP = {
  PP1: 'plavebni-provoz',
  PP2: 'nocni-denni-signalizace',
  PP3: 'signalizace-rizeni-plavby',
  PP4: 'zvukove-signaly',
  TZ:  'zaklady-konstrukce-plavidel',
  ZP:  'zaklady-prvni-pomoci',
}

const GROUPS = [
  { id: 'plavebni-provoz',             name: 'Plavební provoz',                              zkratky: ['PP1'], testCount: 16 },
  { id: 'nocni-denni-signalizace',     name: 'Noční a denní signalizace',                    zkratky: ['PP2'], testCount: 7 },
  { id: 'signalizace-rizeni-plavby',   name: 'Signalizace pro řízení plavby na vodní cestě', zkratky: ['PP3'], testCount: 0 },
  { id: 'zvukove-signaly',             name: 'Zvukové signály',                              zkratky: ['PP4'], testCount: 0 },
  { id: 'vytyceni-vodnich-cest',       name: 'Vytyčení vodních cest',                        zkratky: [],      testCount: 0 },
  { id: 'zaklady-konstrukce-plavidel', name: 'Základy konstrukce plavidel',                  zkratky: ['TZ'],  testCount: 3 },
  { id: 'zaklady-prvni-pomoci',        name: 'Základy první pomoci',                         zkratky: ['ZP'],  testCount: 4 },
]

const TEST_STRUCTURE = [
  { groups: ['plavebni-provoz'],                                                                    count: 16 },
  { groups: ['nocni-denni-signalizace'],                                                            count: 7 },
  { groups: ['signalizace-rizeni-plavby', 'zvukove-signaly', 'vytyceni-vodnich-cest'],              count: 5 },
  { groups: ['zaklady-konstrukce-plavidel'],                                                        count: 3 },
  { groups: ['zaklady-prvni-pomoci'],                                                               count: 4 },
]

async function downloadImage(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch ${url}: ${res.status}`)
  await pipeline(res.body, createWriteStream(dest))
}

function normalizeWs(s) {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
}

async function main() {
  console.log(`Fetching ${SOURCE_URL} ...`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)

  mkdirSync(OUT_IMG_DIR, { recursive: true })

  const questions = []
  let currentZkratka = null
  let currentNum = null
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
      const zkrMatch = zkrText.match(/(PP1|PP2|PP3|PP4|TZ|ZP)\s*2015/)
      currentZkratka = zkrMatch ? zkrMatch[1] : null
      currentNum = cislo
      currentBuf = {
        zkratka: currentZkratka,
        num: currentNum,
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
      if ($img.length) {
        currentBuf.image = $img.attr('src') || null
      }
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

  for (const q of questions) {
    q.options.sort((a, b) => a.key.localeCompare(b.key))
  }

  const final = []
  let id = 1
  for (const q of questions) {
    if (!q.zkratka || !ZKRATKA_TO_GROUP[q.zkratka]) {
      console.warn(`Skipping question without zkratka: ${q.text.slice(0, 60)}`)
      continue
    }
    let imageRel = null
    if (q.image) {
      const ext = q.image.split('.').pop().split('?')[0]
      const filename = `q-${id}.${ext}`
      const dest = join(OUT_IMG_DIR, filename)
      try {
        await downloadImage(q.image, dest)
        imageRel = `/data/images/${filename}`
      } catch (e) {
        console.warn(`Image fail for #${id}: ${e.message}`)
      }
    }
    final.push({
      id,
      zkratka: q.zkratka,
      group: ZKRATKA_TO_GROUP[q.zkratka],
      text: q.text,
      image: imageRel,
      options: q.options,
      correct: q.correct,
    })
    id++
  }

  const bundle = {
    version: 'M-2015',
    scrapedAt: new Date().toISOString(),
    groups: GROUPS,
    testStructure: TEST_STRUCTURE,
    questions: final,
  }

  mkdirSync(dirname(OUT_JSON), { recursive: true })
  writeFileSync(OUT_JSON, JSON.stringify(bundle, null, 2), 'utf8')
  console.log(`Wrote ${final.length} questions to ${OUT_JSON}`)
}

main().catch(err => { console.error(err); process.exit(1) })
