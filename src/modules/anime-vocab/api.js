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

// params: { difficultyMin?, difficultyMax?, maturityLevels? } — search
// results are enriched server-side (search-suggestions alone carries no
// difficulty/tag/genre data) so the same filters browse mode applies can
// apply here too, rather than search silently bypassing them.
// → { results: [{ externalId, title, originalTitle, mediaType, coverUrl, difficulty, mediaId }] }
export function searchMedia(query, params) {
  return invoke('anime-media-search', { query, ...params })
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

// params: { mediaTypes?: number[], difficultyMin?, difficultyMax?, sortBy?, sortDirection?, limit? }
// → { results: [{ externalId, title, originalTitle, mediaType, coverUrl, difficulty, mediaId }] }
export function browseMedia(params) {
  return invoke('anime-media-browse', params)
}

// externalIds: string[] — fetches live cover/difficulty for a fixed set of
// Jiten deck ids (used by the curated recommendations list).
// → { results: [{ externalId, title, originalTitle, mediaType, coverUrl, difficulty, mediaId }] }
export function lookupMedia(externalIds) {
  return invoke('anime-media-lookup', { externalIds })
}
