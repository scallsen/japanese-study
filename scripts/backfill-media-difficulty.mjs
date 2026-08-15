#!/usr/bin/env node
/**
 * One-off backfill: populates `media.cover_url`/`difficulty`/`original_title`/
 * `description`/`tags`/`links`/`relationships` for shows linked before those
 * columns existed. Going forward, anime-media-select (and
 * import-anime-vocab.mjs's linkMedia) capture and refresh these fields
 * automatically on every select/reopen — this script only needs to run once
 * (or again after adding a new column here) to catch up already-tracked shows.
 *
 * Run: node --env-file=.env scripts/backfill-media-difficulty.mjs
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *   JITEN_API_KEY (optional — anonymous calls work, just share a lower rate-limit bucket)
 */

import { createClient } from '@supabase/supabase-js'
import { fetchMediaSummary } from '../src/modules/anime-vocab/providers/jitenClient.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const JITEN_API_KEY = process.env.JITEN_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const { data: rows, error } = await supabase
    .from('media').select('id, title')
    .or('cover_url.is.null,difficulty.is.null,description.is.null,tags.is.null,links.is.null,relationships.is.null')
  if (error) throw error

  console.log(`${rows.length} media row(s) missing cover_url/difficulty/description/tags/links/relationships.`)

  let updated = 0
  for (const row of rows) {
    const { data: ref, error: refErr } = await supabase
      .from('media_provider_ref').select('external_id').eq('media_id', row.id).eq('provider', 'jiten').maybeSingle()
    if (refErr) throw refErr
    if (!ref) {
      console.warn(`  Skipping "${row.title}" (${row.id}) — no jiten provider ref.`)
      continue
    }

    try {
      const { coverUrl, difficulty, originalTitle, description, tags, links, relationships } =
        await fetchMediaSummary(ref.external_id, { apiKey: JITEN_API_KEY })
      const { error: updateErr } = await supabase.from('media').update({
        cover_url: coverUrl, difficulty, original_title: originalTitle, description, tags, links, relationships,
      }).eq('id', row.id)
      if (updateErr) throw updateErr
      console.log(`  Updated "${row.title}" — difficulty ${difficulty.difficulty} (raw ${difficulty.difficultyRaw})`)
      updated++
    } catch (err) {
      console.warn(`  Failed "${row.title}" (${row.id}): ${err.message}`)
    }

    await sleep(400)
  }

  console.log(`\nDone. Updated ${updated}/${rows.length}.`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
