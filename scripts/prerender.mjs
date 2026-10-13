// Post-build step: bakes the landing page into dist/index.html and keeps an empty SPA shell for every
// other route in dist/spa.html, so /app and friends don't flash the landing page before React starts.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dist = path.resolve('dist')
const shellPath = path.join(dist, 'index.html')
const shell = fs.readFileSync(shellPath, 'utf8')
const marker = '<div id="root"></div>'
if (!shell.includes(marker)) throw new Error(`prerender: ${marker} not found in dist/index.html`)

const { renderLanding } = await import(pathToFileURL(path.resolve('dist-ssr/prerender.js')).href)
const html = renderLanding()
if (!html.includes('<h1')) throw new Error('prerender: rendered landing page has no <h1>')

fs.writeFileSync(path.join(dist, 'spa.html'), shell)
fs.writeFileSync(shellPath, shell.replace(marker, `<div id="root">${html}</div>`))
console.log(`prerender: landing page baked into dist/index.html (${Math.round(html.length / 1024)} kB), SPA shell in dist/spa.html`)
