import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')

const admin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

// Per-feature rather than one shared pool: a story generation (Sonnet, with a
// learner-context prompt that can run long) and an answer grading (Haiku, four
// short lines) differ in cost by more than an order of magnitude. A single
// counter would let the expensive feature silently consume the cheap one's
// budget, and would make any limit either uselessly loose or needlessly tight.
//
// Keys are the unit of cost, not the function name — word-import's text mode
// makes no Anthropic call at all and is deliberately absent, so it is free.
export const DAILY_LIMITS: Record<string, number> = {
  'story-generate': 5,
  'word-import-image': 10,
  // Not an AI feature and deliberately absent from the client's AI_DAILY_LIMITS
  // display list. It bounds how many times one account can ask us to check a
  // key against Anthropic: without it, this endpoint is a validation oracle —
  // someone holding leaked sk-ant- keys could discover which are live from our
  // IP rather than their own. Generous for the real case (a user saves a key
  // once, maybe a few times after a typo) and tight for that one.
  'key-validation': 10,
}

// Ceilings across ALL users combined, not per account. Per-user quotas bound
// what one person can spend; nothing bounded the sum, so N users x 5 stories
// was unbounded in N. This is the app's own brake — the spend limit on the
// Anthropic key itself is the backstop behind it, and hitting THAT means
// every AI feature fails with a raw provider error instead of a clear message.
//
// Sized to be comfortably above real use for a small user base and well below
// anything alarming on the bill. Raise as the audience grows.
export const GLOBAL_DAILY_LIMITS: Record<string, number> = {
  'story-generate': 100,
  'word-import-image': 200,
}

export class QuotaError extends Error {
  status: number
  // 'user' — this person is out for today. 'global' — the whole app is,
  // which the client turns into a banner rather than a personal message,
  // because "you've used your 5" would be a lie.
  scope: 'user' | 'global'
  constructor(message: string, scope: 'user' | 'global' = 'user') {
    super(message)
    this.name = 'QuotaError'
    this.status = 429
    this.scope = scope
  }
}

// Increments and checks in a single statement (see consume_ai_quota in the
// schema): a read-then-write pair would let two concurrent requests both see
// "under the limit" and both proceed.
export async function consumeQuota(userId: string, feature: string) {
  const limit = DAILY_LIMITS[feature]
  if (!admin) throw new Error('Server misconfigured: missing Supabase service role credentials')
  if (!limit) throw new Error(`No daily limit configured for "${feature}"`)

  const { data, error } = await admin.rpc('consume_ai_quota', {
    p_user: userId,
    p_feature: feature,
    p_limit: limit,
  })
  if (error) throw new Error(`Could not check usage limit: ${error.message}`)

  // No row comes back when the conditional update found the user already at
  // the limit.
  if (data === null || data === undefined) {
    throw new QuotaError(`Daily limit reached (${limit} per day). Try again tomorrow.`)
  }
  return { used: data as number, limit }
}

// Counts a call without capping it — the path for a user on their own key.
// They aren't metered, but their usage is still worth showing back to them, and
// recording it here means "today" and "lifetime" come from one table for
// everyone rather than two code paths that could disagree.
export async function recordUsage(userId: string, feature: string) {
  if (!admin) throw new Error('Server misconfigured: missing Supabase service role credentials')
  const { error } = await admin.rpc('record_ai_usage', { p_user: userId, p_feature: feature })
  if (error) console.error('[quota] record failed', feature, error.message)
}

// Called when the work fails after the call was counted, so a model error or a
// timeout doesn't cost the user one of their few daily runs — or inflate the
// lifetime total of someone on their own key. Best effort: if the refund itself
// fails there is nothing useful to tell the caller, whose request already
// failed for its own reasons.
export async function refundQuota(userId: string, feature: string) {
  if (!admin) return
  const { error } = await admin.rpc('refund_ai_quota', { p_user: userId, p_feature: feature })
  if (error) console.error('[quota] refund failed', feature, error.message)
}

// Consumes one unit of the app-wide daily ceiling for a feature. Reuses the
// rate_limit table and its atomic increment-and-check rather than adding a
// second mechanism — the bucket is simply 'global' instead of a user or IP.
//
// Skipped entirely for a user on their own API key: they aren't spending our
// budget, so they shouldn't be stopped when it runs out.
export async function consumeGlobalQuota(feature: string) {
  const limit = GLOBAL_DAILY_LIMITS[feature]
  if (!admin || !limit) return

  const now = new Date()
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_bucket: 'global',
    p_feature: feature,
    p_window_key: `day:${now.toISOString().slice(0, 10)}`,
    p_limit: limit,
    p_cost: 1,
    // Kept two days so the client can still read today's row near midnight.
    p_expires: new Date(now.getTime() + 172_800_000).toISOString(),
  })
  // Fails open: a broken limiter shouldn't take AI features down. The spend
  // limit on the Anthropic key is the backstop for that case.
  if (error) {
    console.error('[quota] global check failed, allowing', feature, error.message)
    return
  }
  if (data === null || data === undefined) {
    throw new QuotaError(
      'AI generation is temporarily unavailable — the app has reached its daily limit. Try again tomorrow, or add your own API key to bypass it.',
      'global',
    )
  }
}

export function quotaErrorResponse(err: unknown, jsonResponse: (body: unknown, status?: number) => Response) {
  if (err instanceof QuotaError) return jsonResponse({ error: err.message, scope: err.scope }, err.status)
  return null
}
