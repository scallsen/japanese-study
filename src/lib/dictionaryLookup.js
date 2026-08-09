const SELECT = 'id, primary_form, kana_forms, gloss_en, pos, common'

// Prefers common entries, then shorter primary forms (favors the simpler/more
// likely-intended reading when multiple dictionary rows match the same base).
export function pickBestDictionaryMatch(rows) {
  if (!rows.length) return null
  return rows.slice().sort((a, b) => (b.common === true) - (a.common === true) || a.primary_form.length - b.primary_form.length)[0]
}

// Two-stage dictionary lookup shared by every base-form → JMdict-entry resolver
// in the app: primary_form exact match, then kana_forms GIN overlap for bases
// whose JMdict primary form is kanji but the base itself is kana (e.g. ある → 有る).
// `client` is an injected Supabase client so this works from both browser code
// and Node scripts. Returns a Map<base, row>.
export async function lookupDictionaryEntries(client, bases, { select = SELECT } = {}) {
  const found = new Map()
  if (!bases.length) return found

  const { data: primaryRows, error: primaryError } = await client
    .from('dictionary').select(select).in('primary_form', bases)
  if (primaryError) throw primaryError
  for (const base of bases) {
    const best = pickBestDictionaryMatch((primaryRows ?? []).filter(r => r.primary_form === base))
    if (best) found.set(base, best)
  }

  const remaining = bases.filter(b => !found.has(b))
  if (remaining.length) {
    const { data: kanaRows, error: kanaError } = await client
      .from('dictionary').select(select).overlaps('kana_forms', remaining)
    if (kanaError) throw kanaError
    for (const base of remaining) {
      const best = pickBestDictionaryMatch((kanaRows ?? []).filter(r => r.kana_forms.includes(base)))
      if (best) found.set(base, best)
    }
  }

  return found
}
