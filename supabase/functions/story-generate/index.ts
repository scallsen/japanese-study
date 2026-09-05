import Anthropic from 'npm:@anthropic-ai/sdk@0.104.1'
import * as kuromoji from 'npm:@patdx/kuromoji@1.0.4'
import { requireUser, authErrorResponse } from '../_shared/auth.ts'
import { consumeQuota, refundQuota, quotaErrorResponse } from '../_shared/quota.ts'
import { getUserApiKey } from '../_shared/userKey.ts'

const DEFAULT_MODEL = Deno.env.get('STORY_MODEL') || 'claude-sonnet-5'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Dictionary files fetched at cold start (~18 MB from jsDelivr, cached per
// warm instance). The build runs concurrently with Claude's generation, so
// it adds no latency even on a cold start.
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
const HAS_KANJI = /[一-龯㐀-䶿々]/

function katakanaToHiragana(str: string): string {
  return (str ?? '').replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

// Same token shape the model used to produce: { t, r, w, b } — surface,
// hiragana reading (kanji tokens only), content-word flag, dictionary base
// form. Kuromoji emits newlines as their own 記号 tokens, so concatenated
// t values reproduce the story exactly and dialogue line parsing works.
function tokenizeStory(tokenizer: any, text: string) {
  return tokenizer.tokenize(text).map((tok: any) => {
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

const SYSTEM_PROMPT = `You are a Japanese language content generator for a vocabulary study app.

You will be given a description of the learner's known vocabulary and grammar level, then a request for a piece of written content.

Hard constraints:
- Write the content in Japanese, using ONLY vocabulary from the learner's known-word list, plus: particles, pronouns, numbers, common greetings, proper nouns, and basic grammatical function words (including です/ます, する, ある, いる, なる and their conjugations).
- Keep grammar at or below the learner's stated JLPT level.
- Reuse the learner's words often — the goal is reading practice that reinforces them.
- The content must be ORIGINAL. When the request says it should be inspired by an existing work, setting, or style, write an original piece that evokes that setting or style — never a retelling, adaptation, or reproduction of an existing copyrighted plot, characters, or text.

Comprehension questions:
- Write the questions in Japanese, using the same vocabulary constraints, answerable from the content alone.
- correct_answer is the ideal answer in Japanese (a short phrase or sentence).
- acceptable_variations lists 2-4 alternative correct phrasings (kana-only versions, shorter forms, synonyms from the known-word list).`

const STORY_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short Japanese title' },
    story: { type: 'string', description: 'The full Japanese content, with paragraph breaks as \\n\\n' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          correct_answer: { type: 'string' },
          acceptable_variations: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'question', 'correct_answer', 'acceptable_variations'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'story', 'questions'],
  additionalProperties: false,
}

const LENGTH_HINTS = {
  short: 'around 150-250 Japanese characters',
  medium: 'around 300-500 Japanese characters',
  long: 'around 600-900 Japanese characters',
}

const FORMAT_HINTS = {
  story: 'a short story',
  news: 'a fake news article (invented but plausible events, neutral reporting tone)',
  dialogue: 'a conversation transcript between two or three people. Format every spoken line exactly as 名前「セリフ」 on its own line, one speaker turn per line, separated by newlines. Keep speaker names short (given names). Brief narration lines without brackets are allowed between turns',
  diary: 'a single personal diary entry (日記), written in casual/plain form (だ・である調, not です・ます調). The very first line must contain only the date, e.g. 6月3日（火）, followed by a single line break and then the entry body with no blank line in between. Write in the first person about the day\'s events or feelings',
  interview: 'an interview transcript between an interviewer and one subject. Format every spoken line exactly as 名前「セリフ」 on its own line, alternating strictly between exactly two speakers (the interviewer asks, the subject answers). Give the interviewer a short role label like 聞き手 and the subject a short given name. Keep a natural, polite-but-conversational interview register',
  letter: 'a personal letter to a friend or family member, written in the first person. Open with a natural line acknowledging the season or the recipient, and close with a sign-off and the sender\'s name on its own line at the end. Use a warm, personal tone, not business keigo',
  postcard: 'a short personal postcard (はがき) message to a friend or family member, written in the first person. A postcard has very little writing space — keep the entire message (including greeting and sign-off) to no more than 100 Japanese characters total, regardless of the requested length. Open with a brief greeting and close with a short sign-off and the sender\'s name on its own line',
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    // Must stay ahead of the ReadableStream below: once the stream opens the
    // response is committed to 200 text/plain, and a rejection could only be
    // smuggled into the payload instead of being a real status code.
    const user = await requireUser(req)

    const {
      learnerContext,
      mode = 'new',
      basedOn = '',
      format = 'story',
      length = 'short',
      questionCount = 3,
      model = DEFAULT_MODEL,
    } = await req.json()

    if (!learnerContext || typeof learnerContext !== 'string') {
      return jsonResponse({ error: 'learnerContext (string) is required' }, 400)
    }
    if (mode === 'based-on' && !basedOn.trim()) {
      return jsonResponse({ error: 'basedOn is required when mode is "based-on"' }, 400)
    }

    // A user on their own key pays Anthropic directly, so there is nothing to
    // meter. Like requireUser, the quota check has to precede the stream: once
    // that opens the response is committed to 200 and a 429 is no longer
    // expressible.
    const userKey = await getUserApiKey(user.id)
    if (!userKey) await consumeQuota(user.id, 'story-generate')

    const client = new Anthropic({ apiKey: userKey ?? Deno.env.get('ANTHROPIC_API_KEY') })

    const request = [
      `Write ${FORMAT_HINTS[format] || FORMAT_HINTS.story}, ${LENGTH_HINTS[length] || LENGTH_HINTS.short}.`,
      mode === 'based-on'
        ? `It should be an original piece inspired by the following theme, setting, or style: ${basedOn.trim()}`
        : 'Choose any theme that works well with the learner\'s vocabulary.',
      `Include ${questionCount} comprehension questions.`,
    ].join('\n')

    // Generation can exceed the edge gateway's 150s idle limit (IDLE_TIMEOUT
    // kills any request that sends no bytes for 150s). So the response is
    // streamed: heartbeat spaces keep the connection alive while Claude
    // works, then the JSON payload is sent as the final line. Errors after
    // headers are sent arrive as {error} in the payload (status is already
    // 200) — the client checks for that key.
    const encoder = new TextEncoder()
    const body = new ReadableStream({
      async start(controller) {
        const heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(' ')) } catch { /* stream closed */ }
        }, 10000)
        try {
          // Build the tokenizer while Claude generates — dictionary download
          // and generation overlap, so cold starts cost nothing extra.
          const tokenizerBuild = getTokenizer()
          const stream = client.messages.stream({
            model,
            max_tokens: 16000,
            system: [
              { type: 'text', text: SYSTEM_PROMPT },
              // Same learner context repeats across generations in a session — cache it.
              { type: 'text', text: learnerContext, cache_control: { type: 'ephemeral' } },
            ],
            messages: [{ role: 'user', content: request }],
            output_config: { effort: 'medium', format: { type: 'json_schema', schema: STORY_SCHEMA } },
          })
          const response = await stream.finalMessage()

          let payload
          if (response.stop_reason === 'refusal') {
            payload = { error: 'The model declined this request. Try a different theme.' }
          } else if (response.stop_reason === 'max_tokens') {
            payload = { error: 'Generation ran out of tokens before finishing. Try a shorter length.' }
          } else {
            const textBlock = response.content.find((b) => b.type === 'text')
            if (textBlock) {
              const parsed = JSON.parse(textBlock.text)
              // Tokenization failure must not lose the story — the reader
              // falls back to plain text when tokens are missing.
              let tokens = null
              try {
                const tokenizer = await tokenizerBuild
                tokens = tokenizeStory(tokenizer, parsed.story)
              } catch (tokErr) {
                console.error('[story-generate] tokenization failed', tokErr)
                tokenizerPromise = null
              }
              payload = { ...parsed, tokens, model: response.model, usage: response.usage }
            } else {
              payload = { error: 'Empty model response' }
            }
          }
          controller.enqueue(encoder.encode('\n' + JSON.stringify(payload)))
        } catch (err) {
          console.error('[story-generate]', err)
          // The quota was taken before the stream opened, so a failure here
          // would otherwise cost one of the day's few generations for a story
          // the user never received.
          if (!userKey) await refundQuota(user.id, 'story-generate')
          controller.enqueue(encoder.encode('\n' + JSON.stringify({ error: err?.message || 'Generation failed' })))
        } finally {
          clearInterval(heartbeat)
          controller.close()
        }
      },
    })

    return new Response(body, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    const denied = authErrorResponse(err, jsonResponse) ?? quotaErrorResponse(err, jsonResponse)
    if (denied) return denied
    console.error('[story-generate]', err)
    return jsonResponse({ error: err?.message || 'Generation failed' }, 500)
  }
})
