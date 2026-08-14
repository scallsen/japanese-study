import { createClient } from 'npm:@supabase/supabase-js@2'

// Proxies Jiten.moe (https://api.jiten.moe, source: github.com/Sirush/Jiten)
// media search — required because Jiten's CORS policy only allowlists
// jiten.moe/localhost, so this app's origin is rejected by browser fetch.
// Duplicated fetch logic (not shared) from
// src/modules/anime-vocab/providers/jitenClient.js, matching this repo's
// existing pattern of independent per-edge-function implementations (see
// story-generate's kuromoji setup / word-import's dictionary lookup) — keep
// this in sync manually if the client-side version changes.

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

function deckDifficulty(d: any) {
  return {
    difficulty: d.difficulty,
    difficultyRaw: d.difficultyRaw,
    difficultyAlgorithmic: d.difficultyAlgorithmic,
    coverage: d.coverage,
    uniqueCoverage: d.uniqueCoverage,
    externalRating: d.externalRating,
  }
}

// Content-maturity filtering — identical constants/logic to
// anime-media-browse/anime-media-select. Duplicated per the established
// Node/Deno-boundary convention (see this file's header comment).
const HARD_BLOCK_TAG_IDS = new Set([173, 225, 226, 227, 228, 229, 230]) // Guro, Femdom, Incest, Netorare, Netorase, Netori, Prostitution
const ECCHI_GENRE_ID = 5
const NUDITY_TAG_ID = 231

function isHardBlocked(deck: any) {
  return (deck?.tags ?? []).some((t: any) => HARD_BLOCK_TAG_IDS.has(t.tagId))
}

function classifyMaturity(deck: any) {
  const hasEcchi = (deck?.genres ?? []).includes(ECCHI_GENRE_ID)
  const hasNudity = (deck?.tags ?? []).some((t: any) => t.tagId === NUDITY_TAG_ID)
  if (hasEcchi && hasNudity) return 'suggestive'
  if (hasEcchi || hasNudity) return 'slightly-suggestive'
  return 'safe'
}

function passesMaturity(deck: any, allowedLevels: string[]) {
  if (isHardBlocked(deck)) return false
  return allowedLevels.includes(classifyMaturity(deck))
}

async function fetchDetail(externalId: string) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (JITEN_API_KEY) headers['X-Api-Key'] = JITEN_API_KEY
  const res = await fetch(`https://api.jiten.moe/api/media-deck/${externalId}/detail?offset=0`, { headers })
  if (!res.ok) return null // skip rather than fail the whole search over one bad candidate
  const body = await res.json()
  return body.data?.mainDeck ?? null
}

// search-suggestions carries none of title/mediaType/coverName's siblings —
// no difficulty, no tags, no genres — so difficulty/maturity filtering
// (and the maturity hard block) can't apply to it directly. Each candidate's
// full detail is fetched in parallel (bounded by Jiten's own `limit=10` on
// the suggestions call) so the same filtering anime-media-browse does can
// also run here, rather than search silently bypassing every filter.
async function searchMedia(query: string, params: any) {
  const { difficultyMin, difficultyMax, maturityLevels = ['safe'] } = params ?? {}

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (JITEN_API_KEY) headers['X-Api-Key'] = JITEN_API_KEY
  const res = await fetch(`https://api.jiten.moe/api/media-deck/search-suggestions?query=${encodeURIComponent(query)}&limit=10`, { headers })
  if (res.status === 429) throw new Error('Jiten rate limit exceeded — try again shortly')
  if (!res.ok) throw new Error(`Jiten search failed (${res.status})`)
  const body = await res.json()
  const suggestions = body.suggestions ?? []

  const details = await Promise.all(suggestions.map((s: any) => fetchDetail(String(s.deckId))))

  const results: any[] = []
  for (let i = 0; i < suggestions.length; i++) {
    const d = details[i]
    if (!d) continue
    if (difficultyMin != null && (d.difficultyRaw ?? d.difficulty ?? 0) < difficultyMin) continue
    if (difficultyMax != null && (d.difficultyRaw ?? d.difficulty ?? 0) > difficultyMax) continue
    if (!passesMaturity(d, maturityLevels)) continue
    results.push({
      externalId: String(suggestions[i].deckId),
      title: d.englishTitle || d.romajiTitle || d.originalTitle,
      originalTitle: d.originalTitle,
      mediaType: MEDIA_TYPE_LABELS[d.mediaType] ?? 'Other',
      coverUrl: d.coverName,
      difficulty: deckDifficulty(d),
    })
  }
  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Server misconfigured: missing Supabase service role credentials' }, 500)
    }
    const { query, difficultyMin, difficultyMax, maturityLevels } = await req.json()
    if (!query || typeof query !== 'string' || !query.trim()) return jsonResponse({ results: [] })

    const results = await searchMedia(query.trim(), { difficultyMin, difficultyMax, maturityLevels })

    // Cross-reference already-linked media so the client can show "already added"
    // and route straight to the episode list instead of re-linking.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const externalIds = results.map((r: any) => r.externalId)
    const { data: existingRefs } = externalIds.length
      ? await supabase.from('media_provider_ref').select('media_id, external_id').eq('provider', 'jiten').in('external_id', externalIds)
      : { data: [] }
    const linkedByExternalId = new Map((existingRefs ?? []).map((r: any) => [r.external_id, r.media_id]))

    return jsonResponse({ results: results.map((r: any) => ({ ...r, mediaId: linkedByExternalId.get(r.externalId) ?? null })) })
  } catch (err) {
    console.error('[anime-media-search]', err)
    return jsonResponse({ error: err?.message || 'Search failed' }, 500)
  }
})
