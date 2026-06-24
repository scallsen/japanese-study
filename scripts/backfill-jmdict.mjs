#!/usr/bin/env node
/**
 * Backfills vocabulary_ja for all existing articles using JMdict.
 * Re-tokenizes body_ja/body_simple with Kuromoji (to get basic_form),
 * looks up the Supabase `dictionary` table, and updates vocabulary_ja.
 * No Claude API calls — run after import-jmdict.mjs.
 *
 * Run once: node --env-file=.env scripts/backfill-jmdict.mjs
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 */

import { createClient } from '@supabase/supabase-js'
import kuromoji from 'kuromoji'
import { createRequire } from 'module'
import { dirname, join } from 'path'

const _require = createRequire(import.meta.url)
const KUROMOJI_DICT_PATH = join(dirname(_require.resolve('kuromoji/package.json')), 'dict')

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const PARTICLE_POS = new Set(['助詞', '助動詞', '記号', 'BOS/EOS'])

function buildTokenizerInstance() {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: KUROMOJI_DICT_PATH }).build((err, t) => {
      err ? reject(err) : resolve(t)
    })
  })
}

function katakanaToHiragana(str) {
  return (str ?? '').replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

function tokenizeTextRich(tokenizerInstance, text) {
  return tokenizerInstance.tokenize(text).map(tok => {
    const isContent = !PARTICLE_POS.has(tok.pos) && tok.surface_form.trim().length > 0
    const reading = tok.reading && tok.reading !== tok.surface_form
      ? katakanaToHiragana(tok.reading)
      : null
    const basicForm = tok.basic_form && tok.basic_form !== '*'
      ? tok.basic_form
      : tok.surface_form
    return { t: tok.surface_form, r: reading, w: isContent, b: basicForm }
  })
}

async function lookupJmdict(wordInfos) {
  if (wordInfos.size === 0) return new Map()

  const basicForms = [...new Set([...wordInfos.values()].map(v => v.basicForm))]
  const surfaceForms = [...wordInfos.keys()]
  const allForms = [...new Set([...basicForms, ...surfaceForms])]

  const { data: stage1, error: e1 } = await supabase
    .from('dictionary')
    .select('id, primary_form, kana_forms, gloss_en, pos')
    .in('primary_form', allForms)
  if (e1) throw new Error(`JMdict stage-1 lookup failed: ${e1.message}`)

  const formToRow = new Map()
  for (const row of (stage1 ?? [])) {
    formToRow.set(row.primary_form, row)
  }

  // Stage 2: kana fallback for words whose basicForm didn't match a primary_form
  // Handles cases like basicForm='ある' where JMdict primary_form is '有る'
  const missedKana = [...new Set(basicForms.filter(f => !formToRow.has(f)))]
  if (missedKana.length > 0) {
    const pgArray = '{' + missedKana.map(f => `"${f.replace(/["\\]/g, '\\$&')}"`).join(',') + '}'
    const { data: stage2, error: e2 } = await supabase
      .from('dictionary')
      .select('id, primary_form, kana_forms, gloss_en, pos')
      .filter('kana_forms', 'ov', pgArray)
    if (e2) throw new Error(`JMdict stage-2 lookup failed: ${e2.message}`)
    for (const row of (stage2 ?? [])) {
      for (const kana of row.kana_forms) {
        if (!formToRow.has(kana)) formToRow.set(kana, row)
      }
    }
  }

  const result = new Map()
  for (const [surface, { basicForm }] of wordInfos) {
    const row = formToRow.get(basicForm) ?? formToRow.get(surface) ?? null
    if (!row) continue
    const meaning = row.gloss_en?.split('; ')[0] ?? null
    const pos = Array.isArray(row.pos) && row.pos.length > 0 ? row.pos[0] : null
    result.set(surface, { jmdictId: row.id, meaning, pos })
  }
  return result
}

async function main() {
  console.log('Building Kuromoji tokenizer...')
  const tokenizer = await buildTokenizerInstance()
  console.log('Tokenizer ready.')

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, slug, body_ja, body_simple')
    .eq('active', true)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch articles:', error.message)
    process.exit(1)
  }

  console.log(`Found ${articles.length} articles to backfill.\n`)

  for (const article of articles) {
    console.log(`Processing: ${article.slug}`)
    try {
      const richJa = article.body_ja ? tokenizeTextRich(tokenizer, article.body_ja) : null
      const richSimple = article.body_simple ? tokenizeTextRich(tokenizer, article.body_simple) : null

      const wordInfos = new Map()
      for (const tok of [...(richJa ?? []), ...(richSimple ?? [])]) {
        if (tok.w && !wordInfos.has(tok.t)) {
          wordInfos.set(tok.t, { reading: tok.r ?? null, basicForm: tok.b })
        }
      }

      let vocabularyJa = null
      if (wordInfos.size > 0) {
        const jmdictMap = await lookupJmdict(wordInfos)
        vocabularyJa = [...wordInfos.entries()].map(([word, { reading }]) => {
          const j = jmdictMap.get(word) ?? null
          return {
            word,
            reading,
            meaning: j?.meaning ?? null,
            jmdictId: j?.jmdictId ?? null,
            pos: j?.pos ?? null,
          }
        }).filter(e => e.meaning)
        console.log(`  ${jmdictMap.size}/${wordInfos.size} words matched in JMdict.`)
      }

      const { error: updateError } = await supabase
        .from('articles')
        .update({ vocabulary_ja: vocabularyJa })
        .eq('id', article.id)

      if (updateError) {
        console.warn(`  Update failed: ${updateError.message}`)
      } else {
        console.log(`  Done.`)
      }
    } catch (err) {
      console.warn(`  Failed: ${err.message}`)
    }
  }

  console.log('\nBackfill complete.')
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
