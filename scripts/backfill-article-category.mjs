#!/usr/bin/env node
/**
 * One-off backfill: assigns a `category` to articles generated before the
 * column existed. Only touches rows from the current pipeline (source:
 * 'news') that have no category — legacy Yahoo/NHK/Tadoku rows are left
 * alone since purge-legacy-articles.mjs deletes them anyway.
 *
 * Dry run by default — prints the category it would assign. Pass --confirm
 * to write.
 *
 * Run: node --env-file=.env scripts/backfill-article-category.mjs [--confirm]
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

// Must stay in sync with ARTICLE_CATEGORIES in fetch-nhk.mjs and CATEGORIES
// in src/modules/immersion/categories.js.
const ARTICLE_CATEGORIES = ['politics', 'business', 'sports', 'culture', 'technology', 'science', 'society', 'world']
const MODEL = 'claude-haiku-4-5-20251001'

const CATEGORY_SCHEMA = {
  type: 'object',
  properties: { category: { type: 'string', enum: ARTICLE_CATEGORIES } },
  required: ['category'],
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

async function classify(article) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 64,
    messages: [{
      role: 'user',
      content: `Assign the single best-fitting category to this Japanese news article.

Categories: ${ARTICLE_CATEGORIES.join(', ')}

Headline: ${article.title}
English headline: ${article.title_en ?? ''}
Summary: ${article.summary_en ?? ''}`,
    }],
    output_config: { format: { type: 'json_schema', schema: CATEGORY_SCHEMA } },
  })
  const textBlock = message.content.find(b => b.type === 'text')
  if (!textBlock) throw new Error('No JSON in classification response')
  return JSON.parse(textBlock.text).category
}

async function main() {
  const { data, error } = await supabase
    .from('articles')
    .select('id, slug, title, title_en, summary_en')
    .eq('source', 'news')
    .is('category', null)
    .order('published_at', { ascending: false })
  if (error) throw new Error(`Supabase select failed: ${error.message}`)

  if (data.length === 0) {
    console.log('No uncategorized articles from the current pipeline. Nothing to do.')
    return
  }
  console.log(`Found ${data.length} uncategorized article(s).${CONFIRM ? '' : ' Dry run — pass --confirm to write.'}`)

  let written = 0
  for (const article of data) {
    let category
    try {
      category = await classify(article)
    } catch (err) {
      console.error(`  ✗ ${article.slug}: ${err.message}`)
      continue
    }
    console.log(`  [${category}] ${article.slug} — ${article.title_en ?? article.title}`)
    if (!CONFIRM) continue
    const { error: upError } = await supabase.from('articles').update({ category }).eq('id', article.id)
    if (upError) console.error(`  ✗ ${article.slug}: update failed: ${upError.message}`)
    else written++
  }
  if (CONFIRM) console.log(`\nUpdated ${written}/${data.length} article(s).`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
