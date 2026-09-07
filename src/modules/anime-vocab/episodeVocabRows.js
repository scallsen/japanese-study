import { briefGloss } from '../../utils/dictionaryEntryLookup.js'

// True once every occurrence's jmdict_id has a resolved dictionary entry (or
// a confirmed miss) in `dictEntries`. `dictEntries` is populated by an async
// batched lookup (useDictionaryEntries) that lags behind the occurrence list
// itself loading, so there's a real window where an id is known but its
// entry isn't in yet.
//
// buildEpisodeVocabRow below falls back to the occurrence's raw Jiten
// surface_form/no gloss for any id not yet in `dictEntries` — so
// EpisodeVocabBrowser must gate Start Drill on this being true before it
// snapshots `rows` into drill words. Skipping that gate is the bug this
// module's test file pins: a word selected while its entry is still in
// flight would hand VocabCard a stale/wrong kanji that visually wins over
// the correct dictionary form resolving moments later (VocabCard prefers a
// word's own non-null kanji over a fresh dictionary lookup).
export function isDictReady(jmdictIds, dictEntries) {
  return jmdictIds.every(id => id in dictEntries)
}

// One episode-browser row from a raw `media_vocab_occurrence` row plus its
// dictionary entry. `dictEntry` is undefined while the batched lookup for
// its id is still in flight, null once it's confirmed there's no match, or
// the resolved row once it lands — only the last of those gives a real
// displayForm/reading/gloss; the other two fall back to the occurrence's own
// (unverified) surface_form and no gloss.
export function buildEpisodeVocabRow(occurrence, dictEntry, status) {
  return {
    ...occurrence,
    displayForm: dictEntry?.primary_form ?? occurrence.surface_form,
    reading: dictEntry?.kana_forms?.[0] ?? null,
    gloss: briefGloss(dictEntry),
    jlptLevel: dictEntry?.jlpt_level ?? null,
    jlptLevelInferred: dictEntry?.jlpt_level_inferred ?? false,
    status,
  }
}

// The word objects handed to the drill for the selected rows. Only safe to
// call once isDictReady(jmdictIds, dictEntries) is true — see the comment on
// buildEpisodeVocabRow above.
export function buildDrillWords(rows, selectedIds) {
  return rows
    .filter(r => selectedIds.has(r.id))
    .map(r => ({
      id: `anime-vocab-${r.id}`,
      kanji: r.displayForm,
      kana: r.reading ?? r.displayForm,
      english: r.gloss ?? '',
      sentence: null,
      jmdictId: r.jmdict_id,
    }))
}
