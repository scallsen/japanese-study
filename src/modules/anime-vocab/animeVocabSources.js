import { supabase } from '../../lib/supabase.js'
import { syncEpisodeVocab } from './api.js'

// global_frequency_rank threshold for "very common, skip by default" — kept
// in sync with GENERIC_RANK_THRESHOLD in EpisodeVocabBrowser.jsx.
const GENERIC_RANK_THRESHOLD = 200

export function animeSourceId(mediaId) {
  return `anime-${mediaId}`
}

export function animeListKey(mediaId, episodeId) {
  return `anime-${mediaId}-ep-${episodeId}`
}

// Builds one WORD_SOURCES-shaped entry per tracked anime, with one sublist
// per episode (mirrors the NSM "day" sublist pattern) — episode metadata
// only (title, word count), no vocab content resolved yet. Cheap: episode
// rows are already fetched elsewhere in the anime-vocab module, this is the
// same table, and unique_word_count is already stored per episode so no
// per-episode vocab query is needed just to populate the picker.
export async function fetchAnimeSources(tracked) {
  const mediaIds = Object.keys(tracked)
  if (mediaIds.length === 0 || !supabase) return []

  const { data: episodeRows } = await supabase
    .from('media_episode')
    .select('id, media_id, episode_number, title, unique_word_count, synced_at')
    .in('media_id', mediaIds)
    .order('episode_number', { ascending: true })

  const episodesByMedia = new Map()
  for (const ep of episodeRows ?? []) {
    if (!episodesByMedia.has(ep.media_id)) episodesByMedia.set(ep.media_id, [])
    episodesByMedia.get(ep.media_id).push(ep)
  }

  return mediaIds
    .map(mediaId => {
      const episodes = episodesByMedia.get(mediaId) ?? []
      return {
        id: animeSourceId(mediaId),
        label: tracked[mediaId].title,
        lists: episodes.map(ep => ({
          id: animeListKey(mediaId, ep.id),
          label: ep.title || `Episode ${ep.episode_number}`,
          episodeId: ep.id,
          syncedAt: ep.synced_at,
          wordCount: ep.unique_word_count ?? 0,
        })),
      }
    })
    .filter(source => source.lists.length > 0)
}

// Resolves one episode's eligible vocab into Vocab-Drill-ready word objects.
// Just { id, jmdictId, listKey } — no static kanji/kana/english needed, since
// every eligible occurrence here is guaranteed to have a jmdictId and the
// dictionary is the sole source of truth for a jmdictId-linked word (see
// CLAUDE.md's word data format). Mirrors EpisodeVocabBrowser.jsx's default
// eligible-word filter (exclude grammar/names/very-common, include
// already-known) since Vocab Drill has no per-sublist filter UI of its own.
// Syncs the episode from Jiten first if it hasn't been synced yet.
export async function fetchEpisodeWords(list) {
  if (!list.syncedAt) {
    await syncEpisodeVocab(list.episodeId)
  }
  const { data } = await supabase
    .from('media_vocab_occurrence')
    .select('id, jmdict_id, is_grammar, is_name, global_frequency_rank')
    .eq('media_episode_id', list.episodeId)
    .order('frequency_rank')

  return (data ?? [])
    .filter(r => r.jmdict_id)
    .filter(r => !r.is_grammar)
    .filter(r => !r.is_name)
    .filter(r => r.global_frequency_rank == null || r.global_frequency_rank > GENERIC_RANK_THRESHOLD)
    .map(r => ({ id: `anime-vocab-${r.id}`, jmdictId: r.jmdict_id, listKey: list.id }))
}
