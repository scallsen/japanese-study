import { createClient } from 'npm:@supabase/supabase-js@2'
import { enforceRateLimit, rateLimitErrorResponse } from '../_shared/rateLimit.ts'

// Browse/filter/search the show-level catalog (GET /api/media-deck/get-media-decks)
// — backs the Anime Vocab search screen (text query + media-type/difficulty/
// maturity filters + sort + "Load more") and the "recommended series" grid on
// its home/empty state. Duplicated fetch/mapping logic from
// src/modules/anime-vocab/providers/jitenClient.js's browseMedia — kept in
// sync manually (see this repo's established Node/Deno-boundary convention).
//
// Also now the ONLY text-search path — the old anime-media-search function
// (built on GET /api/media-deck/search-suggestions) has been removed.
// search-suggestions is capped at a fixed top-10 with no working offset/limit
// (confirmed live), so "Load more" was never achievable through it. This
// endpoint's `titleFilter` param (confirmed live — matches both romaji and
// Japanese title text, combines correctly with every other filter param)
// does the same job with real pagination, and every list item already
// carries tags/genres/difficulty inline — no more per-candidate `/detail`
// fetch needed just to apply maturity/difficulty filtering to search results.
//
// Confirmed live against the raw API (do not re-verify, trust this):
//   - `offset` genuinely works and the response includes `totalItems` — real
//     server-side pagination exists, contrary to this file's old assumption
//     that the endpoint always returns a fixed ~20-item page regardless of
//     query params. `limit`/`pageSize` params are still ignored — every page
//     is a fixed 50 items (JITEN_PAGE_SIZE below).
//   - `sortBy` only takes effect with the EXACT field-name casing (e.g.
//     `difficulty`, `wordCount`, `releaseDate`, `romajiTitle` all sort
//     correctly ascending; `difficultyRaw`, `Difficulty`, `WordCount` etc.
//     silently no-op back to unsorted default order). `externalRating`,
//     `creationDate`, and `distinctVoterCount` were tried and are NOT
//     reliably sorted server-side even with correct casing — not exposed as
//     sort options here. This fixes a latent bug in the old SORT_FIELD map,
//     which sent `difficultyRaw` (never sorts) instead of `difficulty`.
//   - `sortDirection` AND `sortOrder` are both completely non-functional —
//     every direction/value tried produced identical (ascending) output. We
//     always request ascending and simulate descending ourselves by walking
//     offset backward from `totalItems` and reversing each fetched page —
//     see browseMedia's cursor handling below. This is real global
//     descending order (not just a locally-reversed page), since ascending
//     order is confirmed globally consistent across offsets.
//   - `difficultyMin`/`difficultyMax` genuinely filter server-side (confirmed
//     via totalItems dropping correctly).
//   - `mediaType` genuinely filters server-side for a SINGLE value, but
//     repeating the key for multiple values only honors one of them
//     (confirmed still broken) — sent as a bandwidth-saving hint only when
//     exactly one type is selected; every result is still re-filtered
//     client-side regardless, same as maturity (which has no server param at
//     all) and multi-value mediaType.

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

// App-level sort key -> exact Jiten field name (case-sensitive, see header
// comment). Only fields confirmed to sort correctly server-side are listed.
const SORT_FIELD: Record<string, string> = {
  difficulty: 'difficulty',
  releaseDate: 'releaseDate',
  title: 'romajiTitle',
  wordCount: 'wordCount',
}

// Confirmed live: the endpoint always returns exactly 50 items per request
// regardless of any limit/pageSize param.
const JITEN_PAGE_SIZE = 50
// Safety valve for a single browseMedia() call — bounds how many upstream
// pages one "Load more" click can scan (e.g. for a very narrow filter combo
// with sparse matches) before returning whatever it found plus a cursor to
// resume from, rather than scanning indefinitely in one request.
const MAX_UPSTREAM_FETCHES_PER_CALL = 15

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

// Classifies a deck into exactly one bucket so the client's multi-select
// maturity chips can OR across buckets the same way the difficulty chips do.
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

async function fetchJitenPage(opts: {
  titleFilter?: string, mediaType?: number, difficultyMin?: number, difficultyMax?: number, sortBy: string, offset: number,
}) {
  const qs = new URLSearchParams()
  qs.set('offset', String(opts.offset))
  qs.set('sortBy', opts.sortBy)
  qs.set('sortDirection', 'asc') // the only direction Jiten honors at all — see header comment
  if (opts.titleFilter) qs.set('titleFilter', opts.titleFilter)
  if (opts.mediaType != null) qs.set('mediaType', String(opts.mediaType))
  if (opts.difficultyMin != null) qs.set('difficultyMin', String(opts.difficultyMin))
  if (opts.difficultyMax != null) qs.set('difficultyMax', String(opts.difficultyMax))

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (JITEN_API_KEY) headers['X-Api-Key'] = JITEN_API_KEY
  const res = await fetch(`https://api.jiten.moe/api/media-deck/get-media-decks?${qs.toString()}`, { headers })
  if (res.status === 429) throw new Error('Jiten rate limit exceeded — try again shortly')
  if (!res.ok) throw new Error(`Jiten browse failed (${res.status})`)
  const body = await res.json()
  return { items: (body.data ?? []) as any[], totalItems: (body.totalItems ?? 0) as number }
}

// cursor shape: { pos: number, totalItems: number } | null|undefined —
// opaque to the client, which just echoes back whatever nextCursor this
// function last returned to resume a "Load more" click. For ascending,
// `pos` is the next literal Jiten offset to fetch forward from. For
// descending, it's the EXCLUSIVE UPPER BOUND of what's left to fetch walking
// backward — not a literal offset, since Jiten only ever pages forward from
// a given offset (there's no "give me the 50 items ending at X" query). Each
// backward step derives the real fetch offset from it as
// `max(0, pos - JITEN_PAGE_SIZE)`, and trims the fetched page down to just
// the `pos - offset` items actually still wanted whenever that offset gets
// clamped to 0 before reaching an exact 50-item boundary — otherwise the
// final backward chunk would re-fetch (and duplicate) items already
// collected by the previous chunk, since a forward page from offset 0 always
// starts from the very beginning, not from wherever we "meant" it to.
async function browseMedia(params: any) {
  const {
    query, mediaTypes, difficultyMin, difficultyMax, maturityLevels = ['safe'],
    sortBy = 'difficulty', sortDirection = 'asc', limit = 24, cursor,
  } = params ?? {}

  const jitenSortBy = SORT_FIELD[sortBy] ?? sortBy
  const clampedLimit = Math.max(1, Math.min(Number(limit) || 24, 50))
  const titleFilter = typeof query === 'string' ? query.trim() : ''
  const singleMediaType = mediaTypes?.length === 1 ? mediaTypes[0] : undefined

  let totalItems: number
  let pos: number
  let seedItems: any[] | null = null

  if (cursor?.pos != null && cursor?.totalItems != null) {
    totalItems = cursor.totalItems
    pos = cursor.pos
  } else {
    // First page of a new query. Ascending can use this fetch's items
    // directly; descending only needs it for `totalItems` — the real first
    // (highest-offset) page for descending is fetched inside the loop below.
    const first = await fetchJitenPage({ titleFilter, mediaType: singleMediaType, difficultyMin, difficultyMax, sortBy: jitenSortBy, offset: 0 })
    totalItems = first.totalItems
    if (sortDirection === 'desc') {
      pos = totalItems
    } else {
      pos = first.items.length
      seedItems = first.items
    }
  }

  const collected: any[] = []
  let fetches = 0
  let exhausted = false

  while (collected.length < clampedLimit && fetches < MAX_UPSTREAM_FETCHES_PER_CALL) {
    let items: any[]

    if (seedItems) {
      items = seedItems
      seedItems = null
    } else if (sortDirection === 'desc') {
      if (pos <= 0) { exhausted = true; break }
      const offset = Math.max(0, pos - JITEN_PAGE_SIZE)
      const wantCount = pos - offset
      const page = await fetchJitenPage({ titleFilter, mediaType: singleMediaType, difficultyMin, difficultyMax, sortBy: jitenSortBy, offset })
      fetches++
      const trimmed = page.items.length > wantCount ? page.items.slice(0, wantCount) : page.items
      if (trimmed.length === 0) { exhausted = true; break }
      items = trimmed.slice().reverse()
      pos = offset
    } else {
      if (pos >= totalItems) { exhausted = true; break }
      const page = await fetchJitenPage({ titleFilter, mediaType: singleMediaType, difficultyMin, difficultyMax, sortBy: jitenSortBy, offset: pos })
      fetches++
      if (page.items.length === 0) { exhausted = true; break }
      items = page.items
      pos += items.length
    }

    const filtered = items
      .filter((d: any) => !mediaTypes?.length || mediaTypes.includes(d.mediaType))
      .filter((d: any) => passesMaturity(d, maturityLevels))
    collected.push(...filtered)
  }

  const hasMoreUpstream = sortDirection === 'desc' ? pos > 0 : pos < totalItems
  const nextCursor = !exhausted && hasMoreUpstream ? { pos, totalItems } : null

  return {
    results: collected.map((d: any) => ({
      externalId: String(d.deckId),
      title: d.englishTitle || d.romajiTitle || d.originalTitle,
      originalTitle: d.originalTitle,
      mediaType: MEDIA_TYPE_LABELS[d.mediaType] ?? 'Other',
      coverUrl: d.coverName,
      difficulty: deckDifficulty(d),
    })),
    nextCursor,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    // Anonymous by design — bounded by IP rather than by account.
    await enforceRateLimit(req, 'anime-browse')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Server misconfigured: missing Supabase service role credentials' }, 500)
    }
    const params = await req.json().catch(() => ({}))
    const { results, nextCursor } = await browseMedia(params)

    // Cross-reference already-linked media so the client can route straight
    // to the episode list instead of re-linking.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const externalIds = results.map((r: any) => r.externalId)
    const { data: existingRefs } = externalIds.length
      ? await supabase.from('media_provider_ref').select('media_id, external_id').eq('provider', 'jiten').in('external_id', externalIds)
      : { data: [] }
    const linkedByExternalId = new Map((existingRefs ?? []).map((r: any) => [r.external_id, r.media_id]))

    return jsonResponse({
      results: results.map((r: any) => ({ ...r, mediaId: linkedByExternalId.get(r.externalId) ?? null })),
      nextCursor,
    })
  } catch (err) {
    const limited = rateLimitErrorResponse(err, jsonResponse)
    if (limited) return limited
    console.error('[anime-media-browse]', err)
    return jsonResponse({ error: err?.message || 'Browse failed' }, 500)
  }
})
