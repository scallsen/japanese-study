/**
 * Asks Claude to classify each grammar point into one of six functional categories,
 * then writes `category` back into both grammar-list.json copies.
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-grammar-category.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import Anthropic from '@anthropic-ai/sdk'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1) }

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const grammarList = JSON.parse(readFileSync('grammar-list.json', 'utf-8'))
console.log(`Loaded ${grammarList.length} grammar entries`)

const CATEGORIES = `
Form       — Pure morphological conjugation shapes; no standalone semantic meaning. The grammar point IS the conjugated shape itself. Examples: て-form, ない-form, た-form, potential form (られる/える), passive form, causative form, volitional form (よう/おう), ば-form.

Particle   — Grammatical particles that mark grammatical roles, scope, or relationships between words/phrases. Examples: は, が, を, に, で, へ, と, から, まで, だけ, しか, など, も, さえ, こそ, より.

Auxiliary  — Patterns that attach to a conjugated form (especially て-form) to modify the aspect, directionality, or social relationship of an action. Examples: ている, てある, てしまう, ておく, てみる, てあげる, てもらう, てくれる, たい, たがる.

Modal      — Expresses the speaker's stance: certainty, probability, obligation, permission, prohibition, inference, or evidentiality. Examples: らしい, そうだ, ようだ, はずだ, わけだ, べきだ, かもしれない, なければならない, てもいい, てはいけない, ことができる, だろう, まい.

Connector  — Joins two clauses or sentences with a temporal, causal, conditional, concessive, or additive relationship. Includes clause-final conjunctions and discourse connectors. Examples: てから, ながら, まえに, あとで, から (because), ので, ために, たら, なら, ても, のに, けれども, そして, それで, しかし.

Expression — Lexicalised multi-word patterns or formal constructions that don't fit the above. Typically N2–N1, often written/formal register. Examples: において, によって, として, ことになる, に反して, に対して, というより, にもかかわらず.
`.trim()

const RULES = `
Rules:
- Assign exactly one category per term. Pick the PRIMARY function.
- If a grammar point is a conjugation form, choose Form even if it has connective uses (e.g. て-form → Form, not Connector).
- Sentence-final auxiliaries expressing the speaker's stance (です, ます register aside) lean Modal.
- です and ます are Auxiliary (they modify politeness register of the predicate).
- Adverbs that modify speaker stance (やはり, かえって, なかなか) → Modal.
- Nominalizers こと and の → Expression.
- When in doubt between Auxiliary and Modal: Auxiliary is about how/when the action happens; Modal is about the speaker's assessment of the proposition.
`.trim()

const listForPrompt = grammarList.map(e =>
  `- ${e.term}: ${e.description}`
).join('\n')

console.log('Sending to Claude for category classification...')

const message = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 8192,
  messages: [{
    role: 'user',
    content: `You are a Japanese linguistics expert. Classify each grammar point below into exactly one of these six categories:

${CATEGORIES}

${RULES}

Return a JSON array only — no prose, no markdown fences. Each entry: { "term": "...", "category": "Form" | "Particle" | "Auxiliary" | "Modal" | "Connector" | "Expression" }

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

const VALID = new Set(['Form', 'Particle', 'Auxiliary', 'Modal', 'Connector', 'Expression'])
const categoryMap = Object.fromEntries(
  classifications
    .filter(e => VALID.has(e.category))
    .map(e => [e.term, e.category])
)

const missing = grammarList.filter(e => !categoryMap[e.term]).map(e => e.term)
if (missing.length) console.warn(`No category assigned for: ${missing.join(', ')}`)

const updatedList = grammarList.map(e => ({ ...e, category: categoryMap[e.term] ?? null }))
writeFileSync('grammar-list.json', JSON.stringify(updatedList, null, 2))
writeFileSync('src/modules/grammar-map/grammar-list.json', JSON.stringify(updatedList, null, 2))

const counts = {}
updatedList.forEach(e => { counts[e.category ?? 'null'] = (counts[e.category ?? 'null'] ?? 0) + 1 })
console.log('\nCategory distribution:')
Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`))
console.log('\nSample Particles:', updatedList.filter(e => e.category === 'Particle').slice(0, 8).map(e => e.term).join(', '))
console.log('Sample Connectors:', updatedList.filter(e => e.category === 'Connector').slice(0, 8).map(e => e.term).join(', '))
