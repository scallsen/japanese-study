/**
 * Asks Claude to assign a JLPT level (N5–N1) to each grammar point in
 * grammar-list.json, then writes jlptLevel back into both JSON files.
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-grammar-jlpt.mjs
 *
 * Env vars required:
 *   ANTHROPIC_API_KEY
 */

import { readFileSync, writeFileSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1) }

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const grammarList = JSON.parse(readFileSync('grammar-list.json', 'utf-8'))
const grammarDeps = JSON.parse(readFileSync('grammar-deps.json', 'utf-8'))

console.log(`Loaded ${grammarList.length} grammar entries`)
console.log('Sending to Claude for JLPT classification...')

const listForPrompt = grammarList.map(e =>
  `- ${e.term}: ${e.description}`
).join('\n')

const message = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 8192,
  messages: [{
    role: 'user',
    content: `You are a Japanese language expert. Classify each of the following grammar points by JLPT level.

Rules:
- Use "N5", "N4", "N3", "N2", or "N1" for grammar points that appear on the JLPT
- Use null for grammar points that are real Japanese grammar but not specifically tested on the JLPT
- Be accurate — this is used to distinguish core grammar (N5/N4) from supplemental grammar

Return a JSON array only, no prose. Each entry: { "term": "...", "jlptLevel": "N5" | "N4" | "N3" | "N2" | "N1" | null }

Grammar points:
${listForPrompt}`,
  }],
})

const raw = message.content[0].text.trim()
const start = raw.indexOf('[')
const end = raw.lastIndexOf(']')
const jsonText = start !== -1 && end !== -1 ? raw.slice(start, end + 1) : raw

let classifications
try {
  classifications = JSON.parse(jsonText)
} catch (e) {
  console.error('Failed to parse Claude response as JSON')
  console.error(raw.slice(0, 500))
  process.exit(1)
}

const levelMap = Object.fromEntries(classifications.map(e => [e.term, e.jlptLevel ?? null]))

// Merge into grammar-list.json
const updatedList = grammarList.map(e => ({ ...e, jlptLevel: levelMap[e.term] ?? null }))
writeFileSync('grammar-list.json', JSON.stringify(updatedList, null, 2))
writeFileSync('src/modules/grammar-map/grammar-list.json', JSON.stringify(updatedList, null, 2))

// Merge into grammar-deps.json
const updatedDeps = grammarDeps.map(e => ({ ...e, jlptLevel: levelMap[e.term] ?? null }))
writeFileSync('grammar-deps.json', JSON.stringify(updatedDeps, null, 2))
writeFileSync('src/modules/grammar-map/grammar-deps.json', JSON.stringify(updatedDeps, null, 2))

// Report
const counts = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0, null: 0 }
updatedList.forEach(e => { counts[e.jlptLevel ?? 'null']++ })
console.log('\nJLPT level distribution:')
Object.entries(counts).forEach(([k, v]) => v > 0 && console.log(`  ${k}: ${v}`))

const core = updatedList.filter(e => e.jlptLevel === 'N5' || e.jlptLevel === 'N4')
console.log(`\nCore grammar (N5+N4): ${core.length} entries`)
console.log('\nSample N5:')
updatedList.filter(e => e.jlptLevel === 'N5').slice(0, 6).forEach(e =>
  console.log(`  ${e.term}: ${e.description?.slice(0, 60)}`)
)
