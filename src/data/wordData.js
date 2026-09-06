import GENKI_1 from './words/genki_1_vocab.json'
import GENKI_2 from './words/genki_2_vocab.json'
import NSM_N3_KANJI from './words/nsm_n3_kanji_vocab.json'

// The published textbooks this app ships. A learner's own course lists are not
// here: they belong to one account and load from it at runtime (useCustomWords),
// so they are neither downloaded by other visitors nor mixed into this pool.
export const WORD_DATA = [...GENKI_1, ...GENKI_2, ...NSM_N3_KANJI]
