import { displayFormOf } from './displayForm.js'

// --- reading what a textbook prints -------------------------------------------------------
// Each rule records itself when it fires, so the report can show exactly what
// was rewritten before matching rather than silently altering the input.
const RULES = [
  ['na-suffix', s => s.replace(/[（(]な[）)]\s*$/u, '')],
  ['wo-prefix', s => s.replace(/^[（(][〜~～]?を[）)]\s*/u, '')],
  ['plus-negative', s => s.replace(/\s*[+＋]\s*negative\s*$/iu, '')],
  ['tilde', s => s.replace(/[〜~～]/gu, '')],
  ['paren', s => s.replace(/[（(][^）)]*[）)]/gu, '')],
]

export function normalise(raw) {
  let s = (raw ?? '').trim()
  const applied = []
  for (const [name, fn] of RULES) {
    const next = fn(s)
    if (next !== s) { applied.push(name); s = next }
  }
  s = s.replace(/[\s\u3000]+/gu, '').trim()
  // A slashed field lists alternative readings of one word (なん／なに).
  const parts = s.split(/[／/]/u).map(p => p.trim()).filter(Boolean)
  const forms = parts.length ? parts : [s]
  return { forms, derived: derivedForms(forms), applied }
}

// JMdict stores a する-verb as its noun tagged `vs` (勉強 covers 勉強する), so the
// full textbook form never matches but the stem does. Tried only after the form
// as written fails, so a word that is genuinely its own entry still wins.
function derivedForms(forms) {
  const out = []
  for (const f of forms) {
    const m = f.match(/^(.{2,})(?:をする|する)$/u)
    if (m) out.push(m[1])
  }
  return out
}


// Latin letters are full-width in JMdict (Ｔシャツ) and ASCII in a textbook
// (Tシャツ). Folding the width before comparing lets the book's spelling be
// recognised as the entry's own form rather than reported as a mismatch.
const fold = t => t.replace(/[Ａ-Ｚａ-ｚ０-９]/gu, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))

// Decides how a card should be written, given the entry it resolved to and the
// form its textbook prints. Shared by every textbook importer, so the rules
// below are stated once rather than re-derived per book.
//
//   entry      the dictionary row the word matched
//   bookForm   the book's spelling, normalised (markers already stripped)
//   rawBook    the book's spelling as printed, markers and all
//   stem       the する-stem, when the book prints a する-verb
//
// Returns the display fields a word record should carry: `kanji` (which of the
// entry's own forms to show), `kana` (when that form is itself a reading),
// `suru`, `mark` (the decoration template) and `modified` (nothing the entry
// lists is written the way the book writes it).
export function chooseBookForm({ entry, bookForm, rawBook, stem }) {
  const out = {}
  const shown = entry ? displayFormOf(entry) : null
  if (!entry || !bookForm || !shown) return out

  if (bookForm !== shown) {
    const forms = [...(entry.kanji_forms ?? []), ...(entry.kana_forms ?? [])]
    const folded = new Set(forms.map(fold))

    // JMdict lists several written forms for one word — のぼる is 上る/登る/昇る,
    // 五日 is ５日/五日 — and a textbook teaches one of them. Keeping the book's
    // choice selects among JMdict's own forms rather than storing the book's
    // text, and is revalidated on every run.
    if (forms.includes(bookForm) || folded.has(fold(bookForm))) out.kanji = bookForm
    // A する-verb is filed under its bare noun, so the full form is never
    // listed while the stem usually is (勉強 for 勉強する; けんか, in kana, for
    // けんかする).
    else if (stem && forms.includes(stem)) { out.kanji = stem; out.suru = true }
    else {
      // A book prints a word with the particle it is used with — ほかの,
      // 授業中に — which JMdict never includes. The entry is already settled,
      // so trimming the tail changes only how the card is written.
      for (let n = 1; n <= 2 && !out.kanji; n++) {
        const head = bookForm.slice(0, -n)
        if (head.length >= 2 && forms.includes(head)) out.kanji = head
      }
    }

    if (!out.kanji) out.modified = true
    // When the form kept is itself a kana form, it IS the reading — 皆 lists
    // both みな and みんな, and the book using the second made みんなで read みなで.
    if (out.kanji && (entry.kana_forms ?? []).includes(out.kanji)) out.kana = out.kanji
  }

  // Whatever decoration the book puts around the word, back where it had it:
  // 〜枚 for a counter, きれい（な） for a na-adjective, そんな〜 for a prenominal.
  const core = (out.kanji ?? bookForm) + (out.suru ? 'する' : '')
  const at = rawBook ? rawBook.indexOf(core) : -1
  if (at >= 0 && rawBook !== core) {
    const mark = `${rawBook.slice(0, at)}{}${rawBook.slice(at + core.length)}`
    // 〜 and （な） are how the book writes the word; "+ negative" is an English
    // note about how it is used and does not belong on a card face.
    if (!/[A-Za-z]/.test(mark)) out.mark = mark
  }

  return out
}
