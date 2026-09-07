#!/usr/bin/env node
/**
 * One-off cleanup: deletes articles predating the current AI-aggregated news
 * pipeline (fetch-nhk.mjs, source: 'news') — the old Yahoo RSS / NHK Easy /
 * Tadoku sourced rows from before PR #78 switched discovery to web search.
 * Those articles were pushed out of the reader's top-10 view but never
 * deleted (see "Article retention" in CLAUDE.md — there is no cleanup job),
 * so they'd resurface once the reader grows a "browse older articles" view.
 *
 * Dry run by default — prints what would be deleted. Pass --confirm to
 * actually delete.
 *
 * Run manually: node --env-file=.env scripts/purge-legacy-articles.mjs [--confirm]
 * Or via the "Purge Legacy Articles" workflow (workflow_dispatch, confirm input).
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const CONFIRM = process.argv.includes('--confirm') || process.env.CONFIRM === 'true'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  // Current pipeline always writes source: 'news'. Anything else (or no
  // source at all) predates it.
  const { data, error } = await supabase
    .from('articles')
    .select('id, slug, source, title, published_at')
    .or('source.neq.news,source.is.null')
    .order('published_at', { ascending: false })

  if (error) throw new Error(`Supabase select failed: ${error.message}`)

  if (data.length === 0) {
    console.log('No legacy articles found. Nothing to do.')
    return
  }

  console.log(`Found ${data.length} legacy article(s):`)
  for (const row of data) {
    console.log(`  [${row.source ?? 'null'}] ${row.slug} — ${row.title} (${row.published_at})`)
  }

  if (!CONFIRM) {
    console.log('\nDry run only — pass --confirm to actually delete these rows.')
    return
  }

  const ids = data.map(r => r.id)
  const { error: delError } = await supabase.from('articles').delete().in('id', ids)
  if (delError) throw new Error(`Supabase delete failed: ${delError.message}`)

  console.log(`\nDeleted ${ids.length} legacy article(s).`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
