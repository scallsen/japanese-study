import { createClient } from 'npm:@supabase/supabase-js@2'
import { enforceRateLimit, rateLimitErrorResponse } from '../_shared/rateLimit.ts'

// On-demand sync: fetches one episode's vocabulary from Jiten.moe, resolves
// each word to a `dictionary.id` (JMdict), and upserts into
// `media_vocab_occurrence`. Called once per episode (gated by
// media_episode.synced_at) — after that, the client reads
// `media_vocab_occurrence` directly via Supabase's public-read RLS policy,
// no further edge function calls needed. Duplicated fetch/classification/
// resolution logic from src/modules/anime-vocab/providers/*.js and
// scripts/import-anime-vocab.mjs's `syncEpisodeVocab` — kept in sync
// manually, see anime-media-browse for why edge functions duplicate rather
// than share.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
const JITEN_API_KEY = Deno.env.get('JITEN_API_KEY')
const PROVIDER = 'jiten'
const VOCAB_PAGE_SIZE = 200

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

async function fetchVocabList(episodeExternalId: string) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (JITEN_API_KEY) headers['X-Api-Key'] = JITEN_API_KEY

  const words: any[] = []
  const seenWordIds = new Set<number>()
  let offset = 0
  for (;;) {
    const res = await fetch(
      `https://api.jiten.moe/api/media-deck/${episodeExternalId}/vocabulary?limit=${VOCAB_PAGE_SIZE}&sortBy=deckFreq&offset=${offset}`,
      { headers },
    )
    if (res.status === 429) throw new Error('Jiten rate limit exceeded — try again shortly')
    if (!res.ok) throw new Error(`Jiten vocabulary fetch failed (${res.status})`)
    const body = (await res.json()).data
    const page = body.words ?? []
    // Jiten's pagination sort isn't perfectly stable at page boundaries —
    // confirmed live: the same wordId can appear on two consecutive pages.
    for (const w of page) {
      if (seenWordIds.has(w.wordId)) continue
      seenWordIds.add(w.wordId)
      words.push(w)
    }
    if (page.length < VOCAB_PAGE_SIZE) break
    offset += VOCAB_PAGE_SIZE
  }
  return words
}

// readingType: 0 = kanji form, 1 = kana-only form (confirmed live against Jiten).
function extractWordForms(word: any) {
  const all = [word.mainReading, ...(word.alternativeReadings ?? [])].filter(Boolean)
  const sorted = all.slice().sort((a: any, b: any) => (a.frequencyRank ?? Infinity) - (b.frequencyRank ?? Infinity))
  return {
    kanjiForms: sorted.filter((f: any) => f.readingType === 0).map((f: any) => f.text),
    kanaForms: sorted.filter((f: any) => f.readingType === 1).map((f: any) => f.text),
  }
}

const GRAMMAR_TAGS = new Set([
  'particle', 'conjunction', 'auxiliary verb', 'auxiliary adjective', 'auxiliary',
  'copula', 'interjection (kandoushi)', 'prefix', 'suffix', 'counter',
])
function classifyPos(partsOfSpeech: string[] | undefined) {
  const tags = partsOfSpeech ?? []
  return { isGrammar: tags.some(t => GRAMMAR_TAGS.has(t)), isName: tags.some(t => /name$/i.test(t)) }
}

const DICT_SELECT = 'id, primary_form, kanji_forms, kana_forms, common'
function pickBest(rows: any[]) {
  if (!rows.length) return null
  return rows.slice().sort((a, b) => (b.common === true ? 1 : 0) - (a.common === true ? 1 : 0) || a.primary_form.length - b.primary_form.length)[0]
}

// 50, not the 200 other id-batched lookups in this codebase use — kanji/kana
// forms percent-encode to ~9 URL chars each, and 200 of them can push the
// request past PostgREST's ~16KB header limit (confirmed live: HeadersOverflowError).
async function fetchByPrimaryForm(supabase: any, forms: string[]) {
  const map = new Map<string, any[]>()
  const unique = [...new Set(forms)]
  const BATCH = 50
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH)
    if (!chunk.length) continue
    const { data, error } = await supabase.from('dictionary').select(DICT_SELECT).in('primary_form', chunk)
    if (error) throw error
    for (const row of data ?? []) {
      if (!map.has(row.primary_form)) map.set(row.primary_form, [])
      map.get(row.primary_form)!.push(row)
    }
  }
  return map
}

async function fetchByKanaForm(supabase: any, kanas: string[]) {
  const map = new Map<string, any[]>()
  const unique = [...new Set(kanas)]
  const BATCH = 50
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH)
    if (!chunk.length) continue
    const { data, error } = await supabase.from('dictionary').select(DICT_SELECT).overlaps('kana_forms', chunk)
    if (error) throw error
    for (const row of data ?? []) {
      for (const k of row.kana_forms) {
        if (!chunk.includes(k)) continue
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(row)
      }
    }
  }
  return map
}

// Mirrors src/modules/anime-vocab/providers/resolveJmdictIds.js: reading-verified
// primary_form match first, then kana_forms overlap fallback. Never drops a word.
async function resolveJmdictIds(supabase: any, words: any[]) {
  const formsByWordId = new Map(words.map(w => [w.wordId, extractWordForms(w)]))
  const result = new Map<number, { jmdictId: string | null; surfaceForm: string }>()

  const allKanji = [...formsByWordId.values()].flatMap(f => f.kanjiForms)
  const byPrimaryForm = await fetchByPrimaryForm(supabase, allKanji)

  const needsKanaFallback: any[] = []
  for (const word of words) {
    const { kanjiForms, kanaForms } = formsByWordId.get(word.wordId)!
    let matched: any = null
    for (const kanji of kanjiForms) {
      const candidates = byPrimaryForm.get(kanji) ?? []
      if (!candidates.length) continue
      const verified = kanaForms.length ? candidates.filter((r: any) => kanaForms.some((k: string) => r.kana_forms.includes(k))) : candidates
      if (verified.length) { matched = pickBest(verified); break }
    }
    if (matched) result.set(word.wordId, { jmdictId: matched.id, surfaceForm: kanjiForms[0] ?? kanaForms[0] ?? word.mainReading?.text })
    else needsKanaFallback.push(word)
  }

  if (needsKanaFallback.length) {
    const fallbackKana = needsKanaFallback.flatMap(w => formsByWordId.get(w.wordId)!.kanaForms)
    const byKanaForm = await fetchByKanaForm(supabase, fallbackKana)

    for (const word of needsKanaFallback) {
      const { kanjiForms, kanaForms } = formsByWordId.get(word.wordId)!
      let matched: any = null
      for (const kana of kanaForms) {
        let candidates = byKanaForm.get(kana) ?? []
        if (!candidates.length) continue
        if (kanjiForms.length) {
          candidates = candidates.filter((r: any) => kanjiForms.some((k: string) => r.kanji_forms.includes(k)) || r.kanji_forms.length === 0)
        } else if (candidates.length > 1) {
          const kanaOnly = candidates.filter((r: any) => r.kanji_forms.length === 0)
          candidates = kanaOnly.length === 1 ? kanaOnly : []
        }
        if (candidates.length) { matched = pickBest(candidates); break }
      }
      result.set(word.wordId, { jmdictId: matched?.id ?? null, surfaceForm: kanjiForms[0] ?? kanaForms[0] ?? word.mainReading?.text })
    }
  }

  return result
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    // The expensive one: a single call fans out to 10+ Jiten requests at 200
    // vocabulary rows a page, which is why its limits are the tightest.
    await enforceRateLimit(req, 'anime-vocab-sync')

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Server misconfigured: missing Supabase service role credentials' }, 500)
    }
    const { mediaEpisodeId } = await req.json()
    if (!mediaEpisodeId) return jsonResponse({ error: 'mediaEpisodeId is required' }, 400)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: episode, error: episodeErr } = await supabase.from('media_episode').select('*').eq('id', mediaEpisodeId).maybeSingle()
    if (episodeErr) throw episodeErr
    if (!episode) return jsonResponse({ error: 'Episode not found' }, 404)
    if (episode.synced_at) return jsonResponse({ synced: true, alreadySynced: true })

    const words = await fetchVocabList(episode.provider_deck_id)
    const resolved = await resolveJmdictIds(supabase, words)

    const rows = words.map((w: any, i: number) => {
      const r = resolved.get(w.wordId)
      const { isGrammar, isName } = classifyPos(w.partsOfSpeech)
      return {
        media_episode_id: episode.id,
        provider: PROVIDER,
        provider_word_id: String(w.wordId),
        jmdict_id: r?.jmdictId ?? null,
        surface_form: r?.surfaceForm ?? w.mainReading?.text ?? `unknown-${w.wordId}`,
        occurrence_count: w.occurrences ?? null,
        frequency_rank: i,
        global_frequency_rank: w.mainReading?.frequencyRank ?? null,
        is_grammar: isGrammar,
        is_name: isName,
        raw: w,
      }
    })

    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error } = await supabase.from('media_vocab_occurrence').upsert(batch, { onConflict: 'media_episode_id,provider,provider_word_id' })
      if (error) throw error
    }

    const { error: touchErr } = await supabase.from('media_episode').update({ synced_at: new Date().toISOString() }).eq('id', episode.id)
    if (touchErr) throw touchErr

    return jsonResponse({ synced: true, wordCount: rows.length })
  } catch (err) {
    const limited = rateLimitErrorResponse(err, jsonResponse)
    if (limited) return limited
    console.error('[anime-episode-vocab-sync]', err)
    return jsonResponse({ error: err?.message || 'Vocab sync failed' }, 500)
  }
})
