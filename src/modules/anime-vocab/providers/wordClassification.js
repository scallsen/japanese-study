// Jiten's WordDto has no direct JMdict id — resolving one requires matching
// surface/reading forms against the `dictionary` table ourselves (see
// resolveJmdictIds.js). This module extracts those candidate forms and
// classifies grammar/name words from Jiten's own `partsOfSpeech` tag strings,
// which are already JMdict-derived readable English (confirmed live: e.g.
// "particle", "work of art, literature, music, etc. name").
//
// readingType on mainReading/alternativeReadings distinguishes how a form is
// written: 0 = kanji, 1 = kana-only (confirmed against live Jiten responses —
// e.g. の has mainReading "の" (kana, type 1) with alternatives 乃/之 (kanji,
// type 0); ナルト is kana-only with no kanji alternatives at all).

const KANJI_READING_TYPE = 0
const KANA_READING_TYPE = 1

// Extracts every kanji/kana candidate form for a word, most-frequent first
// (lowest frequencyRank), from mainReading + alternativeReadings combined.
export function extractWordForms(word) {
  const all = [word.mainReading, ...(word.alternativeReadings ?? [])].filter(Boolean)
  const sorted = all.slice().sort((a, b) => (a.frequencyRank ?? Infinity) - (b.frequencyRank ?? Infinity))
  return {
    kanjiForms: sorted.filter(f => f.readingType === KANJI_READING_TYPE).map(f => f.text),
    kanaForms: sorted.filter(f => f.readingType === KANA_READING_TYPE).map(f => f.text),
  }
}

// Closed-class function words — excluded from "critical vocabulary" filters
// by default since they're grammar, not content vocabulary.
const GRAMMAR_TAGS = new Set([
  'particle',
  'conjunction',
  'auxiliary verb',
  'auxiliary adjective',
  'auxiliary',
  'copula',
  'interjection (kandoushi)',
  'prefix',
  'suffix',
  'counter',
])

export function classifyPos(partsOfSpeech) {
  const tags = partsOfSpeech ?? []
  return {
    isGrammar: tags.some(t => GRAMMAR_TAGS.has(t)),
    isName: tags.some(t => /name$/i.test(t)),
  }
}
