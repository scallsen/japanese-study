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

// → { results: [{ externalId, title, originalTitle, mediaType, coverUrl, mediaId }] }
export function searchMedia(query) {
  return invoke('anime-media-search', { query })
}

// → { mediaId, title, mediaType, episodes: media_episode[] }
export function selectMedia(jitenDeckId) {
  return invoke('anime-media-select', { jitenDeckId })
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
