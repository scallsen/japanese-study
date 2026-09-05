import Anthropic from 'npm:@anthropic-ai/sdk@0.104.1'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as kuromoji from 'npm:@patdx/kuromoji@1.0.4'
import { requireUser, authErrorResponse } from '../_shared/auth.ts'
import { consumeAiBudget, refundAiBudget, quotaErrorResponse } from '../_shared/quota.ts'
import { getUserApiKey } from '../_shared/userKey.ts'

const DEFAULT_MODEL = Deno.env.get('WORD_IMPORT_MODEL') || 'claude-sonnet-5'
const MAX_WORDS = 60
// The client sends a camera photo as-is with no resize, and image bytes are
// billed as input tokens, so an unbounded upload is an unbounded bill.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')

// Dictionary files fetched at cold start (~18 MB from jsDelivr, cached per
// warm instance) — same tokenizer setup as story-generate. Duplicated rather
// than shared, matching this codebase's existing pattern of independent
// dictionary-lookup implementations (see lookupVocabulary.js / fetch-nhk.mjs).
const DICT_CDN = 'https://cdn.jsdelivr.net/npm/@aiktb/kuromoji@1.0.2/dict/'

let tokenizerPromise: Promise<any> | null = null
function getTokenizer() {
  tokenizerPromise ??= new kuromoji.TokenizerBuilder({
    loader: {
      async loadArrayBuffer(url: string): Promise<ArrayBufferLike> {
        const res = await fetch(DICT_CDN + url.replace('.gz', ''))
        if (!res.ok) throw new Error(`Failed to fetch dictionary file ${url}: ${res.status}`)
        return res.arrayBuffer()
      },
    },
  }).build()
  return tokenizerPromise
}

const PARTICLE_POS = new Set(['助詞', '助動詞', '記号', 'BOS/EOS'])
const HAS_JAPANESE = /[一-龯㐀-䶿々ぁ-んァ-ヶー]/

function katakanaToHiragana(str: string): string {
  return (str ?? '').replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

// Tokenizes text into unique content words, keyed by dictionary base form.
// Mirrors tokenizeStory's content-word filter (story-generate/index.ts) but
// collapses to one entry per base form instead of a full token stream.
function extractCandidateWords(tokenizer: any, text: string) {
  const seen = new Map<string, { base: string; surface: string; reading: string | null }>()
  for (const tok of tokenizer.tokenize(text)) {
    if (PARTICLE_POS.has(tok.pos)) continue
    const surface = tok.surface_form.trim()
    if (!surface || !HAS_JAPANESE.test(surface)) continue
    const base = tok.basic_form && tok.basic_form !== '*' ? tok.basic_form : surface
    if (seen.has(base)) continue
    const reading = tok.reading ? katakanaToHiragana(tok.reading) : null
    seen.set(base, { base, surface, reading })
    if (seen.size >= MAX_WORDS) break
  }
  return [...seen.values()]
}

function pickBest(rows: any[]) {
  if (!rows.length) return null
  return rows.slice().sort((a, b) => (b.common === true) - (a.common === true) || a.primary_form.length - b.primary_form.length)[0]
}

// Two-stage JMdict lookup mirroring lookupVocabulary.js: primary_form match
// on the base form, then kana_forms GIN overlap for kana bases whose JMdict
// primary form is kanji (e.g. ある → 有る).
async function lookupDictionary(supabase: any, bases: string[]) {
  const found = new Map<string, any>()
  if (!bases.length) return found

  const { data: primaryRows, error: primaryError } = await supabase
    .from('dictionary').select('id, primary_form, kana_forms, gloss_en, common').in('primary_form', bases)
  if (primaryError) console.error('[word-import] primary_form query failed:', primaryError)
  for (const base of bases) {
    const best = pickBest((primaryRows ?? []).filter((r: any) => r.primary_form === base))
    if (best) found.set(base, best)
  }

  const remaining = bases.filter(b => !found.has(b))
  if (remaining.length) {
    const { data: kanaRows, error: kanaError } = await supabase
      .from('dictionary').select('id, primary_form, kana_forms, gloss_en, common').overlaps('kana_forms', remaining)
    if (kanaError) console.error('[word-import] kana_forms query failed:', kanaError)
    for (const base of remaining) {
      const best = pickBest((kanaRows ?? []).filter((r: any) => r.kana_forms.includes(base)))
      if (best) found.set(base, best)
    }
  }

  return found
}

const OCR_SYSTEM_PROMPT = `You are an OCR engine for Japanese text. Extract every piece of Japanese text visible in the image, preserving reading order and line breaks. Output only the extracted text — no commentary, translation, or markdown. If no Japanese text is visible, output an empty string.`

const OCR_SCHEMA = {
  type: 'object',
  properties: { text: { type: 'string' } },
  required: ['text'],
  additionalProperties: false,
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function ocrImage(client: Anthropic, image: string, mediaType: string, model: string) {
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: OCR_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: 'Extract the Japanese text from this image.' },
        ],
      },
    ],
    output_config: { format: { type: 'json_schema', schema: OCR_SCHEMA } },
  })

  if (response.stop_reason === 'refusal') throw new Error('The model declined to read this image.')
  const textBlock = response.content.find((b: any) => b.type === 'text')
  if (!textBlock) throw new Error('Empty OCR response')
  return JSON.parse(textBlock.text).text as string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const user = await requireUser(req)

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Server misconfigured: missing Supabase service role credentials' }, 500)
    }

    const { mode, text, image, mediaType, model = DEFAULT_MODEL } = await req.json()

    let sourceText: string
    if (mode === 'image') {
      if (!image || !mediaType) return jsonResponse({ error: 'image and mediaType are required for mode "image"' }, 400)
      // base64 encodes 3 bytes as 4 chars; padding makes this a slight
      // over-estimate of the decoded size, which is the safe direction.
      if (Math.floor(image.length * 3 / 4) > MAX_IMAGE_BYTES) {
        return jsonResponse({ error: 'Image is too large. Please use an image under 5 MB.' }, 413)
      }
      // Image mode only. Text mode below makes no Anthropic call at all, so
      // charging it would be charging for Kuromoji and a dictionary lookup.
      // A user on their own key pays Anthropic directly and isn't metered.
      const userKey = await getUserApiKey(user.id)
      await consumeAiBudget(user.id, 'word-import-image', Boolean(userKey))
      const client = new Anthropic({ apiKey: userKey ?? Deno.env.get('ANTHROPIC_API_KEY') })
      try {
        sourceText = await ocrImage(client, image, mediaType, model)
      } catch (err) {
        await refundAiBudget(user.id, 'word-import-image', Boolean(userKey))
        throw err
      }
    } else if (mode === 'text') {
      if (!text || typeof text !== 'string') return jsonResponse({ error: 'text is required for mode "text"' }, 400)
      sourceText = text
    } else {
      return jsonResponse({ error: 'mode must be "text" or "image"' }, 400)
    }

    if (!sourceText.trim()) return jsonResponse({ words: [], truncated: false })

    const tokenizer = await getTokenizer()
    const candidates = extractCandidateWords(tokenizer, sourceText)
    const truncated = candidates.length >= MAX_WORDS

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const found = await lookupDictionary(supabase, candidates.map(c => c.base))

    const words = candidates.map((c, i) => {
      const row = found.get(c.base)
      return {
        id: `w${i}`,
        surface: c.surface,
        reading: c.reading || row?.kana_forms?.[0] || '',
        meaning: row?.gloss_en ?? '',
        jmdictId: row?.id ?? null,
      }
    })

    return jsonResponse({ words, truncated })
  } catch (err) {
    const denied = authErrorResponse(err, jsonResponse) ?? quotaErrorResponse(err, jsonResponse)
    if (denied) return denied
    console.error('[word-import]', err)
    return jsonResponse({ error: err?.message || 'Word extraction failed' }, 500)
  }
})
