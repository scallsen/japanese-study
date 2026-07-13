import NSM_N3 from './words/nsm_n3_vocab.json'
import NSM_N3_I4_RAW from './words/nsm_n3_i4_vocab.json'
import NSM_N3_I5 from './words/nsm_n3_i5_vocab.json'

const NSM_N3_I4 = NSM_N3_I4_RAW.map(w => ({
  ...w,
  id: `i4-${w.id}`,
  listKey: w.listKey.replace('nsm-n3-', 'nsm-n3-i4-'),
}))

export const WORD_DATA = [...NSM_N3, ...NSM_N3_I4, ...NSM_N3_I5]
