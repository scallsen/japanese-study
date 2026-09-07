import { describe, it, expect } from 'vitest'
import { isDictReady, buildEpisodeVocabRow, buildDrillWords } from './episodeVocabRows.js'

// A word whose dictionary entry has actually resolved.
const DICT_ENTRY = {
  primary_form: '無',
  kana_forms: ['な', 'む'],
  gloss_en: 'nonexistent; not being (there); unowned',
  jlpt_level: 'N3',
  jlpt_level_inferred: false,
}

// What Jiten hands back for the same word before it's matched against our
// dictionary — this is what a row falls back to when its dictEntry hasn't
// resolved yet. Deliberately messy, mirroring how a real Jiten reading can
// carry more than the bare headword.
const OCCURRENCE = {
  id: 'occ-1',
  jmdict_id: 'dict-123',
  surface_form: '無stomach',
  occurrence_count: 3,
  frequency_rank: 0,
  global_frequency_rank: 500,
  is_grammar: false,
  is_name: false,
}

describe('isDictReady', () => {
  it('is true once every id is present in dictEntries, resolved or not', () => {
    expect(isDictReady(['a', 'b'], { a: DICT_ENTRY, b: null })).toBe(true)
  })

  it('is false while an id has no entry yet', () => {
    // 'b' simply isn't a key yet — this is the mid-fetch state, not a
    // confirmed miss (which would be an explicit `null`).
    expect(isDictReady(['a', 'b'], { a: DICT_ENTRY })).toBe(false)
  })

  it('is vacuously true when there are no jmdict ids at all', () => {
    expect(isDictReady([], {})).toBe(true)
  })
})

describe('buildEpisodeVocabRow', () => {
  it('renders the real dictionary form/reading/gloss once the entry has resolved', () => {
    const row = buildEpisodeVocabRow(OCCURRENCE, DICT_ENTRY, 'not-in-deck')
    expect(row.displayForm).toBe('無')
    expect(row.reading).toBe('な')
    expect(row.gloss).toBe('nonexistent; not being (there); unowned')
  })

  // This is the exact shape of the original bug: a row built before its
  // dictEntry arrives falls back to Jiten's raw surface_form with no gloss.
  // It isn't wrong on its own — the fallback is a deliberate "show something
  // while we wait" — the bug was building a drill word from a row in this
  // state instead of waiting for isDictReady.
  it('falls back to the raw surface form with no gloss while the entry is still in flight', () => {
    const row = buildEpisodeVocabRow(OCCURRENCE, undefined, 'not-in-deck')
    expect(row.displayForm).toBe('無stomach')
    expect(row.reading).toBeNull()
    expect(row.gloss).toBeNull()
  })

  it('falls back the same way on a confirmed no-match', () => {
    const row = buildEpisodeVocabRow(OCCURRENCE, null, 'not-in-deck')
    expect(row.displayForm).toBe('無stomach')
    expect(row.gloss).toBeNull()
  })
})

describe('buildDrillWords', () => {
  it('builds a correctly formed card from a resolved row', () => {
    const row = buildEpisodeVocabRow(OCCURRENCE, DICT_ENTRY, 'not-in-deck')
    const [word] = buildDrillWords([row], new Set([OCCURRENCE.id]))
    expect(word).toMatchObject({
      id: 'anime-vocab-occ-1',
      kanji: '無',
      kana: 'な',
      english: 'nonexistent; not being (there); unowned',
      jmdictId: 'dict-123',
    })
  })

  // Pins the actual bug: if a selected row's dictEntry hadn't resolved yet
  // (isDictReady would report false for it), building drill words from it
  // anyway hands VocabCard a kanji field with the dictionary's own English
  // gloss word ("stomach") stuck onto the real headword ("無") — the exact
  // "無stomach" card a user reported seeing. This is why EpisodeVocabBrowser
  // must never call buildDrillWords while isDictReady is false.
  it('would hand back a garbled card if called on a not-yet-resolved row', () => {
    const row = buildEpisodeVocabRow(OCCURRENCE, undefined, 'not-in-deck')
    const [word] = buildDrillWords([row], new Set([OCCURRENCE.id]))
    expect(word.kanji).toBe('無stomach')
    expect(word.english).toBe('')
  })

  it('only includes selected rows', () => {
    const rowA = buildEpisodeVocabRow({ ...OCCURRENCE, id: 'a' }, DICT_ENTRY, 'not-in-deck')
    const rowB = buildEpisodeVocabRow({ ...OCCURRENCE, id: 'b' }, DICT_ENTRY, 'not-in-deck')
    const words = buildDrillWords([rowA, rowB], new Set(['b']))
    expect(words.map(w => w.id)).toEqual(['anime-vocab-b'])
  })
})
