import { useProgress } from '../../hooks/useProgress.js'

// Per-user "currently studying" list — payload: { tracked: { [mediaId]: { title, mediaType, addedAt } } }.
// Single track()/untrack() mutation path shared by the episode list toggle and the dashboard section.
export function useTrackedAnime() {
  const { data, save, loading } = useProgress('anime-vocab-tracking')
  const tracked = data?.tracked ?? {}

  function isTracked(mediaId) {
    return !!tracked[mediaId]
  }

  function track(media) {
    save({
      ...data,
      tracked: {
        ...tracked,
        [media.id]: { title: media.title, mediaType: media.mediaType, addedAt: new Date().toISOString() },
      },
    })
  }

  function untrack(mediaId) {
    const rest = { ...tracked }
    delete rest[mediaId]
    save({ ...data, tracked: rest })
  }

  return { tracked, loading, isTracked, track, untrack }
}
