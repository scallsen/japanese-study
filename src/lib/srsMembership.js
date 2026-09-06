import { cardFormOf } from './displayForm.js'

// Which of a chapter's words already have an SRS card somewhere — any deck,
// not just a chapter's "own" one, since a word added by hand from the drill's
// done screen still counts as sent. Matched by jmdictId first (the reliable
// key), falling back to the card's displayed front form for words with no
// jmdictId match, mirroring how VocabPage's own done-screen dedupe decides
// whether a word is "already a card" before creating one.
//
// Used to gate advancing past a chapter with unsent words (useTextbookAdvance)
// — not a per-row badge or notice, since the app only ships the "dialog" gate
// variant from the concept bench, not the "inline notice" one.
export function unsentWordsOf(words, dictEntries, cardsObj) {
  const cards = Object.values(cardsObj ?? {})
  const knownIds = new Set(cards.map(c => c.jmdictId).filter(Boolean))
  const knownFronts = new Set(cards.map(c => c.front).filter(Boolean))
  return (words ?? []).filter(w => {
    if (w.jmdictId && knownIds.has(w.jmdictId)) return false
    const dictEntry = w.jmdictId ? dictEntries?.[w.jmdictId] : null
    const front = cardFormOf(w, dictEntry).form ?? w.kana
    return !knownFronts.has(front)
  })
}
