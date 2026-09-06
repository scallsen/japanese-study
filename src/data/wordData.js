import GENKI_1 from './words/genki_1_vocab.json'
import GENKI_2 from './words/genki_2_vocab.json'
import NSM_N3_KANJI from './words/nsm_n3_kanji_vocab.json'

// The published textbooks this app ships. A learner's own course lists are not
// here: they belong to one account and load from it at runtime (useCustomWords),
// so they are neither downloaded by other visitors nor mixed into this pool.
export const WORD_DATA = [...GENKI_1, ...GENKI_2, ...NSM_N3_KANJI]

// Word count per bundled listKey, shared by the dashboard's textbook state
// and the vocab training page — both resolve chapter word counts and would
// otherwise duplicate this reduce. Sentence-review words are extras layered
// onto a list, not part of the chapter itself, so they don't count toward it.
const WORD_COUNT_BY_LIST = WORD_DATA.reduce((map, w) => {
  if (!w.isSentenceVocab) map[w.listKey] = (map[w.listKey] ?? 0) + 1
  return map
}, {})
export const bundledWordCountFor = id => WORD_COUNT_BY_LIST[id] ?? 0
