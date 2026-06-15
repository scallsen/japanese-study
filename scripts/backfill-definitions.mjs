#!/usr/bin/env node
/**
 * Backfills vocabulary_ja and tokens for all existing articles.
 * Re-tokenizes body_ja/body_simple with Kuromoji, then calls Claude Haiku
 * to generate English definitions for every unique content word.
 *
 * Run once: node --env-file=.env scripts/backfill-definitions.mjs
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import kuromoji from 'kuromoji'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const PARTICLE_POS = new Set(['助詞', '助動詞', '記号', 'BOS/EOS'])

function buildTokenizerInstance() {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err, t) => {
      err ? reject(err) : resolve(t)
    })
  })
}

function katakanaToHiragana(str) {
  return (str ?? '').replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

function tokenizeText(tokenizerInstance, text) {
  return tokenizerInstance.tokenize(text).map(tok => {
    const isContent = !PARTICLE_POS.has(tok.pos) && tok.surface_form.trim().length > 0
    const reading = tok.reading && tok.reading !== tok.surface_form
      ? katakanaToHiragana(tok.reading)
      : null
    return { t: tok.surface_form, r: reading, w: isContent }
  })
}

async function generateDefinitions(words) {
  if (words.length === 0) return {}
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Give concise English definitions for these Japanese words. Return raw JSON only — an array: [{"word":"...","meaning":"..."}, ...]. One entry per input word. Meanings should be 1-5 words.

Words: ${words.join('、')}`,
    }],
  })
  const raw = message.content[0].text.trim()
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start === -1 || end === -1) return {}
  const arr = JSON.parse(raw.slice(start, end + 1))
  const map = {}
  for (const entry of arr) {
    if (entry.word && entry.meaning) map[entry.word] = entry.meaning
  }
  return map
}

async function main() {
  console.log('Building Kuromoji tokenizer...')
  const tokenizer = await buildTokenizerInstance()
  console.log('Tokenizer ready.')

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, slug, body_ja, body_simple')
    .eq('active', true)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch articles:', error.message)
    process.exit(1)
  }

  console.log(`Found ${articles.length} articles to backfill.\n`)

  for (const article of articles) {
    console.log(`Processing: ${article.slug}`)

    const tokensJa = article.body_ja ? tokenizeText(tokenizer, article.body_ja) : null
    const tokensSimple = article.body_simple ? tokenizeText(tokenizer, article.body_simple) : null

    const wordReadings = new Map()
    for (const tok of [...(tokensJa ?? []), ...(tokensSimple ?? [])]) {
      if (tok.w && !wordReadings.has(tok.t)) wordReadings.set(tok.t, tok.r ?? null)
    }

    let vocabularyJa = null
    if (wordReadings.size > 0) {
      console.log(`  ${wordReadings.size} unique content words — fetching definitions...`)
      const definitionsMap = await generateDefinitions([...wordReadings.keys()])
      vocabularyJa = [...wordReadings.entries()].map(([word, reading]) => ({
        word,
        reading,
        meaning: definitionsMap[word] ?? null,
      })).filter(e => e.meaning)
      console.log(`  Got definitions for ${vocabularyJa.length}/${wordReadings.size} words.`)
    }

    const { error: updateError } = await supabase
      .from('articles')
      .update({ tokens_ja: tokensJa, tokens_simple: tokensSimple, vocabulary_ja: vocabularyJa })
      .eq('id', article.id)

    if (updateError) {
      console.warn(`  Update failed: ${updateError.message}`)
    } else {
      console.log(`  Done.`)
    }
  }

  console.log('\nBackfill complete.')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
