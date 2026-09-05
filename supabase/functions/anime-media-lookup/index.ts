import { createClient } from 'npm:@supabase/supabase-js@2'
import { enforceRateLimit, rateLimitErrorResponse } from '../_shared/rateLimit.ts'

// Fetches live cover/difficulty details for a fixed set of Jiten deck ids —
// used by the curated "recommended for beginners" list
// (src/modules/anime-vocab/curatedRecommendations.js), which exists because
// Jiten's raw difficulty-ascending catalog sort (anime-media-browse) just
// surfaces whatever has the single lowest difficulty score across its
// ENTIRE catalog, with no regard for whether it's actually something people
// recommend. Duplicated fetch/mapping logic from
// src/modules/anime-vocab/providers/jitenClient.js's fetchMediaSummary —
// kept in sync manually, see anime-media-browse for why.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
const JITEN_API_KEY = Deno.env.get('JITEN_API_KEY')

const MEDIA_TYPE_LABELS: Record<number, string> = {
  1: 'Anime', 2: 'Drama', 3: 'Movie', 4: 'Novel', 5: 'Non-fiction',
  6: 'Video game', 7: 'Visual novel', 8: 'Web novel', 9: 'Manga', 10: 'Audio',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

// Single-page detail fetch (no episode pagination) — this only needs
// mainDeck's own show-level fields, same as fetchMediaSummary client-side.
async function fetchSummary(externalId: string) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (JITEN_API_KEY) headers['X-Api-Key'] = JITEN_API_KEY
  const res = await fetch(`https://api.jiten.moe/api/media-deck/${externalId}/detail?offset=0`, { headers })
  if (!res.ok) return null // skip a title that's been removed/renamed rather than failing the whole batch
  const body = await res.json()
  const mainDeck = body.data?.mainDeck
  if (!mainDeck) return null
  return {
    externalId,
    title: mainDeck.englishTitle || mainDeck.romajiTitle || mainDeck.originalTitle,
    originalTitle: mainDeck.originalTitle,
    mediaType: MEDIA_TYPE_LABELS[mainDeck.mediaType] ?? 'Other',
    coverUrl: mainDeck.coverName,
    difficulty: {
      difficulty: mainDeck.difficulty,
      difficultyRaw: mainDeck.difficultyRaw,
      difficultyAlgorithmic: mainDeck.difficultyAlgorithmic,
      coverage: mainDeck.coverage,
      uniqueCoverage: mainDeck.uniqueCoverage,
      externalRating: mainDeck.externalRating,
    },
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    // Anonymous by design — bounded by IP rather than by account.
    await enforceRateLimit(req, 'anime-lookup')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Server misconfigured: missing Supabase service role credentials' }, 500)
    }
    const { externalIds } = await req.json()
    if (!Array.isArray(externalIds) || externalIds.length === 0) return jsonResponse({ results: [] })

    const summaries = (await Promise.all(externalIds.map((id: unknown) => fetchSummary(String(id))))).filter(Boolean) as any[]

    // Cross-reference already-linked media so the client can route straight
    // to the episode list — same pattern as anime-media-browse.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: existingRefs } = summaries.length
      ? await supabase.from('media_provider_ref').select('media_id, external_id').eq('provider', 'jiten').in('external_id', summaries.map(s => s.externalId))
      : { data: [] }
    const linkedByExternalId = new Map((existingRefs ?? []).map((r: any) => [r.external_id, r.media_id]))

    return jsonResponse({ results: summaries.map(s => ({ ...s, mediaId: linkedByExternalId.get(s.externalId) ?? null })) })
  } catch (err) {
    const limited = rateLimitErrorResponse(err, jsonResponse)
    if (limited) return limited
    console.error('[anime-media-lookup]', err)
    return jsonResponse({ error: err?.message || 'Lookup failed' }, 500)
  }
})
