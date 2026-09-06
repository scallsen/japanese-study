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
  return {
    form: form == null ? null : form + suffix,
    reading: reading == null ? null : reading + suffix,
  }
}
