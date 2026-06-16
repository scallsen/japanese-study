/**
 * Uses Claude to generate prerequisite dependencies for each grammar point
 * in grammar-list.json, producing grammar-deps.json.
 *
 * Usage:
 *   node --env-file=.env scripts/generate-grammar-deps.mjs
 *
 * Env vars required:
 *   ANTHROPIC_API_KEY
 *
 * Output: grammar-deps.json — array of { term, level, prereqs[] }
 */

import { readFileSync, writeFileSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1) }

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const grammarList = JSON.parse(readFileSync('grammar-list.json', 'utf-8'))
const terms = grammarList.map(e => e.term)

console.log(`Loaded ${grammarList.length} grammar entries`)
console.log('Sending to Claude sonnet-4-6...')

const listForPrompt = grammarList.map(e =>
  `- ${e.term} [${e.level}]: ${e.description}`
).join('\n')

const message = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 8192,
  messages: [{
    role: 'user',
    content: `You are a Japanese grammar expert. Below is a list of Japanese grammar points from the Dictionary of Japanese Grammar (DOJG), tagged as basic or intermediate level.

Your task: for each grammar point, list its direct prerequisites — other grammar points from this same list that a learner must understand before this one makes sense. Only list prerequisites that appear in the provided list. Keep prerequisites minimal and direct (immediate dependencies only, not transitive ones).

Rules:
- Only reference terms that exist exactly in the list below
- A grammar point can have zero prerequisites (foundational)
- Prefer fewer prereqs over more — only include what is genuinely required
- Basic items should only depend on other basic items
- Intermediate items may depend on basic or intermediate items

Return a JSON array only, no prose. Each entry: { "term": "...", "prereqs": ["...", "..."] }

Grammar points:
${listForPrompt}`,
  }],
})

const raw = message.content[0].text.trim()

// Strip markdown code fences if present
const jsonText = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

let deps
try {
  deps = JSON.parse(jsonText)
} catch (e) {
  console.error('Failed to parse Claude response as JSON')
  console.error(raw.slice(0, 500))
  process.exit(1)
}

// Validate: filter out any prereqs that aren't in our term list
const termSet = new Set(terms)
let invalidCount = 0
deps = deps.map(entry => {
  const validPrereqs = (entry.prereqs ?? []).filter(p => {
    if (!termSet.has(p)) { invalidCount++; return false }
    return true
  })
  return { ...entry, prereqs: validPrereqs }
})

// Merge level back in from grammar-list
const levelMap = Object.fromEntries(grammarList.map(e => [e.term, e.level]))
deps = deps.map(e => ({ term: e.term, level: levelMap[e.term] ?? null, prereqs: e.prereqs }))

// Report
const withPrereqs = deps.filter(e => e.prereqs.length > 0)
const roots = deps.filter(e => e.prereqs.length === 0)
console.log(`\nDependency graph:`)
console.log(`  ${roots.length} root nodes (no prerequisites)`)
console.log(`  ${withPrereqs.length} nodes with prerequisites`)
if (invalidCount > 0) console.log(`  ${invalidCount} invalid prereq references removed`)

writeFileSync('grammar-deps.json', JSON.stringify(deps, null, 2))
console.log(`\nSaved to grammar-deps.json`)

// Preview a sample
console.log('\nSample with dependencies:')
withPrereqs.slice(0, 8).forEach(e => {
  console.log(`  ${e.term} → [${e.prereqs.join(', ')}]`)
})
