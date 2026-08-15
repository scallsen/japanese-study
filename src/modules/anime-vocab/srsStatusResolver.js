import { resolveCard, cardStateLabel } from '../vocab-srs/srs.js'

// Batch SRS-status resolution for a whole episode's worth of jmdictIds at
// once. DictionaryEntryPage.jsx resolves one word at a time by scanning all
// cards per lookup (O(cards × entries)) — fine for a single detail page, too
// slow here where we resolve status for every word in an episode. Build the
// jmdictId -> card index once per progress change instead (O(cards) total).
export function buildJmdictIdCardIndex(progress) {
  const index = new Map()
  for (const card of Object.values(progress?.cards ?? {})) {
    const resolved = resolveCard(card)
    if (resolved.jmdictId) index.set(resolved.jmdictId, resolved)
  }
  return index
}

// 'new' | 'learning' | 'young' | 'mature' | 'relearning' | 'not-in-deck'
export function resolveStatus(jmdictId, index) {
  if (!jmdictId) return 'not-in-deck'
  const card = index.get(jmdictId)
  return card ? cardStateLabel(card) : 'not-in-deck'
}
