#!/usr/bin/env node
/**
 * Reads back the generated word files and prints what each card will ACTUALLY
 * render — display form (with the `uk` rule applied), reading and gloss, all
 * resolved from `dictionary` exactly as the app resolves them. The resolver
 * decides; this is the independent check on what it decided.
 *
 * Run: node --env-file=.env scripts/verify-textbook-vocab.mjs [filter]
 * `filter` matches a listKey or a rendered form, e.g. `l12` or `かぜ`.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { cardFormOf, DISPLAY_FORM_COLUMNS } from '../src/lib/displayForm.js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? process.env.SUPABASE_SECRET_KEY
  ?? process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const FILES = ['src/data/words/genki_1_vocab.json', 'src/data/words/genki_2_vocab.json']
const filter = process.argv[2] ?? ''

const words = FILES.flatMap(f => JSON.parse(readFileSync(f, 'utf8')))
const ids = [...new Set(words.map(w => w.jmdictId))]

const rows = new Map()
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await supabase.from('dictionary')
    .select(`id, gloss_en, ${DISPLAY_FORM_COLUMNS}`)
    .in('id', ids.slice(i, i + 200))
  if (error) throw error
  for (const r of data ?? []) rows.set(r.id, r)
}

let missing = 0
let shown = 0
for (const w of words) {
  const r = rows.get(w.jmdictId)
  if (!r) { console.log(`  !! ${w.id}  jmdictId ${w.jmdictId} NOT FOUND in dictionary`); missing++; continue }
  const { form, reading } = cardFormOf(w, r)
  const line = `${w.listKey.padEnd(12)} ${form.padEnd(10)} ${(reading ?? '').padEnd(12)} ${(r.gloss_en ?? '').slice(0, 52)}`
  if (filter && !line.includes(filter) && !w.id.includes(filter)) continue
  console.log(`  ${line}`)
  shown++
}

console.log(`\n${words.length} words, ${ids.length} distinct entries, ${missing} unresolvable${filter ? `, ${shown} shown for "${filter}"` : ''}`)
