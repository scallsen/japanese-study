import { lookupMedia } from './api.js'
import { CURATED_RECOMMENDATIONS } from './curatedRecommendations.js'

// The curated list is static and small, and Jiten's community
// difficulty/rating data drifts slowly, so there's no reason to refetch
// every time MediaSearch's idle/empty state renders (e.g. navigating into a
// show and back). Module-level cache with a TTL — same pattern as
// dictionaryEntryLookup.js's cache elsewhere in the app.
const CACHE_TTL_MS = 30 * 60 * 1000
let cached = null
let cachedAt = 0

export function fetchRecommendedMedia() {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return Promise.resolve(cached)
  return lookupMedia(CURATED_RECOMMENDATIONS.map(r => r.jitenDeckId)).then(({ results }) => {
    cached = results
    cachedAt = Date.now()
    return results
  })
}
