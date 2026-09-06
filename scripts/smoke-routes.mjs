#!/usr/bin/env node
/**
 * Loads every route in a running dev server and fails on any page error.
 *
 * Exists because neither the build nor the unit tests catch a module-scope
 * throw: renaming a textbook id left a dev-only lab page calling
 * `getTextbook('nsm-n3').chapters` on a null, which threw during import and
 * blanked the entire app. `vite build` succeeded, eslint passed, 73 tests
 * passed, and every route was a black screen.
 *
 * Run: npm run dev, then node scripts/smoke-routes.mjs [baseUrl]
 * Needs the browser once: npx playwright install chromium
 */

import { chromium } from 'playwright'

const base = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')
const ROUTES = [
  '/', '#/vocab', '#/vocab-srs', '#/immersion', '#/dictionary', '#/story',
  '#/account', '#/dev/home-cards', '#/dev/textbook-picker', '#/dev/style-guide', '#/dev/home-flow',
]
// A route that renders less than this is almost certainly a crashed shell
// rather than a legitimately sparse screen.
const MIN_ROOT_HTML = 200

// Loading a route only exercises what renders on arrival. Both crashes this
// script was written for got past that once: the first threw at import, the
// second only when a control was pressed. So a few things also get opened.
const INTERACTIONS = [
  { route: '/', label: 'textbook picker', match: /change textbook|choose textbook|pick new textbook/i },
]

const browser = await chromium.launch()
let failures = 0

for (const route of ROUTES) {
  const page = await browser.newPage()
  // A thrown exception is what blanks the app and is a hard failure. A console
  // error is usually a fail-open network call (ai_availability 404s when that
  // function is absent, by design) — reported, but not a failure.
  const thrown = []
  const noise = []
  page.on('pageerror', e => thrown.push(e.message))
  page.on('console', m => { if (m.type() === 'error') noise.push(m.text()) })

  const url = route.startsWith('#') ? `${base}/${route}` : `${base}${route}`
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(800)
  } catch (e) {
    thrown.push(`navigation: ${e.message}`)
  }
  const size = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length ?? 0)

  const bad = thrown.length > 0 || size < MIN_ROOT_HTML
  if (bad) failures++
  const note = thrown.length ? `  ${thrown[0].slice(0, 90)}`
    : noise.length ? `  (${noise.length} console error${noise.length > 1 ? 's' : ''}: ${noise[0].slice(0, 60)})`
    : ''
  console.log(`${bad ? 'FAIL' : ' ok '}  ${route.padEnd(24)} root=${String(size).padStart(6)}${note}`)
  await page.close()
}

for (const { route, label, match } of INTERACTIONS) {
  const page = await browser.newPage()
  const thrown = []
  page.on('pageerror', e => thrown.push(e.message))
  const url = route.startsWith('#') ? `${base}/${route}` : `${base}${route}`
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => thrown.push(`navigation: ${e.message}`))
  await page.waitForTimeout(600)

  const target = page.getByText(match).first()
  const present = await target.count()
  if (present) {
    await target.click({ force: true }).catch(e => thrown.push(`click: ${e.message}`))
    await page.waitForTimeout(900)
  }
  const size = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length ?? 0)
  const bad = thrown.length > 0 || size < MIN_ROOT_HTML
  if (bad) failures++
  console.log(`${bad ? 'FAIL' : ' ok '}  open ${label.padEnd(19)} root=${String(size).padStart(6)}` +
    `${present ? '' : '  (control not present — skipped)'}${thrown.length ? `  ${thrown[0].slice(0, 80)}` : ''}`)
  await page.close()
}

await browser.close()
console.log(failures
  ? `\n${failures} check(s) failed`
  : `\nAll ${ROUTES.length} routes and ${INTERACTIONS.length} interaction(s) passed`)
process.exit(failures ? 1 : 0)
