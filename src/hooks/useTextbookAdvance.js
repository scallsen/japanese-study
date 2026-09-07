import { useState, useMemo } from 'react'
import { useDictionaryEntries, useSenseGlosses } from './useDictionaryEntries.js'
import { unsentWordsOf } from '../lib/srsMembership.js'
import { addWordsToSrs, textbookDeck } from '../modules/vocab-srs/addWordsToDeck.js'
import { WORD_DATA } from '../data/wordData.js'

const wordsOfChapter = id => WORD_DATA.filter(w => w.listKey === id && !w.isSentenceVocab)

// Shared "move the tracker past the current chapter" ceremony — the home
// card and the vocab training page both let the tracker advance, and both
// gate that move behind an SRS-first prompt when the chapter being left
// still has unsent words (the "dialog" gate variant from the concept bench;
// the "inline notice" and "no gate" variants aren't wired up here). Kept as
// one hook rather than two copies since the dedupe/creation logic underneath
// (see addWordsToDeck.js) is exactly the same either way.
export function useTextbookAdvance({ state, vocabProgress, saveVocabProgress, srsData, saveSrs }) {
  const [gate, setGate] = useState(null) // { toId, toLabel, then }

  const currentWords = useMemo(
    () => (state ? wordsOfChapter(state.current.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state?.current?.id]
  )
  const jmdictIds = useMemo(() => currentWords.map(w => w.jmdictId).filter(Boolean), [currentWords])
  const { entries: dictEntries } = useDictionaryEntries(jmdictIds, !!state)
  const senseGlosses = useSenseGlosses(currentWords, !!state)
  const unsentWords = useMemo(
    () => (state ? unsentWordsOf(currentWords, dictEntries, srsData?.cards ?? {}) : []),
    [state, currentWords, dictEntries, srsData]
  )

  function setPointer(chapterId) {
    saveVocabProgress({ ...vocabProgress, textbook: { ...vocabProgress.textbook, currentChapterId: chapterId } })
  }

  // Call when the user wants to move the tracker off `state.current` onto
  // `to`. `then()` fires once the pointer has actually moved — immediately
  // when nothing is unsent, or after the dialog resolves.
  function requestAdvance(to, then) {
    if (unsentWords.length > 0) {
      setGate({ toId: to.id, toLabel: to.label, then })
      return
    }
    setPointer(to.id)
    then?.()
  }

  function skipGate() {
    if (!gate) return
    const { toId, then } = gate
    setPointer(toId)
    setGate(null)
    then?.()
  }

  function sendAndAdvance() {
    if (!gate || !state) return
    const { deckId, deckName } = textbookDeck(state.textbook)
    const result = addWordsToSrs(srsData, unsentWords, deckId, deckName, dictEntries, senseGlosses)
    saveSrs(result.data)
    const { toId, then } = gate
    setPointer(toId)
    setGate(null)
    then?.()
  }

  // Direct rewind — "Set as current" on an earlier or later chapter row.
  // Not gated: nothing is being left behind by looking at a different one.
  function setCurrent(chapterId) {
    setPointer(chapterId)
  }

  return {
    unsentWords,
    gate,
    requestAdvance,
    skipGate,
    sendAndAdvance,
    closeGate: () => setGate(null),
    setCurrent,
  }
}
