// Thin fetch wrapper over the Jiten.moe API (https://api.jiten.moe, source:
// github.com/Sirush/Jiten). Public search/read endpoints work anonymously;
// missing a JITEN_API_KEY just puts the caller in the shared/lower rate-limit
// bucket (300 req/min ordinary, ~10/min for the vocabulary endpoint) rather
// than failing. Jiten's CORS policy only allowlists jiten.moe/localhost, so
// every call here must run server-side (Node ingest script or Supabase edge
// function) — never imported into client React code.

const BASE_URL = 'https://api.jiten.moe'

// mediaType enum from Jiten's DeckDto: Anime=1, Drama=2, Movie=3, Novel=4,
// NonFiction=5, VideoGame=6, VisualNovel=7, WebNovel=8, Manga=9, Audio=10
export const MEDIA_TYPE_LABELS = {
  1: 'Anime',
  2: 'Drama',
  3: 'Movie',
  4: 'Novel',
  5: 'Non-fiction',
  6: 'Video game',
  7: 'Visual novel',
  8: 'Web novel',
  9: 'Manga',
  10: 'Audio',
}

async function jitenFetch(path, apiKey) {
  const headers = { Accept: 'application/json' }
  if (apiKey) headers['X-Api-Key'] = apiKey
  const res = await fetch(`${BASE_URL}${path}`, { headers })
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After')
    throw new Error(`Jiten rate limit exceeded${retryAfter ? ` — retry after ${retryAfter}s` : ''}`)
  }
  if (!res.ok) throw new Error(`Jiten request failed (${res.status}): ${path}`)
  const json = await res.json()
  return json.data ?? json
}

export async function searchMedia(query, { limit = 10, apiKey } = {}) {
  const q = encodeURIComponent(query)
  const body = await jitenFetch(`/api/media-deck/search-suggestions?query=${q}&limit=${limit}`, apiKey)
  return (body.suggestions ?? []).map(s => ({
    externalId: String(s.deckId),
    title: s.englishTitle || s.romajiTitle || s.originalTitle,
    originalTitle: s.originalTitle,
    mediaType: MEDIA_TYPE_LABELS[s.mediaType] ?? 'Other',
    coverUrl: s.coverName,
  }))
}

// A show's mainDeck carries the same difficulty/rating/cover fields as each
// episode (subDeck) — this builds that shared 6-key shape from either.
function deckDifficulty(deck) {
  return {
    difficulty: deck?.difficulty,
    difficultyRaw: deck?.difficultyRaw,
    difficultyAlgorithmic: deck?.difficultyAlgorithmic,
    coverage: deck?.coverage,
    uniqueCoverage: deck?.uniqueCoverage,
    externalRating: deck?.externalRating,
  }
}

// Show-detail-only fields (synopsis, tags, external links, related decks) —
// only pulled at select/backfill time (one full mainDeck fetch), never on
// every search/browse result, so those lighter-weight lists don't bloat.
// `genres` is deliberately left out: Jiten returns it as bare numeric ids
// with no public name-lookup endpoint (probed live — /api/genre,
// /api/media-deck/genres, etc. all 404), unlike `tags` which already come
// back with human-readable names attached.
function deckMeta(deck) {
  return {
    originalTitle: deck?.originalTitle,
    description: deck?.description,
    tags: (deck?.tags ?? []).map(t => ({ name: t.name, percentage: t.percentage })),
    links: (deck?.links ?? []).map(l => ({ linkType: l.linkType, url: l.url })),
    relationships: (deck?.relationships ?? []).map(r => ({
      externalId: String(r.targetDeckId),
      title: r.targetDeck?.englishTitle || r.targetDeck?.romajiTitle || r.targetDeck?.originalTitle,
      mediaType: MEDIA_TYPE_LABELS[r.targetDeck?.mediaType] ?? 'Other',
    })),
  }
}

// Episodes are modeled as child "decks" of the show's main deck. Paginates
// through all subDecks (25/page) and returns them in provider order, which
// matches sequential episode numbering (subDecks[0] = deckOrder 1, etc.).
export async function fetchEpisodeList(externalId, { apiKey } = {}) {
  const episodes = []
  let offset = 0
  let mainDeck = null
  for (;;) {
    const body = await jitenFetch(`/api/media-deck/${externalId}/detail?offset=${offset}`, apiKey)
    mainDeck ??= body.mainDeck
    const page = body.subDecks ?? []
    episodes.push(...page)
    if (page.length < 25) break
    offset += 25
  }
  return {
    title: mainDeck?.englishTitle || mainDeck?.romajiTitle || mainDeck?.originalTitle,
    mediaType: MEDIA_TYPE_LABELS[mainDeck?.mediaType] ?? 'Other',
    coverUrl: mainDeck?.coverName,
    difficulty: deckDifficulty(mainDeck),
    ...deckMeta(mainDeck),
    episodes: episodes.map((ep, i) => ({
      externalId: String(ep.deckId),
      episodeNumber: i + 1,
      title: ep.originalTitle,
      wordCount: ep.wordCount,
      uniqueWordCount: ep.uniqueWordCount,
      difficulty: deckDifficulty(ep),
    })),
  }
}

// Lightweight show-level-only fetch (single page, no episode pagination) —
// for callers that only need mainDeck's own fields, e.g. a backfill script
// refreshing cover_url/difficulty for shows already linked, where paging
// through every episode just to re-read two show-level columns would be
// wasteful for shows with 100+ episodes.
export async function fetchMediaSummary(externalId, { apiKey } = {}) {
  const body = await jitenFetch(`/api/media-deck/${externalId}/detail?offset=0`, apiKey)
  const mainDeck = body.mainDeck
  return {
    title: mainDeck?.englishTitle || mainDeck?.romajiTitle || mainDeck?.originalTitle,
    mediaType: MEDIA_TYPE_LABELS[mainDeck?.mediaType] ?? 'Other',
    coverUrl: mainDeck?.coverName,
    difficulty: deckDifficulty(mainDeck),
    ...deckMeta(mainDeck),
  }
}

// Field to actually sort/compare on for a given sortBy value — 'difficulty'
// maps to difficultyRaw (continuous) rather than the coarse 0-4 rounded
// `difficulty` bucket, since most shows share the same coarse value.
const SORT_FIELD = { difficulty: 'difficultyRaw' }

function compareBy(field, direction) {
  return (a, b) => {
    const av = a[field], bv = b[field]
    const cmp = typeof av === 'string' || typeof bv === 'string'
      ? String(av ?? '').localeCompare(String(bv ?? ''))
      : (av ?? 0) - (bv ?? 0)
    return direction === 'desc' ? -cmp : cmp
  }
}

// Content-maturity filtering for browse results. Hard-blocked tags are
// always excluded regardless of the caller's maturity level — this is the
// operator-safety floor for a publicly-shared tool, not a user preference,
// and is enforced here plus (separately, duplicated across the Deno
// boundary) in anime-media-select, since text search results carry no
// tag/genre data at all (confirmed live) and so can't be filtered the same
// way — select is the backstop that still prevents linking one found via
// search. Soft tiers use the two signals live testing confirmed reliable:
// genre id 5, cross-verified against 3 real AniList-linked shows (SPY×FAMILY,
// High School DxD, Prison School) as "Ecchi" — Jiten's genre ids otherwise
// have no public name mapping, which is why they aren't captured/used
// anywhere else in this app — and the already-named "Nudity" tag (231).
const HARD_BLOCK_TAG_IDS = new Set([173, 225, 226, 227, 228, 229, 230]) // Guro, Femdom, Incest, Netorare, Netorase, Netori, Prostitution
const ECCHI_GENRE_ID = 5
const NUDITY_TAG_ID = 231

function isHardBlocked(deck) {
  return (deck?.tags ?? []).some(t => HARD_BLOCK_TAG_IDS.has(t.tagId))
}

// Classifies a deck into exactly one bucket so the client's multi-select
// maturity chips can OR across buckets the same way the difficulty chips do.
function classifyMaturity(deck) {
  const hasEcchi = (deck?.genres ?? []).includes(ECCHI_GENRE_ID)
  const hasNudity = (deck?.tags ?? []).some(t => t.tagId === NUDITY_TAG_ID)
  if (hasEcchi && hasNudity) return 'suggestive'
  if (hasEcchi || hasNudity) return 'slightly-suggestive'
  return 'safe'
}

function passesMaturity(deck, allowedLevels) {
  if (isHardBlocked(deck)) return false
  return allowedLevels.includes(classifyMaturity(deck))
}

// Browse/filter the show-level catalog (GET /api/media-deck/get-media-decks)
// — confirmed live that Jiten's own query params for this endpoint aren't
// reliably honored (repeated mediaType keys don't filter, limit is ignored,
// sortDirection=desc on releaseDate returned ascending instead) except for
// sortBy=difficulty&sortDirection=asc, which is confirmed correct. Query
// params below are sent as best-effort hints regardless — harmless if
// ignored — but every result is always re-filtered/re-sorted/re-sliced here
// in JS, so correctness never depends on Jiten having honored them.
export async function browseMedia(params = {}, { apiKey } = {}) {
  const { mediaTypes, difficultyMin, difficultyMax, maturityLevels = ['safe'], sortBy = 'difficulty', sortDirection = 'asc', limit = 24 } = params

  const qs = new URLSearchParams()
  qs.set('sortBy', sortBy)
  qs.set('sortDirection', sortDirection)
  for (const t of mediaTypes ?? []) qs.append('mediaType', String(t))
  if (difficultyMin != null) qs.set('difficultyMin', String(difficultyMin))
  if (difficultyMax != null) qs.set('difficultyMax', String(difficultyMax))

  const body = await jitenFetch(`/api/media-deck/get-media-decks?${qs.toString()}`, apiKey)
  let decks = Array.isArray(body) ? body : (body.data ?? [])

  if (mediaTypes?.length) decks = decks.filter(d => mediaTypes.includes(d.mediaType))
  if (difficultyMin != null) decks = decks.filter(d => (d.difficultyRaw ?? d.difficulty ?? 0) >= difficultyMin)
  if (difficultyMax != null) decks = decks.filter(d => (d.difficultyRaw ?? d.difficulty ?? 0) <= difficultyMax)
  decks = decks.filter(d => passesMaturity(d, maturityLevels))
  decks = decks.slice().sort(compareBy(SORT_FIELD[sortBy] ?? sortBy, sortDirection)).slice(0, limit)

  return decks.map(d => ({
    externalId: String(d.deckId),
    title: d.englishTitle || d.romajiTitle || d.originalTitle,
    originalTitle: d.originalTitle,
    mediaType: MEDIA_TYPE_LABELS[d.mediaType] ?? 'Other',
    coverUrl: d.coverName,
    difficulty: deckDifficulty(d),
  }))
}

const VOCAB_PAGE_SIZE = 200

// Fetches every word for one episode/child-deck, paginating the heavy
// vocabulary endpoint (max 200/page, rate-limited to ~10 req/min by Jiten).
export async function fetchVocabList(episodeExternalId, { apiKey, sortBy = 'deckFreq' } = {}) {
  const words = []
  const seenWordIds = new Set()
  let offset = 0
  for (;;) {
    const body = await jitenFetch(
      `/api/media-deck/${episodeExternalId}/vocabulary?limit=${VOCAB_PAGE_SIZE}&sortBy=${sortBy}&offset=${offset}`,
      apiKey,
    )
    const page = body.words ?? []
    // Jiten's pagination sort isn't perfectly stable at page boundaries —
    // confirmed live: the same wordId can appear on two consecutive pages.
    for (const w of page) {
      if (seenWordIds.has(w.wordId)) continue
      seenWordIds.add(w.wordId)
      words.push(w)
    }
    if (page.length < VOCAB_PAGE_SIZE) break
    offset += VOCAB_PAGE_SIZE
  }
  return words
}
