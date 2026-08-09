// Shared between VocabPage and VocabSrsModule — which sentence wins when a
// word/card has both its own curated sentence and a Tanaka Corpus match.
// 'custom' (default): the curated sentence wins, Tanaka only fills the gap
// when there isn't one. 'tanaka': Tanaka wins outright whenever available.
export const SENTENCE_SOURCE_OPTIONS = [
  { value: 'custom', label: 'Custom (if available)' },
  { value: 'tanaka', label: 'Tanaka Corpus' },
]

export const DEFAULT_SENTENCE_SOURCE = 'custom'
