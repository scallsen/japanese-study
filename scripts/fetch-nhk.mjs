#!/usr/bin/env node
/**
 * Uses Claude's web search tool to discover current Japanese news topics across
 * a broad range of sources (no single outlet), then uses Claude Haiku to write
 * N4-level original article bodies for each topic and generate AI fields.
 * Upserts to the Supabase `articles` table.
 *
 * Run manually: node --env-file=.env scripts/fetch-nhk.mjs
 * Runs nightly via .github/workflows/fetch-articles.yml
 *
 * Env vars required:
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *   ANTHROPIC_API_KEY
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import kuromoji from 'kuromoji'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const MAX_ARTICLES = 5
const TOPIC_DISCOVERY_MODEL = 'claude-sonnet-5'
const ARTICLE_MODEL = 'claude-haiku-4-5-20251001'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

const PARTICLE_POS = new Set(['助詞', '助動詞', '記号', 'BOS/EOS'])

function buildTokenizerInstance() {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err, t) => {
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

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

async function discoverTopics(count) {
  const params = {
    model: TOPIC_DISCOVERY_MODEL,
    max_tokens: 4000,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
    messages: [
      {
        role: 'user',
        content: `Search the web for real, current Japanese-language news stories from the last day or two. Draw from a variety of reputable Japanese news outlets and topics — do not rely on a single source. Find ${count} distinct, general-interest stories that would work well for Japanese language learners (avoid graphic, sensitive, or overly niche stories).

For each story, report the real Japanese headline as it was actually reported, a short English topic slug (kebab-case, ASCII, 2-5 words), and its approximate publish date.

After searching, reply with ONLY a raw JSON array (no markdown, no commentary) in this exact shape:
[{"headline": "Japanese headline text", "topicSlug": "kebab-case-slug", "publishedDate": "YYYY-MM-DD"}]`,
      },
    ],
  }

  let messages = params.messages
  let response = await anthropic.messages.create(params)
  while (response.stop_reason === 'pause_turn') {
    messages = [...messages, { role: 'assistant', content: response.content }]
    response = await anthropic.messages.create({ ...params, messages })
  }

  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
  const jsonStart = text.indexOf('[')
  const jsonEnd = text.lastIndexOf(']')
  if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON array in topic discovery response')
  return JSON.parse(text.slice(jsonStart, jsonEnd + 1))
}

async function generateArticle(headline, pubDate) {
  const message = await anthropic.messages.create({
    model: ARTICLE_MODEL,
    max_tokens: 1600,
    messages: [
      {
        role: 'user',
        content: `You are creating content for a Japanese study app for N4-level learners.

Based on this real Japanese news headline, write a short news article and study materials.

Headline: ${headline}
Published: ${pubDate ?? 'recently'}

Return a JSON object (raw JSON only, no markdown):
{
  "title": "The headline as-is (Japanese)",
  "title_en": "Natural English translation of the headline",
  "body_ja": "A 3-4 paragraph Japanese article about this topic. Use N4-level vocabulary and grammar. Short sentences. No unusual kanji without context. Write as if summarizing a real news story. Do not use furigana ruby tags — plain Japanese text only.",
  "body_simple": "A simplified 2-3 paragraph version of body_ja. Even simpler sentences and vocabulary, targeting N5/N4 boundary. Plain Japanese text only.",
  "summary_en": "2-3 sentence English summary of the article",
  "questions": [
    {"q": "Japanese comprehension question about the article", "a": "Answer in Japanese (1 sentence)"},
    {"q": "...", "a": "..."},
    {"q": "...", "a": "..."}
  ],
  "difficulty": <integer 1-5 where 1=N5, 2=N4, 3=N3, 4=N2, 5=N1>
}`,
      },
    ],
  })

  const raw = message.content[0].text.trim()
  const jsonStart = raw.indexOf('{')
  const jsonEnd = raw.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON in Claude response')
  return JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
}

async function getExistingSlugs() {
  const { data, error } = await supabase.from('articles').select('slug')
  if (error) throw new Error(`Supabase select failed: ${error.message}`)
  return new Set(data.map(r => r.slug))
}

async function upsertArticle(article) {
  const { error } = await supabase.from('articles').upsert(article, { onConflict: 'slug' })
  if (error) throw new Error(`Supabase upsert failed (${article.slug}): ${error.message}`)
}

async function main() {
  console.log('Building Kuromoji tokenizer...')
  const tokenizer = await buildTokenizerInstance()
  console.log('Tokenizer ready.')

  console.log('Discovering current news topics via web search...')
  const topics = await discoverTopics(MAX_ARTICLES * 2)
  console.log(`Found ${topics.length} candidate topics`)

  const existingSlugs = await getExistingSlugs()
  console.log(`Existing articles: ${existingSlugs.size}`)

  let processed = 0
  let skipped = 0

  for (const topic of topics) {
    if (processed >= MAX_ARTICLES) break

    if (!topic.headline || !topic.topicSlug) {
      skipped++
      continue
    }

    const dateStr = DATE_RE.test(topic.publishedDate ?? '')
      ? topic.publishedDate
      : new Date().toISOString().split('T')[0]
    const slug = `news-${dateStr}-${slugify(topic.topicSlug)}`

    if (existingSlugs.has(slug)) {
      skipped++
      continue
    }
    existingSlugs.add(slug)

    console.log(`Generating: ${topic.headline}`)

    let ai
    try {
      ai = await generateArticle(topic.headline, topic.publishedDate)
    } catch (err) {
      console.warn(`  Claude failed: ${err.message}`)
      continue
    }

    const publishedAt = DATE_RE.test(topic.publishedDate ?? '')
      ? new Date(topic.publishedDate).toISOString()
      : new Date().toISOString()

    const richJa = ai.body_ja ? tokenizeTextRich(tokenizer, ai.body_ja) : null
    const richSimple = ai.body_simple ? tokenizeTextRich(tokenizer, ai.body_simple) : null
    const tokensJa = richJa?.map(({ t, r, w }) => ({ t, r, w })) ?? null
    const tokensSimple = richSimple?.map(({ t, r, w }) => ({ t, r, w })) ?? null

    // Collect unique content words with their readings and basic forms from both bodies
    const wordInfos = new Map()
    for (const tok of [...(richJa ?? []), ...(richSimple ?? [])]) {
      if (tok.w && !wordInfos.has(tok.t)) {
        wordInfos.set(tok.t, { reading: tok.r ?? null, basicForm: tok.b })
      }
    }

    let vocabularyJa = null
    if (wordInfos.size > 0) {
      console.log(`  Looking up ${wordInfos.size} unique words in JMdict...`)
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
    }

    try {
      await upsertArticle({
        slug,
        source: 'news',
        title: ai.title ?? topic.headline,
        title_en: ai.title_en ?? null,
        published_at: publishedAt,
        body_ja: ai.body_ja,
        body_simple: ai.body_simple ?? null,
        summary_en: ai.summary_en ?? null,
        questions: ai.questions ?? null,
        difficulty: ai.difficulty ?? 2,
        tokens_ja: tokensJa,
        tokens_simple: tokensSimple,
        vocabulary_ja: vocabularyJa,
        active: true,
      })
      console.log(`  Done (difficulty: ${ai.difficulty})`)
      processed++
    } catch (err) {
      console.warn(`  Upsert failed: ${err.message}`)
    }
  }

  console.log(`\nDone. Processed: ${processed}, Skipped (already exist): ${skipped}`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
