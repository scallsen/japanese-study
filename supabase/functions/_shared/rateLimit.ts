import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
const SALT_SOURCE = Deno.env.get('API_KEY_ENCRYPTION_SECRET') ?? ''

const admin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

/**
 * Two-window rate limiting for the anime endpoints, which work signed out by
 * design and so can't be bounded per account.
 *
 * **Limits are denominated in Jiten requests, not in calls to us.** One call to
 * us fans out to a variable number of upstream requests, so counting our own
 * invocations produced numbers that couldn't be compared to Jiten's published
 * ones at all — a limit of 10 syncs/minute is really up to 100 upstream
 * requests/minute against an endpoint Jiten caps at ~10/minute anonymously.
 * Each call therefore declares its `cost`.
 *
 * What this does and does not achieve, because the two are easy to conflate:
 * it stops ONE caller monopolising the allowance. It does NOT bound the total,
 * since Jiten limits our key across all users at once and ten well-behaved
 * users still sum to ten times one user. A global ceiling would be a separate
 * mechanism, and sizing one needs the real limit for our key, which is not
 * documented anywhere. Caching is what actually keeps the total low — see the
 * note on vocab-sync below.
 */

// Upstream limits, read from Jiten's own source (Jiten.Api/Program.cs, named
// ASP.NET rate-limiter policies; github.com/Sirush/Jiten):
//
//   fixed     300/min  — get-media-decks, {id}/detail, {id}/vocabulary.
//                        ALL three endpoints we use are on this policy.
//   download   10/min  — deck downloads, frequency lists, custom-deck parser.
//                        We call NONE of these.
//   heavy      20/min anonymous, 45 keyed — search-by-description, example
//                        sentences. We call none of these either.
//
// So our real ceiling is 300/min, not the ~10/min this codebase previously
// believed for the vocabulary endpoint — that figure was the `download`
// policy, misattributed (jitenClient.js's comment has been corrected too).
//
// The number is not what a key buys us. Jiten partitions by
// `user:{userId}` when a key or JWT is present and `ip:{clientIp}` otherwise,
// and `fixed` is 300/min either way. Since JITEN_API_KEY is unset, every one
// of our users currently shares ONE partition keyed on Supabase's egress IP —
// possibly with unrelated Supabase tenants on the same address. A key buys an
// isolated partition, which for a server-side proxy is worth far more than a
// bigger number would be.
//
// Two runtime behaviours worth knowing: a 429 body is text/plain, not JSON
// (every call site checks the status before parsing, so this is safe), and
// small overshoots QUEUE rather than reject, surfacing as a request that
// hangs for up to a minute.
//
// Per-user limits below are a fraction of the 300 shared ceiling, so one
// active user can't consume the whole app's budget.
//
//   feature           cost per call          why this limit
//   ----------------- ---------------------- --------------------------------
//   anime-browse      1 (up to ~4 paging)    Live search, uncached, fires as
//                                            you type — the ONLY endpoint whose
//                                            load grows with user count, so it
//                                            gets the tightest treatment.
//   anime-lookup      externalIds.length     Client-side cached; one batch of
//                                            12 curated titles per page load.
//   anime-select      1 (~2-5 paging)        Once per series a user links.
//   anime-vocab-sync  VOCAB_SYNC_COST        Fans out over 200-row pages, but
//                                            is idempotent: an episode is
//                                            fetched from Jiten exactly once
//                                            ever, across all users. Naturally
//                                            bounded, so it can afford more
//                                            headroom than its raw fan-out
//                                            suggests.
export const ANIME_LIMITS: Record<string, { perMinute: number; perDay: number }> = {
  'anime-browse': { perMinute: 20, perDay: 500 },
  'anime-lookup': { perMinute: 60, perDay: 240 },
  'anime-select': { perMinute: 15, perDay: 200 },
  'anime-vocab-sync': { perMinute: 30, perDay: 300 },
}

// Charged up front for a sync, since the page count isn't known until the
// pagination finishes. Deliberately the worst case rather than an average:
// over-charging a short episode is the safe direction.
export const VOCAB_SYNC_COST = 10

// An oversized array is its own amplification vector — one request becoming
// hundreds of upstream ones — so the batch is capped independently of the
// rate limit.
export const MAX_LOOKUP_IDS = 24

export class RateLimitError extends Error {
  status: number
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
    this.status = 429
  }
}

// A salted hash, never the address itself. An unsalted hash of an IPv4 is
// trivially reversible (there are only ~4 billion), so it would still be
// personal data; salting with a secret the database never sees makes the
// stored value non-identifying, which is also why PRIVACY.md doesn't have to
// claim we store IP addresses. The salt derives from an existing secret with a
// purpose string rather than reusing it directly, so this can't be used to
// attack the encryption key and adds no new secret to manage.
async function bucketFor(req: Request, userId: string | null) {
  if (userId) return `user:${userId}`
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const material = new TextEncoder().encode(`rate-limit:${SALT_SOURCE}:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', material)
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  return `ip:${hex.slice(0, 32)}`
}

function windowsFor(now: Date) {
  const iso = now.toISOString()
  return [
    { key: `min:${iso.slice(0, 16)}`, expires: new Date(now.getTime() + 120_000), burst: true },
    { key: `day:${iso.slice(0, 10)}`, expires: new Date(now.getTime() + 172_800_000), burst: false },
  ]
}

/**
 * Throws RateLimitError when either window can't absorb `cost`.
 *
 * Fails **open**: if the limiter itself is broken or unreachable the request
 * proceeds, because anime browsing staying up matters more than protecting a
 * third-party rate limit. That also means deploying ahead of the SQL is safe.
 */
export async function enforceRateLimit(
  req: Request,
  feature: string,
  { cost = 1, userId = null }: { cost?: number; userId?: string | null } = {},
) {
  const limits = ANIME_LIMITS[feature]
  if (!admin || !limits) return

  const bucket = await bucketFor(req, userId)
  const now = new Date()

  for (const window of windowsFor(now)) {
    const limit = window.burst ? limits.perMinute : limits.perDay
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_bucket: bucket,
      p_feature: feature,
      p_window_key: window.key,
      p_limit: limit,
      p_cost: cost,
      p_expires: window.expires.toISOString(),
    })
    if (error) {
      console.error('[rateLimit] check failed, allowing', feature, error.message)
      return
    }
    if (data === null || data === undefined) {
      throw new RateLimitError(
        window.burst
          ? 'Too many requests just now. Wait a moment and try again.'
          : 'Daily limit reached for this feature. Try again tomorrow.',
      )
    }
  }
}

export function rateLimitErrorResponse(err: unknown, jsonResponse: (body: unknown, status?: number) => Response) {
  if (err instanceof RateLimitError) return jsonResponse({ error: err.message }, err.status)
  return null
}
