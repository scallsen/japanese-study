import { createClient } from 'npm:@supabase/supabase-js@2'

// Links a Jiten media-deck result the user picked (via anime-media-browse)
// into `media`/`media_provider_ref`, and upserts its episode list into
// `media_episode`. No vocabulary sync here — that's the separate, heavier
// anime-episode-vocab-sync function, gated behind a user opening a specific
// episode. Duplicated fetch/upsert logic from scripts/import-anime-vocab.mjs's
// `linkMedia` — kept in sync manually, see anime-media-browse for why.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
const JITEN_API_KEY = Deno.env.get('JITEN_API_KEY')
const PROVIDER = 'jiten'

const MEDIA_TYPE_LABELS: Record<number, string> = {
  1: 'Anime', 2: 'Drama', 3: 'Movie', 4: 'Novel', 5: 'Non-fiction',
  6: 'Video game', 7: 'Visual novel', 8: 'Web novel', 9: 'Manga', 10: 'Audio',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

// Show-detail-only fields — see jitenClient.js's identical deckMeta for why
// genres are excluded and why this is only pulled at select/backfill time.
function deckMeta(deck: any) {
  return {
    originalTitle: deck?.originalTitle,
    description: deck?.description,
    tags: (deck?.tags ?? []).map((t: any) => ({ name: t.name, percentage: t.percentage })),
    links: (deck?.links ?? []).map((l: any) => ({ linkType: l.linkType, url: l.url })),
    relationships: (deck?.relationships ?? []).map((r: any) => ({
      externalId: String(r.targetDeckId),
      title: r.targetDeck?.englishTitle || r.targetDeck?.romajiTitle || r.targetDeck?.originalTitle,
      mediaType: MEDIA_TYPE_LABELS[r.targetDeck?.mediaType] ?? 'Other',
    })),
  }
}

// Operator-safety floor, not a user preference — always enforced, no
// setting can bypass it. This is the backstop for titles found via text
// search: search-suggestions carries no tag/genre data at all (confirmed
// live), so anime-media-browse's maturity filtering can't apply there —
// this check is what actually prevents one from ever being linked/tracked
// through the tool regardless of how it was found. Same tag id set as
// anime-media-browse's identical HARD_BLOCK_TAG_IDS — duplicated per the
// established Node/Deno-boundary convention (see deckMeta above).
const HARD_BLOCK_TAG_IDS = new Set([173, 225, 226, 227, 228, 229, 230]) // Guro, Femdom, Incest, Netorare, Netorase, Netori, Prostitution

function isHardBlocked(deck: any) {
  return (deck?.tags ?? []).some((t: any) => HARD_BLOCK_TAG_IDS.has(t.tagId))
}

// Soft-tier enforcement — search results carry no tag/genre data at all
// (confirmed live), so anime-media-browse's maturity filtering never runs
// against them; without this, a title excluded from "Safe" browsing could
// still be selected/tracked by searching for it by name. The caller sends
// its currently-selected tiers (MediaSearch.jsx's `maturity` set); same
// classification logic as anime-media-browse's identical classifyMaturity.
const ECCHI_GENRE_ID = 5
const NUDITY_TAG_ID = 231

function classifyMaturity(deck: any) {
  const hasEcchi = (deck?.genres ?? []).includes(ECCHI_GENRE_ID)
  const hasNudity = (deck?.tags ?? []).some((t: any) => t.tagId === NUDITY_TAG_ID)
  if (hasEcchi && hasNudity) return 'suggestive'
  if (hasEcchi || hasNudity) return 'slightly-suggestive'
  return 'safe'
}

async function fetchEpisodeList(externalId: string) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (JITEN_API_KEY) headers['X-Api-Key'] = JITEN_API_KEY

  const episodes: any[] = []
  let mainDeck: any = null
  let offset = 0
  for (;;) {
    const res = await fetch(`https://api.jiten.moe/api/media-deck/${externalId}/detail?offset=${offset}`, { headers })
    if (res.status === 429) throw new Error('Jiten rate limit exceeded — try again shortly')
    if (!res.ok) throw new Error(`Jiten detail fetch failed (${res.status})`)
    const body = (await res.json()).data
    mainDeck ??= body.mainDeck
    const page = body.subDecks ?? []
    episodes.push(...page)
    if (page.length < 25) break
    offset += 25
  }
  return { mainDeck, episodes }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Server misconfigured: missing Supabase service role credentials' }, 500)
    }
    const { jitenDeckId, maturityLevels: rawMaturityLevels } = await req.json()
    if (!jitenDeckId) return jsonResponse({ error: 'jitenDeckId is required' }, 400)
    const maturityLevels = Array.isArray(rawMaturityLevels) && rawMaturityLevels.length ? rawMaturityLevels : ['safe']

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: existingRef } = await supabase
      .from('media_provider_ref').select('media_id').eq('provider', PROVIDER).eq('external_id', String(jitenDeckId)).maybeSingle()

    const { mainDeck, episodes } = await fetchEpisodeList(String(jitenDeckId))
    if (!mainDeck) return jsonResponse({ error: `No media found for Jiten deck ${jitenDeckId}` }, 404)
    // Generic message, deliberately not explaining why — see HARD_BLOCK_TAG_IDS comment.
    if (isHardBlocked(mainDeck) && !existingRef) return jsonResponse({ error: 'This title is not available.' }, 403)
    // Unlike the hard block, this is just today's filter setting, not a
    // permanent floor — explain it so the user knows to widen "Maturity"
    // if they actually want it. Skipped for already-linked media so
    // tightening the filter later doesn't retroactively break access to
    // something already being studied.
    if (!existingRef && !maturityLevels.includes(classifyMaturity(mainDeck))) {
      return jsonResponse({ error: 'This title does not match your current Maturity filter — expand it to select this title.' }, 403)
    }
    const title = mainDeck.englishTitle || mainDeck.romajiTitle || mainDeck.originalTitle
    const mediaType = MEDIA_TYPE_LABELS[mainDeck.mediaType] ?? 'Other'
    const coverUrl = mainDeck.coverName
    const difficulty = {
      difficulty: mainDeck.difficulty,
      difficultyRaw: mainDeck.difficultyRaw,
      difficultyAlgorithmic: mainDeck.difficultyAlgorithmic,
      coverage: mainDeck.coverage,
      uniqueCoverage: mainDeck.uniqueCoverage,
      externalRating: mainDeck.externalRating,
    }
    const meta = deckMeta(mainDeck)
    const metaColumns = {
      original_title: meta.originalTitle,
      description: meta.description,
      tags: meta.tags,
      links: meta.links,
      relationships: meta.relationships,
    }

    let mediaId = existingRef?.media_id
    if (!mediaId) {
      const { data: mediaRow, error: mediaErr } = await supabase
        .from('media').insert({ title, media_type: mediaType, cover_url: coverUrl, difficulty, ...metaColumns }).select('id').single()
      if (mediaErr) throw mediaErr
      mediaId = mediaRow.id
      const { error: refErr } = await supabase
        .from('media_provider_ref').insert({ media_id: mediaId, provider: PROVIDER, external_id: String(jitenDeckId) })
      if (refErr) throw refErr
    } else {
      // Refresh on every reopen, not just at link time — externalRating/
      // difficulty are community-voted and can drift, and mainDeck is
      // already fetched unconditionally above either way, so this only
      // costs one cheap update, not an extra Jiten request.
      const { error: updateErr } = await supabase.from('media').update({ cover_url: coverUrl, difficulty, ...metaColumns }).eq('id', mediaId)
      if (updateErr) throw updateErr
    }

    const episodeRows = episodes.map((ep: any, i: number) => ({
      media_id: mediaId,
      provider: PROVIDER,
      provider_deck_id: String(ep.deckId),
      episode_number: i + 1,
      title: ep.originalTitle,
      word_count: ep.wordCount,
      unique_word_count: ep.uniqueWordCount,
      difficulty: {
        difficulty: ep.difficulty,
        difficultyRaw: ep.difficultyRaw,
        difficultyAlgorithmic: ep.difficultyAlgorithmic,
        coverage: ep.coverage,
        uniqueCoverage: ep.uniqueCoverage,
        externalRating: ep.externalRating,
      },
    }))
    const { error: upsertErr } = await supabase
      .from('media_episode').upsert(episodeRows, { onConflict: 'provider,provider_deck_id', ignoreDuplicates: false })
    if (upsertErr) throw upsertErr

    const { data: savedEpisodes, error: fetchErr } = await supabase
      .from('media_episode').select('*').eq('media_id', mediaId).order('episode_number')
    if (fetchErr) throw fetchErr

    return jsonResponse({ mediaId, title, mediaType, coverUrl, difficulty, ...meta, episodes: savedEpisodes })
  } catch (err) {
    console.error('[anime-media-select]', err)
    return jsonResponse({ error: err?.message || 'Linking media failed' }, 500)
  }
})
