import { createClient } from 'npm:@supabase/supabase-js@2'

// Links a Jiten media-deck result the user picked in anime-media-search into
// `media`/`media_provider_ref`, and upserts its episode list into
// `media_episode`. No vocabulary sync here — that's the separate, heavier
// anime-episode-vocab-sync function, gated behind a user opening a specific
// episode. Duplicated fetch/upsert logic from scripts/import-anime-vocab.mjs's
// `linkMedia` — kept in sync manually, see anime-media-search for why.

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
    const { jitenDeckId } = await req.json()
    if (!jitenDeckId) return jsonResponse({ error: 'jitenDeckId is required' }, 400)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: existingRef } = await supabase
      .from('media_provider_ref').select('media_id').eq('provider', PROVIDER).eq('external_id', String(jitenDeckId)).maybeSingle()

    const { mainDeck, episodes } = await fetchEpisodeList(String(jitenDeckId))
    if (!mainDeck) return jsonResponse({ error: `No media found for Jiten deck ${jitenDeckId}` }, 404)
    const title = mainDeck.englishTitle || mainDeck.romajiTitle || mainDeck.originalTitle
    const mediaType = MEDIA_TYPE_LABELS[mainDeck.mediaType] ?? 'Other'

    let mediaId = existingRef?.media_id
    if (!mediaId) {
      const { data: mediaRow, error: mediaErr } = await supabase.from('media').insert({ title, media_type: mediaType }).select('id').single()
      if (mediaErr) throw mediaErr
      mediaId = mediaRow.id
      const { error: refErr } = await supabase
        .from('media_provider_ref').insert({ media_id: mediaId, provider: PROVIDER, external_id: String(jitenDeckId) })
      if (refErr) throw refErr
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

    return jsonResponse({ mediaId, title, mediaType, episodes: savedEpisodes })
  } catch (err) {
    console.error('[anime-media-select]', err)
    return jsonResponse({ error: err?.message || 'Linking media failed' }, 500)
  }
})
