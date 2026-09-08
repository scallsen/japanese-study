#!/usr/bin/env node
/**
 * Seeds the story generator's "Examples" feed — curated, hand-written stories
 * visible to every visitor (signed in or not) via the `shared` flag on the
 * `stories` table. The module ships with none today, so signed-out visitors
 * see an empty page.
 *
 * Content is hand-written here rather than produced by story-generate, since
 * these are meant to demonstrate the layout/format range, not draw from any
 * one learner's real vocabulary. Tokenization mirrors story-generate's own
 * tokenizeStory() exactly (same field shape: t/r/w/b) so the review page
 * renders these identically to a real generation, using the same local-dict
 * kuromoji setup scripts/fetch-nhk.mjs already uses (no CDN dependency, unlike
 * the edge function's Deno build).
 *
 * Idempotent by title: re-running skips any of the five whose title already
 * exists among shared stories, so it's safe to re-run after adding a new one.
 *
 * Run: node --env-file=.env scripts/seed-example-stories.mjs <email-or-user-id>
 *
 * The service-role key also unlocks the Admin API, so the argument can be an
 * email instead of a raw UUID — resolved to a user id via auth.admin.listUsers()
 * rather than requiring a trip to the dashboard's Users table first.
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import kuromoji from 'kuromoji'

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) or a service-role key (SUPABASE_SERVICE_ROLE_KEY).')
  console.error('The service-role key is in Supabase dashboard → Project Settings → API — it is not the anon key already in .env, and must never be shipped to the client.')
  process.exit(1)
}

const arg = process.argv[2]
if (!arg) {
  console.error('Usage: node --env-file=.env scripts/seed-example-stories.mjs <email-or-user-id>')
  console.error('Any valid account works — shared:true makes these rows visible to everyone regardless of owner.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function resolveUserId(emailOrId) {
  if (/^[0-9a-f-]{36}$/i.test(emailOrId)) return emailOrId

  // Admin API is paginated; one page of 1000 comfortably covers a personal
  // project without needing to loop through pages.
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) {
    console.error('Failed to look up users:', error.message)
    process.exit(1)
  }
  const match = data.users.find((u) => u.email?.toLowerCase() === emailOrId.toLowerCase())
  if (!match) {
    console.error(`No user found with email ${emailOrId}`)
    process.exit(1)
  }
  return match.id
}

// Same PARTICLE_POS / tokenizeStory logic as supabase/functions/story-generate/index.ts.
const PARTICLE_POS = new Set(['助詞', '助動詞', '記号', 'BOS/EOS'])
const HAS_KANJI = /[一-龯㐀-䶿々]/

function katakanaToHiragana(str) {
  return (str ?? '').replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

function tokenizeStory(tokenizer, text) {
  return tokenizer.tokenize(text).map((tok) => {
    const isContent = !PARTICLE_POS.has(tok.pos) && tok.surface_form.trim().length > 0
    const reading = tok.reading && HAS_KANJI.test(tok.surface_form)
      ? katakanaToHiragana(tok.reading)
      : null
    const basicForm = tok.basic_form && tok.basic_form !== '*'
      ? tok.basic_form
      : tok.surface_form
    return { t: tok.surface_form, r: reading, w: isContent, b: isContent ? basicForm : null }
  })
}

function buildTokenizer() {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err, t) => {
      err ? reject(err) : resolve(t)
    })
  })
}

const EXAMPLE_STORIES = [
  {
    title: '公園で',
    format: 'story',
    story: [
      '今日はいい天気でした。私は近くの公園へ散歩に行きました。',
      '公園には大きい木がたくさんあって、鳥の声が聞こえました。ベンチに座っていると、小さい犬が走ってきて、しっぽを振りました。とてもかわいかったです。',
      '犬の飼い主のおばあさんが「すみません、うちの犬です」と言いました。少し話をして、また来週も会う約束をしました。',
    ].join('\n\n'),
  },
  {
    title: '土曜日の日記',
    format: 'diary',
    story: [
      '6月13日（土）',
      [
        '今日はゆっくり寝ました。起きたのは十時でした。朝ご飯を食べてから、部屋を掃除しました。',
        '午後は母と一緒に晩ご飯を作りました。カレーを作って、家族みんなで食べました。とてもおいしかったです。',
        '夜はテレビを見て、早く寝ました。楽しい一日でした。',
      ].join('\n\n'),
      // Diary layout splits on the first single-\n token — the join below
      // must stay a single \n between the date line and the body, never \n\n.
    ].join('\n'),
  },
  {
    title: 'ラーメン屋で',
    format: 'dialogue',
    story: [
      'ゆうた「久しぶり!元気だった?」',
      'まい「元気だったよ。ゆうたは仕事忙しい?」',
      'ゆうた「うん、最近すごく忙しいんだ。でも今日は休みだから、ゆっくりラーメンを食べに来たよ」',
      'まい「いいね。何を頼む?」',
      'ゆうた「僕はしょうゆラーメンにする。まいは?」',
      'まい「私は味噌ラーメンが好きだから、それにする。あと、ぎょうざも頼まない?」',
      'ゆうた「いいね、頼もう!」',
      '店員「お待たせしました」',
      '少しして、ラーメンとぎょうざが運ばれてきた。',
      'まい「わあ、おいしそう!いただきます」',
      'ゆうた「いただきます。…やっぱりここのラーメンはおいしいね」',
      'まい「うん、スープが濃くて最高。仕事の話も久しぶりにゆっくりできてよかった」',
      'ゆうた「本当だね。また今度も一緒に来ようね」',
    ].join('\n'),
  },
  {
    title: '京都からのはがき',
    format: 'postcard',
    story: [
      'まいちゃんへ',
      '京都に来ています。紅葉がきれいで、お寺もたくさん見ました。また写真を見せますね。',
      'たかし',
    ].join('\n'),
  },
  {
    title: '商店街で秋祭り、多くの人でにぎわう',
    format: 'news',
    story: [
      '先週の土曜日、市内の商店街で秋祭りが開かれた。この祭りは十年前から毎年行われており、地域の住民によって企画されている。',
      '今年は天気に恵まれたこともあり、例年より多くの人が訪れたという。商店街には食べ物の屋台がならび、焼き鳥やたこ焼きなどの香りが辺り一面に広がっていた。子どもたちのための盆踊りや、地元の音楽グループによるライブ演奏も行われ、会場は一日中にぎやかだった。',
      '訪れた家族連れの一人は、「毎年楽しみにしています。子どもも喜んでいました」と笑顔で話した。',
      '祭りを企画した実行委員会の代表は、「毎年たくさんの方に来ていただき、本当にうれしいです。これからも地域のつながりを大切にしたいです」と話した。',
      '来年の秋祭りは、来年九月に開催される予定だ。',
    ].join('\n\n'),
  },
]

async function main() {
  const userId = await resolveUserId(arg)

  const { data: existing, error: fetchErr } = await supabase
    .from('stories')
    .select('title')
    .eq('shared', true)
  if (fetchErr) {
    console.error('Failed to check existing shared stories:', fetchErr.message)
    process.exit(1)
  }
  const existingTitles = new Set((existing ?? []).map((r) => r.title))

  const toInsert = EXAMPLE_STORIES.filter((s) => !existingTitles.has(s.title))
  if (toInsert.length === 0) {
    console.log('All example stories already exist among shared stories. Nothing to do.')
    return
  }

  console.log(`Building tokenizer (local dict, node_modules/kuromoji/dict)...`)
  const tokenizer = await buildTokenizer()

  const rows = toInsert.map((s) => ({
    id: randomUUID(),
    user_id: userId,
    title: s.title,
    story: s.story,
    tokens: tokenizeStory(tokenizer, s.story),
    format: s.format,
    questions: [],
    shared: true,
  }))

  const { error: insertErr } = await supabase.from('stories').insert(rows)
  if (insertErr) {
    console.error('Insert failed:', insertErr.message)
    process.exit(1)
  }

  console.log(`Inserted ${rows.length} example stor${rows.length === 1 ? 'y' : 'ies'}:`)
  for (const r of rows) console.log(`  - [${r.format}] ${r.title} (${r.id})`)
}

main()
