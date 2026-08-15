#!/usr/bin/env node
/**
 * Looks up an anime on Jiten.moe (https://jiten.moe, API source:
 * github.com/Sirush/Jiten), links it into the `media`/`media_provider_ref`
 * tables, upserts its episode list into `media_episode`, and (optionally)
 * syncs one or more episodes' vocabulary into `media_vocab_occurrence`,
 * resolving each word to a `dictionary.id` (JMdict) via
 * src/modules/anime-vocab/providers/resolveJmdictIds.js — never dropping an
 * unresolved word, just leaving jmdict_id null with its raw surface form.
 *
 * This script exists for manual/bulk seeding and local testing of the
 * provider adapter. The app's normal path is on-demand sync from
 * supabase/functions/anime-episode-vocab-sync on a user's first view of an
 * episode (see CLAUDE.md's Anime Vocab section) — this script duplicates
 * that sync step so it can be run and inspected without deploying anything.
 *
 * Usage:
 *   node --env-file=.env scripts/import-anime-vocab.mjs search "<title>"
 *   node --env-file=.env scripts/import-anime-vocab.mjs link <jitenDeckId>
 *     — creates/links the media + episode list only, no vocab sync
 *   node --env-file=.env scripts/import-anime-vocab.mjs sync <jitenDeckId> <episodeStart> [episodeEnd]
 *     — links (if needed) + syncs vocabulary for the given episode range
 *       (inclusive, 1-based, matching media_episode.episode_number)
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *   JITEN_API_KEY (optional — anonymous calls work, just share a lower rate-limit bucket)
 *
 * Before running for the first time, create the tables in the Supabase SQL editor:
 * (if `media` already exists from before cover_url/difficulty were added, run
 * `ALTER TABLE media ADD COLUMN cover_url text; ALTER TABLE media ADD COLUMN
 * difficulty jsonb;` instead — no new grants needed, they're table-level. If
 * `media` predates original_title/description/tags/links/relationships, run
 * `ALTER TABLE media ADD COLUMN original_title text; ALTER TABLE media ADD
 * COLUMN description text; ALTER TABLE media ADD COLUMN tags jsonb; ALTER
 * TABLE media ADD COLUMN links jsonb; ALTER TABLE media ADD COLUMN
 * relationships jsonb;` — then run scripts/backfill-media-difficulty.mjs to
 * populate them for shows linked before this migration.)
 *
 *   CREATE TABLE IF NOT EXISTS media (
 *     id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     title         text NOT NULL,
 *     media_type    text NOT NULL,
 *     internal_key  text UNIQUE,
 *     cover_url     text,      -- Jiten's mainDeck.coverName, captured/refreshed
 *                               -- on link and on every re-select of an
 *                               -- already-linked show (see anime-media-select)
 *     difficulty    jsonb,     -- show-level version of media_episode.difficulty:
 *                               -- { difficulty, difficultyRaw, difficultyAlgorithmic,
 *                               --   coverage, uniqueCoverage, externalRating }
 *     original_title text,     -- Jiten's mainDeck.originalTitle (the Japanese
 *                               -- name) — shown alongside `title` when the two differ
 *     description   text,      -- synopsis (Jiten mainDeck.description)
 *     tags          jsonb,     -- [{name, percentage}] — Jiten's own community tags.
 *                               -- mainDeck.genres (bare numeric ids) is deliberately
 *                               -- not captured — no public id->name lookup exists
 *                               -- (probed live: every /api/genre* candidate 404s)
 *     links         jsonb,     -- [{linkType, url}] — external site links
 *                               -- (confirmed: linkType 4 = AniList, 5 = MyAnimeList)
 *     relationships jsonb,     -- [{externalId, title, mediaType}] — related decks,
 *                               -- e.g. the manga <-> anime version of the same show
 *     created_at    timestamptz NOT NULL DEFAULT now()
 *   );
 *
 *   CREATE TABLE IF NOT EXISTS media_provider_ref (
 *     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     media_id    uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
 *     provider    text NOT NULL,
 *     external_id text NOT NULL,
 *     UNIQUE (provider, external_id)
 *   );
 *   CREATE INDEX IF NOT EXISTS media_provider_ref_media_id_idx ON media_provider_ref(media_id);
 *
 *   -- Episodes = Jiten child "decks". episode_number is the provider's own
 *   -- ordering (subDecks array order, confirmed live to match "Episode N"
 *   -- titles and deckOrder); provider_deck_id is stored verbatim so re-sync
 *   -- never depends on the numbering assumption holding.
 *   CREATE TABLE IF NOT EXISTS media_episode (
 *     id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     media_id          uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
 *     provider          text NOT NULL,
 *     provider_deck_id  text NOT NULL,
 *     episode_number    int,
 *     title             text,
 *     word_count        int,
 *     unique_word_count int,
 *     difficulty        jsonb,
 *     synced_at         timestamptz,
 *     created_at        timestamptz NOT NULL DEFAULT now(),
 *     UNIQUE (provider, provider_deck_id)
 *   );
 *   CREATE INDEX IF NOT EXISTS media_episode_media_id_idx ON media_episode(media_id);
 *
 *   -- provider_word_id (Jiten's own wordId) is the real natural key, not
 *   -- surface_form — distinct words can share the same displayed surface text
 *   -- (homographs, or two unresolved words both falling back to the same
 *   -- string), which broke ON CONFLICT when surface_form was the constraint
 *   -- (confirmed live: "ON CONFLICT DO UPDATE command cannot affect row a
 *   -- second time" when a batch contained two such rows).
 *   CREATE TABLE IF NOT EXISTS media_vocab_occurrence (
 *     id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     media_episode_id   uuid NOT NULL REFERENCES media_episode(id) ON DELETE CASCADE,
 *     provider           text NOT NULL,
 *     provider_word_id   text NOT NULL,
 *     jmdict_id          text REFERENCES dictionary(id),
 *     surface_form       text,
 *     occurrence_count   int,
 *     frequency_rank     int,
 *     global_frequency_rank int, -- Jiten's mainReading.frequencyRank: this
 *                                -- word's rank across ALL of Jiten's indexed
 *                                -- media (rank 1 = most common word in
 *                                -- Japanese overall), distinct from
 *                                -- frequency_rank above which is only this
 *                                -- episode's ordering. Powers the "exclude
 *                                -- very common words" filter — per-episode
 *                                -- frequency alone tends to surface generic
 *                                -- filler (これ/それ/ぼく/ため) because
 *                                -- function-word-adjacent vocab is always
 *                                -- the most frequent in any dialogue-heavy
 *                                -- episode (Zipf's law).
 *     is_grammar         boolean NOT NULL DEFAULT false,
 *     is_name            boolean NOT NULL DEFAULT false,
 *     raw                jsonb,
 *     created_at         timestamptz NOT NULL DEFAULT now(),
 *     UNIQUE (media_episode_id, provider, provider_word_id)
 *   );
 *   CREATE INDEX IF NOT EXISTS media_vocab_occurrence_episode_idx ON media_vocab_occurrence(media_episode_id);
 *   CREATE INDEX IF NOT EXISTS media_vocab_occurrence_jmdict_idx ON media_vocab_occurrence(jmdict_id);
 *
 *   ALTER TABLE media ENABLE ROW LEVEL SECURITY;
 *   ALTER TABLE media_provider_ref ENABLE ROW LEVEL SECURITY;
 *   ALTER TABLE media_episode ENABLE ROW LEVEL SECURITY;
 *   ALTER TABLE media_vocab_occurrence ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "public read" ON media FOR SELECT USING (true);
 *   CREATE POLICY "public read" ON media_provider_ref FOR SELECT USING (true);
 *   CREATE POLICY "public read" ON media_episode FOR SELECT USING (true);
 *   CREATE POLICY "public read" ON media_vocab_occurrence FOR SELECT USING (true);
 *   -- Writes are service-role only (this script / edge functions) — no insert
 *   -- policy needed for anon/authenticated, mirroring `dictionary`/`sentences`.
 *
 *   -- RLS policies control row visibility, not table-level access — Supabase
 *   -- doesn't grant anon/authenticated/service_role anything on a new table by
 *   -- default, unlike `dictionary`/`sentences`/`kanji` which all have this:
 *   GRANT SELECT ON media TO anon, authenticated;
 *   GRANT SELECT ON media_provider_ref TO anon, authenticated;
 *   GRANT SELECT ON media_episode TO anon, authenticated;
 *   GRANT SELECT ON media_vocab_occurrence TO anon, authenticated;
 *   GRANT ALL ON media TO service_role;
 *   GRANT ALL ON media_provider_ref TO service_role;
 *   GRANT ALL ON media_episode TO service_role;
 *   GRANT ALL ON media_vocab_occurrence TO service_role;
 */

import { createClient } from '@supabase/supabase-js'
import { searchMedia, fetchEpisodeList, fetchVocabList } from '../src/modules/anime-vocab/providers/jitenClient.js'
import { classifyPos } from '../src/modules/anime-vocab/providers/wordClassification.js'
import { resolveJmdictIds } from '../src/modules/anime-vocab/providers/resolveJmdictIds.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const JITEN_API_KEY = process.env.JITEN_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const PROVIDER = 'jiten'
const VOCAB_INSERT_BATCH = 500
const EPISODE_SYNC_DELAY_MS = 6500 // ~10 req/min heavy-endpoint budget

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function linkMedia(jitenDeckId) {
  const { title, mediaType, coverUrl, difficulty, originalTitle, description, tags, links, relationships, episodes } =
    await fetchEpisodeList(jitenDeckId, { apiKey: JITEN_API_KEY })
  if (!title) throw new Error(`No media found for Jiten deck ${jitenDeckId}`)
  const metaColumns = { original_title: originalTitle, description, tags, links, relationships }

  const { data: existingRef } = await supabase
    .from('media_provider_ref').select('media_id').eq('provider', PROVIDER).eq('external_id', String(jitenDeckId)).maybeSingle()

  let mediaId = existingRef?.media_id
  if (!mediaId) {
    const { data: mediaRow, error: mediaErr } = await supabase
      .from('media').insert({ title, media_type: mediaType, cover_url: coverUrl, difficulty, ...metaColumns }).select('id').single()
    if (mediaErr) throw mediaErr
    mediaId = mediaRow.id
    const { error: refErr } = await supabase
      .from('media_provider_ref').insert({ media_id: mediaId, provider: PROVIDER, external_id: String(jitenDeckId) })
    if (refErr) throw refErr
    console.log(`Created media "${title}" (${mediaId})`)
  } else {
    // Refresh on every reopen — see anime-media-select's identical comment.
    const { error: updateErr } = await supabase.from('media').update({ cover_url: coverUrl, difficulty, ...metaColumns }).eq('id', mediaId)
    if (updateErr) throw updateErr
    console.log(`Media already linked: "${title}" (${mediaId})`)
  }

  const episodeRows = episodes.map(ep => ({
    media_id: mediaId,
    provider: PROVIDER,
    provider_deck_id: ep.externalId,
    episode_number: ep.episodeNumber,
    title: ep.title,
    word_count: ep.wordCount,
    unique_word_count: ep.uniqueWordCount,
    difficulty: ep.difficulty,
  }))
  const { error: upsertErr } = await supabase
    .from('media_episode').upsert(episodeRows, { onConflict: 'provider,provider_deck_id', ignoreDuplicates: false })
  if (upsertErr) throw upsertErr
  console.log(`Upserted ${episodeRows.length} episodes.`)

  return { mediaId, episodes }
}

async function syncEpisodeVocab(mediaEpisodeRow) {
  console.log(`Syncing episode ${mediaEpisodeRow.episode_number} (deck ${mediaEpisodeRow.provider_deck_id})...`)
  const words = await fetchVocabList(mediaEpisodeRow.provider_deck_id, { apiKey: JITEN_API_KEY })
  console.log(`  Fetched ${words.length} words, resolving jmdictIds...`)
  const resolved = await resolveJmdictIds(supabase, words)

  const rows = words.map((w, i) => {
    const { jmdictId, surfaceForm } = resolved.get(w.wordId) ?? {}
    const { isGrammar, isName } = classifyPos(w.partsOfSpeech)
    return {
      media_episode_id: mediaEpisodeRow.id,
      provider: PROVIDER,
      provider_word_id: String(w.wordId),
      jmdict_id: jmdictId ?? null,
      surface_form: surfaceForm ?? w.mainReading?.text ?? `unknown-${w.wordId}`,
      occurrence_count: w.occurrences ?? null,
      frequency_rank: i, // deckFreq sort order — lower is more central to this episode
      global_frequency_rank: w.mainReading?.frequencyRank ?? null,
      is_grammar: isGrammar,
      is_name: isName,
      raw: w,
    }
  })

  const matched = rows.filter(r => r.jmdict_id).length
  console.log(`  Resolved ${matched}/${rows.length} words to a dictionary entry.`)

  for (let i = 0; i < rows.length; i += VOCAB_INSERT_BATCH) {
    const batch = rows.slice(i, i + VOCAB_INSERT_BATCH)
    const { error } = await supabase
      .from('media_vocab_occurrence').upsert(batch, { onConflict: 'media_episode_id,provider,provider_word_id' })
    if (error) throw error
  }

  const { error: touchErr } = await supabase
    .from('media_episode').update({ synced_at: new Date().toISOString() }).eq('id', mediaEpisodeRow.id)
  if (touchErr) throw touchErr
  console.log(`  Done.`)
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)

  if (cmd === 'search') {
    const query = rest.join(' ')
    if (!query) throw new Error('Usage: search "<title>"')
    const results = await searchMedia(query, { apiKey: JITEN_API_KEY })
    console.log(`${results.length} results for "${query}":\n`)
    for (const r of results) console.log(`  ${r.externalId}\t[${r.mediaType}]\t${r.title}${r.originalTitle && r.originalTitle !== r.title ? ` (${r.originalTitle})` : ''}`)
    return
  }

  if (cmd === 'link') {
    const [jitenDeckId] = rest
    if (!jitenDeckId) throw new Error('Usage: link <jitenDeckId>')
    await linkMedia(jitenDeckId)
    return
  }

  if (cmd === 'sync') {
    const [jitenDeckId, startStr, endStr] = rest
    if (!jitenDeckId || !startStr) throw new Error('Usage: sync <jitenDeckId> <episodeStart> [episodeEnd]')
    const start = Number(startStr)
    const end = endStr ? Number(endStr) : start

    const { mediaId } = await linkMedia(jitenDeckId)
    const { data: episodeRows, error } = await supabase
      .from('media_episode').select('*').eq('media_id', mediaId)
      .gte('episode_number', start).lte('episode_number', end).order('episode_number')
    if (error) throw error

    for (let i = 0; i < episodeRows.length; i++) {
      await syncEpisodeVocab(episodeRows[i])
      if (i < episodeRows.length - 1) await sleep(EPISODE_SYNC_DELAY_MS)
    }
    return
  }

  console.log('Usage:\n  search "<title>"\n  link <jitenDeckId>\n  sync <jitenDeckId> <episodeStart> [episodeEnd]')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
