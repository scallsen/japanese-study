import Anthropic from 'npm:@anthropic-ai/sdk@0.104.1'

const DEFAULT_MODEL = Deno.env.get('GRADE_MODEL') || 'claude-haiku-4-5'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are a lenient grader for Japanese reading-comprehension answers.

You are given a question (in Japanese), the intended correct answer, a list of acceptable variations, and the learner's typed answer.

Pass the answer if it gets the gist right, even with typos, kana written where kanji was expected (or vice versa), missing or wrong particles, different word order, extra politeness forms, or phrasing that differs from the reference answer. Fail only if the meaning is wrong, contradicts the content, or is missing entirely.

feedback is 1-2 short sentences in English: if pass, confirm and note any small issues worth knowing; if fail, say what the answer should have conveyed.`

const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    feedback: { type: 'string' },
  },
  required: ['pass', 'feedback'],
  additionalProperties: false,
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
    const {
      question,
      correctAnswer,
      acceptableVariations = [],
      userAnswer,
      model = DEFAULT_MODEL,
    } = await req.json()

    if (!question || !correctAnswer || !userAnswer) {
      return jsonResponse({ error: 'question, correctAnswer, and userAnswer are required' }, 400)
    }

    const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            `Question: ${question}`,
            `Correct answer: ${correctAnswer}`,
            `Acceptable variations: ${acceptableVariations.join(' / ') || '(none listed)'}`,
            `Learner's answer: ${userAnswer}`,
          ].join('\n'),
        },
      ],
      output_config: { format: { type: 'json_schema', schema: GRADE_SCHEMA } },
    })

    if (response.stop_reason === 'refusal') {
      return jsonResponse({ error: 'The model declined to grade this answer.' }, 422)
    }

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock) return jsonResponse({ error: 'Empty model response' }, 502)

    const result = JSON.parse(textBlock.text)
    return jsonResponse({ ...result, model: response.model })
  } catch (err) {
    console.error('[story-grade]', err)
    return jsonResponse({ error: err?.message || 'Grading failed' }, 500)
  }
})
