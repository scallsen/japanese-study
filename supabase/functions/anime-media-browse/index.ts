import { createClient } from 'npm:@supabase/supabase-js@2'

// Browse/filter the show-level catalog (GET /api/media-deck/get-media-decks)
// — used by the media-type/difficulty filters on the Anime Vocab search
// screen and by the "recommended series" grid on its home/empty state.
// Duplicated fetch/mapping logic from
// src/modules/anime-vocab/providers/jitenClient.js's browseMedia — kept in
// sync manually, see anime-media-search for why.
//
// Confirmed live that Jiten's own query params for this endpoint aren't
// reliably honored: repeated mediaType keys don't filter, limit is ignored
// (still returns a fixed ~20-item page), sortDirection=desc on releaseDate
// returned ascending order instead. Only sortBy=difficulty&sortDirection=asc
// is confirmed correct. So the params below are sent as best-effort hints
// only — every result is always re-filtered/re-sorted/re-sliced here in JS,
// regardless of what the upstream query actually did.

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

// 'difficulty' sorts on difficultyRaw (continuous) rather than the coarse
// 0-4 rounded `difficulty` bucket most shows share the same value in.
const SORT_FIELD: Record<string, string> = { difficulty: 'difficultyRaw' }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

function compareBy(field: string, direction: string) {
  return (a: any, b: any) => {
    const av = a[field], bv = b[field]
    const cmp = typeof av === 'string' || typeof bv === 'string'
      ? String(av ?? '').localeCompare(String(bv ?? ''))
      : (av ?? 0) - (bv ?? 0)
    return direction === 'desc' ? -cmp : cmp
  }
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

// Content-maturity filtering — see identical constants/logic in
// jitenClient.js's browseMedia for the full reasoning (hard-block is an
// operator-safety floor, not a user preference; soft tiers use genre id 5
// "Ecchi" + the "Nudity" tag, both live-verified). Duplicated here per the
// same Node/Deno-boundary convention as MEDIA_TYPE_LABELS above.
const HARD_BLOCK_TAG_IDS = new Set([173, 225, 226, 227, 228, 229, 230]) // Guro, Femdom, Incest, Netorare, Netorase, Netori, Prostitution
const ECCHI_GENRE_ID = 5
const NUDITY_TAG_ID = 231

function isHardBlocked(deck: any) {
  return (deck?.tags ?? []).some((t: any) => HARD_BLOCK_TAG_IDS.has(t.tagId))
}

function passesMaturity(deck: any, maturity: string) {
  if (isHardBlocked(deck)) return false
  if (maturity === 'suggestive') return true
  const hasEcchi = (deck?.genres ?? []).includes(ECCHI_GENRE_ID)
  const hasNudity = (deck?.tags ?? []).some((t: any) => t.tagId === NUDITY_TAG_ID)
  if (maturity === 'slightly-suggestive') return !(hasEcchi && hasNudity)
  return !hasEcchi && !hasNudity // 'safe' (default)
}

async function browseMedia(params: any) {
  const { mediaTypes, difficultyMin, difficultyMax, maturity = 'safe', sortBy = 'difficulty', sortDirection = 'asc', limit = 24 } = params ?? {}

  const qs = new URLSearchParams()
  qs.set('sortBy', sortBy)
  qs.set('sortDirection', sortDirection)
  for (const t of mediaTypes ?? []) qs.append('mediaType', String(t))
  if (difficultyMin != null) qs.set('difficultyMin', String(difficultyMin))
  if (difficultyMax != null) qs.set('difficultyMax', String(difficultyMax))

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (JITEN_API_KEY) headers['X-Api-Key'] = JITEN_API_KEY
  const res = await fetch(`https://api.jiten.moe/api/media-deck/get-media-decks?${qs.toString()}`, { headers })
  if (res.status === 429) throw new Error('Jiten rate limit exceeded — try again shortly')
  if (!res.ok) throw new Error(`Jiten browse failed (${res.status})`)
  const body = await res.json()
  let decks: any[] = Array.isArray(body) ? body : (body.data ?? [])

  const clampedLimit = Math.max(1, Math.min(Number(limit) || 24, 50))
  if (mediaTypes?.length) decks = decks.filter((d: any) => mediaTypes.includes(d.mediaType))
  if (difficultyMin != null) decks = decks.filter((d: any) => (d.difficultyRaw ?? d.difficulty ?? 0) >= difficultyMin)
  if (difficultyMax != null) decks = decks.filter((d: any) => (d.difficultyRaw ?? d.difficulty ?? 0) <= difficultyMax)
  decks = decks.filter((d: any) => passesMaturity(d, maturity))
  decks = decks.slice().sort(compareBy(SORT_FIELD[sortBy] ?? sortBy, sortDirection)).slice(0, clampedLimit)

  return decks.map((d: any) => ({
    externalId: String(d.deckId),
    title: d.englishTitle || d.romajiTitle || d.originalTitle,
    originalTitle: d.originalTitle,
    mediaType: MEDIA_TYPE_LABELS[d.mediaType] ?? 'Other',
    coverUrl: d.coverName,
    difficulty: deckDifficulty(d),
  }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Server misconfigured: missing Supabase service role credentials' }, 500)
    }
    const params = await req.json().catch(() => ({}))
    const results = await browseMedia(params)

    // Cross-reference already-linked media so the client can route straight
    // to the episode list instead of re-linking — same pattern as anime-media-search.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const externalIds = results.map((r: any) => r.externalId)
    const { data: existingRefs } = externalIds.length
      ? await supabase.from('media_provider_ref').select('media_id, external_id').eq('provider', 'jiten').in('external_id', externalIds)
      : { data: [] }
    const linkedByExternalId = new Map((existingRefs ?? []).map((r: any) => [r.external_id, r.media_id]))

    return jsonResponse({ results: results.map((r: any) => ({ ...r, mediaId: linkedByExternalId.get(r.externalId) ?? null })) })
  } catch (err) {
    console.error('[anime-media-browse]', err)
    return jsonResponse({ error: err?.message || 'Browse failed' }, 500)
  }
})
