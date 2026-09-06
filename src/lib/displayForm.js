// The one definition of "which written form of a dictionary entry to show".
//
// It lives here, free of any Supabase import, so the Node scripts that need to
// predict what a card will render (resolve-textbook-vocab, verify-textbook-vocab)
// can import the same function the app uses instead of keeping their own copy.
// Three copies had already drifted apart once.
//
// Two independent JMdict signals, in order of authority:
//
//   `uk` (sense-level, "usually written using kana alone") — the word itself is
//   normally written in kana, so show the reading: ちょっと not 一寸.
//
//   `preferred_form` (backfilled from each kanji form's own rK/sK/oK/iK tags,
//   see scripts/backfill-preferred-form.mjs) — the word does take kanji, but
//   `primary_form` happens to be a spelling nobody uses: それから not 其れから.
//
// A NULL `preferred_form` means primary_form was already right, which is the
// case for 99.4% of entries.
export function displayFormOf(row) {
  if (!row) return null
  if ((row.misc0 ?? []).includes('uk')) return row.kana_forms?.[0] ?? row.primary_form
  return row.preferred_form ?? row.primary_form
}

// Every column displayFormOf reads. Query helpers select at least these.
export const DISPLAY_FORM_COLUMNS = 'primary_form, preferred_form, kana_forms, misc0:senses->0->misc'

// What one card shows, from its word record and its dictionary entry.
//
// A word carries at most two hints, both set at import time and both meaning
// "this is how the textbook writes it":
//
//   `kanji` — one of the forms the entry itself lists, chosen because the book
//   uses that one: 登る rather than 上る, けんか rather than 喧嘩.
//
//   `mark` — the book decorates the word to show how it is used (〜枚 for a
//   counter, きれい（な） for a na-adjective). A template with `{}` where the
//   form goes, so a leading, trailing or wrapping decoration all work.
//
//   `suru` — the book teaches this as a する-verb. JMdict files those under the
//   bare noun (勉強 covers 勉強する), so the entry is right but the form is a
//   stem; appending する restores what the book prints, and the verb reading it
//   is actually drilled with. Without it 勉強する is drilled as the noun 勉強.
//
// The reading is extended in step with the form so furigana still lines up.
export function cardFormOf(word, entry) {
  const suffix = word?.suru ? 'する' : ''
  const form = word?.kanji ?? displayFormOf(entry)
  const reading = word?.kana ?? entry?.kana_forms?.[0]
  const decorate = t => (t == null ? null : word?.mark ? word.mark.replace('{}', t + suffix) : t + suffix)
  return { form: decorate(form), reading: decorate(reading) }
}

// Decoration is display, not sound: 〜 in 〜枚 marks a counter and （な） marks a
// na-adjective, and neither is spoken. する is, so it stays.
const SPOKEN_DECORATION = /[〜~～（）()]/gu

/** What a card's audio should actually say. */
export function speechTextOf(word, entry) {
  const { reading } = cardFormOf(word, entry)
  return reading ? reading.replace(SPOKEN_DECORATION, '').trim() || null : null
}

/**
 * Storage key for a clip of `text`.
 *
 * Audio is keyed by what is spoken rather than by which word wanted it, so one
 * reading is stored once however many lists use it — 勉強 and 勉強する are
 * different clips, while 〜枚 and 枚 are the same one.
 *
 * It is a hash because Supabase Storage rejects a non-ASCII object key, and
 * percent-encoding does not help: the client decodes the escapes before
 * validating. Two FNV-1a passes, forward and reverse with different offsets,
 * give 64 bits — ample for a few thousand readings, and the generator asserts
 * that no two readings collide rather than trusting that.
 *
 * Non-cryptographic on purpose: it must be computable synchronously while
 * rendering a card, and crypto.subtle is async.
 */
export function audioKeyFor(text) {
  if (!text) return null
  const bytes = new TextEncoder().encode(text)
  const fnv = (offset, reverse) => {
    let h = offset
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[reverse ? bytes.length - 1 - i : i]
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }
  return fnv(0x811c9dc5, false) + fnv(0x9dc5811c, true)
}
