const KANJI_RE = /[一-鿿㐀-䶿]/

function isKanji(ch) {
  return KANJI_RE.test(ch)
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Splits a string into runs of consecutive kanji / non-kanji characters.
function segment(str) {
  const segments = []
  let i = 0
  while (i < str.length) {
    const kanji = isKanji(str[i])
    let j = i + 1
    while (j < str.length && isKanji(str[j]) === kanji) j++
    segments.push({ kanji, text: str.slice(i, j) })
    i = j
  }
  return segments
}

// Returns an array of parts describing how to render `kanjiStr` with furigana
// from `kanaStr`, or null if `kanjiStr` has no kanji. Each part is either
//   { type: 'kanji', text, furigana } — render as <ruby>text<rt>furigana</rt></ruby>
//   { type: 'kana', text }            — render as plain text
//
// Handles compound words with multiple, non-adjacent kanji runs (e.g. 引き算
// = 引 + き + 算) by matching a regex built from the kanji/kana segments
// against the full reading: kana runs anchor the match literally, kanji runs
// become non-greedy wildcard capture groups.
export function buildFurigana(kanjiStr, kanaStr) {
  const segments = segment(kanjiStr)
  if (!segments.some(s => s.kanji)) return null

  const pattern = '^' + segments.map(s => (s.kanji ? '(.+?)' : escapeRegExp(s.text))).join('') + '$'
  const match = kanaStr.match(new RegExp(pattern))
  if (!match) return null

  let group = 1
  return segments.map(s => (
    s.kanji ? { type: 'kanji', text: s.text, furigana: match[group++] } : { type: 'kana', text: s.text }
  ))
}
