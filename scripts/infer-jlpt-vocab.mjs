#!/usr/bin/env node
/**
 * Approximates JLPT levels for compound/derived words that scripts/import-jlpt-vocab.mjs
 * left untagged (Waller's list only tags root vocabulary — e.g. 刺激 is N3
 * but 刺激的/刺激性/刺激剤 etc. aren't listed at all; 三人/私たち are number+counter
 * and pronoun+suffix compounds that aren't individually listed either).
 *
 * Approach: for each untagged word, try stripping 1 then 2 trailing
 * characters off each of its kanji forms and look up the remainder against
 * words that already have a DIRECT jlpt_level (never chains through a
 * previously-inferred one, to avoid drift). A candidate root only counts if
 * it's reading-verified — the word's own kana_forms must contain a reading
 * that starts with the candidate root's reading — which is what makes this
 * safe to trust: primary_form alone is not enough. Tested live against this
 * app's own data: 人 has 4 separate dictionary entries whose levels range
 * from N5 (noun "person") to N1 (counter-suffix sense), and 私 has 11
 * entries (different readings — わたし/わたくし/あたし/etc.) spanning N5 to N1
 * to untagged — a bare kanji-substring match with no reading check would
 * regularly grab the wrong sense's level. If multiple reading-verified
 * candidates disagree on level, the word is skipped rather than guessed.
 *
 * Inferred rows are flagged via jlpt_level_inferred so the UI can render
 * them distinctly (e.g. dimmer / "~N3") from directly-sourced tags — this
 * is an approximation of an approximation, one step further from Waller's
 * already-unofficial data, and should never be presented with equal
 * confidence.
 *
 * Run once (or re-run after import-jlpt-vocab.mjs adds new direct tags):
 *   node --env-file=.env scripts/infer-jlpt-vocab.mjs
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *
 * Before running for the first time, add the column in the Supabase SQL editor:
 *
 *   ALTER TABLE dictionary ADD COLUMN IF NOT EXISTS jlpt_level_inferred boolean NOT NULL DEFAULT false;
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const PAGE_SIZE = 1000
const ID_BATCH = 200
// Capped at 2 — long enough to cover common single/double-character suffixes
// (的, 性, 化, 者, 人, 達/たち), short enough that a coincidental (rather than
// truly derived) match against an unrelated real word stays unlikely.
const MAX_STRIP = 2

async function fetchAll(select, filterFn) {
  const rows = []
  let offset = 0
  for (;;) {
    let q = supabase.from('dictionary').select(select).order('id').range(offset, offset + PAGE_SIZE - 1)
    q = filterFn(q)
    const { data, error } = await q
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return rows
}

function buildRootsMap(roots) {
  const map = new Map()
  for (const root of roots) {
    const forms = root.kanji_forms?.length ? root.kanji_forms : [root.primary_form]
    for (const form of forms) {
      if (!map.has(form)) map.set(form, [])
      map.get(form).push(root)
    }
  }
  return map
}

function inferLevel(candidate, rootsMap) {
  for (let stripLen = 1; stripLen <= MAX_STRIP; stripLen++) {
    const verified = []
    for (const kanjiForm of candidate.kanji_forms) {
      if (kanjiForm.length <= stripLen) continue
      const sub = kanjiForm.slice(0, kanjiForm.length - stripLen)
      const rootCandidates = rootsMap.get(sub)
      if (!rootCandidates) continue
      for (const root of rootCandidates) {
        const match = root.kana_forms?.some(rk => candidate.kana_forms?.some(ck => ck.startsWith(rk)))
        if (match) verified.push(root)
      }
    }
    if (!verified.length) continue
    const levels = new Set(verified.map(r => r.jlpt_level))
    if (levels.size === 1) return [...levels][0]
    return null // disagreement at this strip length — skip rather than guess
  }
  return null
}

async function main() {
  console.log('Fetching directly-tagged roots...')
  const roots = await fetchAll('id, primary_form, kanji_forms, kana_forms, jlpt_level', q =>
    q.not('jlpt_level', 'is', null).eq('jlpt_level_inferred', false)
  )
  console.log(`  ${roots.length} directly-tagged roots`)
  const rootsMap = buildRootsMap(roots)

  console.log('Fetching untagged candidates...')
  const candidates = await fetchAll('id, kanji_forms, kana_forms', q => q.is('jlpt_level', null))
  console.log(`  ${candidates.length} untagged words total`)

  const updates = []
  for (const c of candidates) {
    if (!c.kanji_forms?.length) continue // stripping only applies to words with a kanji form
    const level = inferLevel(c, rootsMap)
    if (level) updates.push({ id: c.id, jlpt_level: level })
  }
  console.log(`Inferred levels for ${updates.length} words`)

  const idsByLevel = new Map()
  for (const u of updates) {
    if (!idsByLevel.has(u.jlpt_level)) idsByLevel.set(u.jlpt_level, [])
    idsByLevel.get(u.jlpt_level).push(u.id)
  }
  for (const [level, ids] of idsByLevel) {
    for (let i = 0; i < ids.length; i += ID_BATCH) {
      const chunk = ids.slice(i, i + ID_BATCH)
      const { error } = await supabase.from('dictionary').update({ jlpt_level: level, jlpt_level_inferred: true }).in('id', chunk)
      if (error) throw error
    }
    console.log(`  ${level}: inferred ${ids.length} words`)
  }
  console.log('Done.')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
