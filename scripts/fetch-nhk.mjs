#!/usr/bin/env node
/**
 * Fetches Japanese news headlines from Yahoo Japan RSS, then uses Claude Haiku
 * to write N4-level article bodies for each headline and generate AI fields.
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

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const MAX_ARTICLES = 5
const YAHOO_RSS_URL = 'https://news.yahoo.co.jp/rss/topics/top-picks.xml'

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

function slugFromUrl(url) {
  const m = url.match(/\/(\d+)(?:\?|$)/)
  return m ? `yahoo-${m[1]}` : `yahoo-${Buffer.from(url).toString('base64').slice(0, 16)}`
}

async function fetchHeadlines() {
  const res = await fetch(YAHOO_RSS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
  })
  if (!res.ok) throw new Error(`Yahoo RSS fetch failed: ${res.status}`)
  const xml = await res.text()

  const items = []
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  for (const match of itemMatches) {
    const block = match[1]
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/s, '$1').trim()
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim()
      ?? block.match(/<comments>([\s\S]*?)<\/comments>/)?.[1]?.trim()
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim()
    if (title && link) {
      items.push({ title, link, pubDate })
    }
    if (items.length >= MAX_ARTICLES * 2) break
  }
  return items
}

async function generateArticle(headline, pubDate) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
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
  console.log('Fetching Yahoo Japan News headlines...')
  const headlines = await fetchHeadlines()
  console.log(`Found ${headlines.length} headlines`)

  const existingSlugs = await getExistingSlugs()
  console.log(`Existing articles: ${existingSlugs.size}`)

  let processed = 0
  let skipped = 0

  for (const item of headlines) {
    if (processed >= MAX_ARTICLES) break

    const slug = slugFromUrl(item.link)

    if (existingSlugs.has(slug)) {
      skipped++
      continue
    }

    console.log(`Generating: ${item.title}`)

    let ai
    try {
      ai = await generateArticle(item.title, item.pubDate)
    } catch (err) {
      console.warn(`  Claude failed: ${err.message}`)
      continue
    }

    const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()

    try {
      await upsertArticle({
        slug,
        source: 'yahoo',
        title: ai.title ?? item.title,
        title_en: ai.title_en ?? null,
        published_at: publishedAt,
        body_ja: ai.body_ja,
        body_simple: ai.body_simple ?? null,
        summary_en: ai.summary_en ?? null,
        questions: ai.questions ?? null,
        difficulty: ai.difficulty ?? 2,
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
