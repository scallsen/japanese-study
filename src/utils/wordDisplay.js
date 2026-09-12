import { cardFormOf } from '../lib/displayForm.js'

// Shared displayForm/reading resolution for word-list rows (VocabPage's
// DoneScreen, WordListModal) — dictionary is the source of truth when
// jmdictId matches (see CLAUDE.md's "Dictionary as source of truth"
// section), the word's own kanji/kana are the fallback. reading is null
// when it'd just repeat displayForm.
export function resolveWordDisplay(word, dictEntry) {
  const displayForm = cardFormOf(word, dictEntry).form ?? word.kana
  const readingRaw = word.kana ?? dictEntry?.kana_forms?.[0]
  return { displayForm, reading: readingRaw && readingRaw !== displayForm ? readingRaw : null }
}

export function shortPos(raw) {
  if (!raw) return null
  if (raw.startsWith('Godan verb')) return 'v5'
  if (raw.startsWith('Ichidan verb')) return 'v1'
  if (raw.startsWith('suru verb')) return 'vs'
  if (raw.startsWith('adjectival nouns') || raw.startsWith('quasi-adj')) return 'adj-na'
  if (raw.startsWith('adjective')) return 'adj-i'
  if (raw.startsWith('adverb')) return 'adv'
  if (raw.startsWith('noun')) return 'noun'
  if (raw.startsWith('expression')) return 'exp'
  if (raw.startsWith('conjunction')) return 'conj'
  if (raw.startsWith('interjection')) return 'int'
  if (raw.startsWith('auxiliary')) return 'aux'
  if (raw.startsWith('particle')) return 'part'
  if (raw.startsWith('prefix')) return 'pfx'
  if (raw.startsWith('suffix')) return 'sfx'
  if (raw.startsWith('pronoun')) return 'pron'
  if (raw.startsWith('counter')) return 'ctr'
  if (raw.startsWith('numeric')) return 'num'
  return raw.split(' ')[0].slice(0, 6).toLowerCase()
}
