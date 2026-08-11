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
    episodes: episodes.map((ep, i) => ({
      externalId: String(ep.deckId),
      episodeNumber: i + 1,
      title: ep.originalTitle,
      wordCount: ep.wordCount,
      uniqueWordCount: ep.uniqueWordCount,
      difficulty: {
        difficulty: ep.difficulty,
        difficultyRaw: ep.difficultyRaw,
        difficultyAlgorithmic: ep.difficultyAlgorithmic,
        coverage: ep.coverage,
        uniqueCoverage: ep.uniqueCoverage,
        externalRating: ep.externalRating,
      },
    })),
  }
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
