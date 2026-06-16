/**
 * Extracts JLPT grammar entries from the DOJG Yomichan dictionary.
 * Source: https://github.com/aiko-tanaka/Grammar-Dictionaries
 *
 * Usage:
 *   node scripts/extract-dojg-grammar.mjs [--level basic|intermediate|all]
 *
 * Output: grammar-list.json in the project root
 */

import { writeFileSync } from 'fs'

const LEVELS = {
  '基本': 'basic',
  '中級編': 'intermediate',
  '上級編': 'advanced',
}

const SOURCE_URL = 'https://raw.githubusercontent.com/aiko-tanaka/Grammar-Dictionaries/main/dojg/term_bank_1.json'

const levelArg = process.argv[2] === '--level' ? process.argv[3] : 'basic'
const includeLevels = levelArg === 'all'
  ? ['basic', 'intermediate', 'advanced']
  : levelArg === 'intermediate'
  ? ['basic', 'intermediate']
  : ['basic']

console.log(`Fetching DOJG dictionary...`)
const res = await fetch(SOURCE_URL)
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
const entries = await res.json()
console.log(`Loaded ${entries.length} entries`)

function parseBlob(text) {
  const get = (tag) => {
    const match = text.match(new RegExp(`\\[${tag}\\]\\s*\\n([^\\[]+)`))
    return match ? match[1].trim() : null
  }

  // Level from header line: "文法項目 | term | 基本"
  const levelMatch = text.match(/文法項目\s*\|\s*.+?\s*\|\s*(\S+)/)
  const levelJa = levelMatch ? levelMatch[1] : null
  const level = LEVELS[levelJa] ?? null

  const description = get('解説')  // one-sentence English description
  const meaning = get('意味')       // short English gloss

  // First key sentence example (English half of 例文A)
  const exampleMatch = text.match(/\[例文A\]\s*\n.*?\n([^\n]+\.)/)
  const example = exampleMatch ? exampleMatch[1].trim() : null

  return { level, description, meaning, example }
}

const seen = new Set()
const results = []

for (const entry of entries) {
  const term = entry[0]
  const text = entry[5]?.[0] ?? ''

  // Skip duplicates (same term appears multiple times for variant forms)
  if (seen.has(term)) continue
  seen.add(term)

  const { level, description, meaning, example } = parseBlob(text)
  if (!level || !includeLevels.includes(level)) continue
  if (!description && !meaning) continue

  results.push({
    id: term.replace(/[〜～]/g, '').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9　-鿿゠-ヿ぀-ゟ-]/g, ''),
    term,
    level,
    description: description ?? meaning,
    meaning: meaning ?? null,
    example: example ?? null,
  })
}

results.sort((a, b) => {
  const order = ['basic', 'intermediate', 'advanced']
  return order.indexOf(a.level) - order.indexOf(b.level) || a.term.localeCompare(b.term)
})

const outPath = 'grammar-list.json'
writeFileSync(outPath, JSON.stringify(results, null, 2))

console.log(`\nExtracted ${results.length} entries (${includeLevels.join(', ')})`)
console.log(`Saved to ${outPath}`)

// Print a sample
console.log('\nSample entries:')
results.slice(0, 5).forEach(e => {
  console.log(`  [${e.level}] ${e.term} — ${e.description?.slice(0, 70)}`)
})
