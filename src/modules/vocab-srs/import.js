import { createCard } from './srs.js'

// Returns an array of card objects for the 'imported' deck.
// existingIds should be the keys of the current cards{} object.
export function parseAnkiExport(tsvString, existingIds = []) {
  const existingSet = new Set(existingIds)
  const cards = []

  for (const line of tsvString.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const tabIdx = trimmed.indexOf('\t')
    if (tabIdx === -1) continue
    const front = trimmed.slice(0, tabIdx).trim()
    const back = trimmed.slice(tabIdx + 1).trim()
    if (!front || !back) continue
    const id = `anki-${front}`
    if (existingSet.has(id)) continue
    cards.push(createCard(front, back, id, 'imported'))
  }

  return cards
}
