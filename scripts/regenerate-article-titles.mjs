#!/usr/bin/env node
/**
 * One-off: regenerates `title` (N4-level, pairs with body_ja) and
 * `title_simple` (N5-level, pairs with body_simple) for current-pipeline
 * articles written before headlines were level-matched — those carry the
 * real news headline verbatim, which is usually far above the body's level.
 * Legacy sources are skipped since purge-legacy-articles.mjs removes them.
 *
 * Dry run by default — prints the headlines it would write. Pass --confirm
 * to write. Add --all to redo articles that already have a title_simple.
 *
 * Run: node --env-file=.env scripts/regenerate-article-titles.mjs [--confirm] [--all]
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *   ANTHROPIC_API_KEY
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const CONFIRM = process.argv.includes('--confirm')
const ALL = process.argv.includes('--all')
const MODEL = 'claude-haiku-4-5-20251001'

const TITLES_SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' }, title_simple: { type: 'string' } },
  required: ['title', 'title_simple'],
  additionalProperties: false,
}

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

async function generateTitles(article) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `You are creating content for a Japanese study app. Write two Japanese headlines for the article below, matching the reading level of each version.

Original headline: ${article.title}
English headline: ${article.title_en ?? ''}

Intermediate article (N4 level):
${article.body_ja}

Simplified article (N5 level):
${article.body_simple ?? '(none)'}

Fields to produce:
- title: a headline for the intermediate article at N4 level — keep the meaning of the original headline but use vocabulary and kanji an N4 learner can read. Headline style: under 30 characters, plain/dictionary form or noun ending, no です/ます
- title_simple: a headline for the simplified article at N5 level — under 20 characters, plainer words, only very common kanji. Same headline style, no です/ます

Plain Japanese text only, no furigana.`,
    }],
    output_config: { format: { type: 'json_schema', schema: TITLES_SCHEMA } },
  })
  if (message.stop_reason === 'refusal') throw new Error('Refused')
  const textBlock = message.content.find(b => b.type === 'text')
  if (!textBlock) throw new Error('No JSON in response')
  return JSON.parse(textBlock.text)
}

async function main() {
  let q = supabase
    .from('articles')
    .select('id, slug, title, title_en, body_ja, body_simple')
    .eq('source', 'news')
    .order('published_at', { ascending: false })
  if (!ALL) q = q.is('title_simple', null)
  const { data, error } = await q
  if (error) throw new Error(`Supabase select failed: ${error.message}`)

  if (data.length === 0) {
    console.log('No articles to regenerate. Nothing to do.')
    return
  }
  console.log(`Found ${data.length} article(s).${CONFIRM ? '' : ' Dry run — pass --confirm to write.'}`)

  let written = 0
  for (const article of data) {
    let titles
    try {
      titles = await generateTitles(article)
    } catch (err) {
      console.error(`  ✗ ${article.slug}: ${err.message}`)
      continue
    }
    console.log(`  ${article.slug}\n    was:    ${article.title}\n    N4:     ${titles.title}\n    N5:     ${titles.title_simple}`)
    if (!CONFIRM) continue
    const { error: upError } = await supabase
      .from('articles')
      .update({ title: titles.title, title_simple: titles.title_simple })
      .eq('id', article.id)
    if (upError) console.error(`  ✗ ${article.slug}: update failed: ${upError.message}`)
    else written++
  }
  if (CONFIRM) console.log(`\nUpdated ${written}/${data.length} article(s).`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
