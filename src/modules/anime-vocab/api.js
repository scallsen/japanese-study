import { supabase } from '../../lib/supabase.js'

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = error.message
    try {
      const payload = await error.context?.json()
      if (payload?.error) message = payload.error
    } catch { /* keep the generic message */ }
    throw new Error(message || `${name} failed`)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

// maturityLevels: the caller's currently-selected soft maturity tiers (see
// MediaSearch.jsx) — enforced here too, not just in anime-media-browse's
// listing, since search results carry no tag/genre data to pre-filter by
// and so could otherwise be selected regardless of the filter setting.
// → { mediaId, title, mediaType, episodes: media_episode[] }
export function selectMedia(jitenDeckId, maturityLevels) {
  return invoke('anime-media-select', { jitenDeckId, maturityLevels })
}

// → { synced: true, wordCount? } | { synced: true, alreadySynced: true }
export function syncEpisodeVocab(mediaEpisodeId) {
  return invoke('anime-episode-vocab-sync', { mediaEpisodeId })
}

// Also the text-search path — pass `query` to filter by title text (matches
// romaji or Japanese, server-side via Jiten's titleFilter param). Every
// result already carries tags/genres/difficulty inline, so difficulty/
// maturity filters apply identically whether or not a query is set — search
// no longer bypasses them the way the old search-suggestions-based endpoint
// did (see anime-media-browse's header comment).
//
// params: { query?, mediaTypes?: number[], difficultyMin?, difficultyMax?,
//   maturityLevels?, sortBy?, sortDirection?, limit?, cursor? }
// `cursor`: opaque — omit for the first page, then pass back whatever
// `nextCursor` the previous response returned to fetch the next page
// ("Load more"). `nextCursor` is `null` once there's nothing more to load.
// → { results: [{ externalId, title, originalTitle, mediaType, coverUrl, difficulty, mediaId }], nextCursor }
export function browseMedia(params) {
  return invoke('anime-media-browse', params)
}

// externalIds: string[] — fetches live cover/difficulty for a fixed set of
// Jiten deck ids (used by the curated recommendations list).
// → { results: [{ externalId, title, originalTitle, mediaType, coverUrl, difficulty, mediaId }] }
export function lookupMedia(externalIds) {
  return invoke('anime-media-lookup', { externalIds })
}
