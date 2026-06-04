const KANJI_RE = /[一-鿿㐀-䶿]/

function isKanji(ch) {
  return KANJI_RE.test(ch)
}

// Returns { prefix, kanjiPart, furigana, okurigana } or null if no kanji found.
// prefix: leading hiragana/katakana before the kanji block (e.g. "お" in "お金").
export function buildFurigana(kanjiStr, kanaStr) {
  let prefixLen = 0
  while (prefixLen < kanjiStr.length && !isKanji(kanjiStr[prefixLen])) prefixLen++

  let kanjiEnd = prefixLen
  while (kanjiEnd < kanjiStr.length && isKanji(kanjiStr[kanjiEnd])) kanjiEnd++

  if (kanjiEnd === prefixLen) return null

  const prefix    = kanjiStr.slice(0, prefixLen)
  const kanjiPart = kanjiStr.slice(prefixLen, kanjiEnd)
  const okurigana = kanjiStr.slice(kanjiEnd)
  const furigana  = kanaStr.slice(prefixLen, kanaStr.length - okurigana.length)
  if (!furigana) return null

  return { prefix, kanjiPart, furigana, okurigana }
}

// 来る stem alternation: okurigana first-char → correct reading of 来
const KURU_READINGS = { る: 'く', れ: 'く', た: 'き', て: 'き', ま: 'き', な: 'こ', よ: 'こ', ら: 'こ', さ: 'こ', い: 'こ' }

export function buildFuriganaForConjugation(conjugation, wordKanji, wordKana) {
  const base = buildFurigana(wordKanji, wordKana)
  if (!base) return null
  const fullBase = base.prefix + base.kanjiPart
  if (!conjugation.startsWith(fullBase)) return null
  const okurigana = conjugation.slice(fullBase.length)
  const furigana = base.kanjiPart === '来' ? (KURU_READINGS[okurigana[0]] ?? base.furigana) : base.furigana
  return { prefix: base.prefix, kanjiPart: base.kanjiPart, furigana, okurigana }
}
