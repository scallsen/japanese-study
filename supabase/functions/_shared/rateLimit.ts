import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
const SALT_SOURCE = Deno.env.get('API_KEY_ENCRYPTION_SECRET') ?? ''

const admin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

/**
 * Two-window rate limiting for endpoints that can't require a login.
 *
 * The anime module works signed out by design, so per-user quotas don't apply.
 * What still needs bounding is that these functions proxy Jiten with *our* API
 * key: unmetered, a scraper spends our private allowance (rate-limiting our own
 * users) and our Supabase invocation quota, which is shared with every other
 * function including the AI ones.
 *
 * Both windows matter and neither substitutes for the other. The per-minute
 * window stops a burst — a runaway client loop, or a scraper going flat out.
 * The daily cap stops the patient version: someone crawling all of Jiten
 * slowly enough to stay under the minute limit forever.
 *
 * Limits are derived from what one interaction actually costs (see
 * ANIME_LIMITS) rather than picked round, and sit far enough above real use
 * that a person will never meet one.
 */

// Per feature: { perMinute, perDay }. A single human session browsing hard
// might reach a few dozen searches a minute at the very top end; syncing an
// episode is rare and expensive (that one call fans out to 10+ Jiten requests
// at 200 vocabulary rows a page), which is why its numbers are far lower.
export const ANIME_LIMITS: Record<string, { perMinute: number; perDay: number }> = {
  'anime-browse': { perMinute: 40, perDay: 600 },
  'anime-lookup': { perMinute: 40, perDay: 600 },
  'anime-select': { perMinute: 15, perDay: 150 },
  'anime-vocab-sync': { perMinute: 10, perDay: 60 },
}

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
// stored value non-identifying, which is also why the privacy policy doesn't
// have to claim we store IP addresses.
//
// The salt is derived from an existing secret with a purpose string rather
// than reusing it directly, so this can't be used to attack the encryption
// key and doesn't add another secret to manage.
async function bucketFor(req: Request, userId: string | null) {
  if (userId) return `user:${userId}`
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const material = new TextEncoder().encode(`rate-limit:${SALT_SOURCE}:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', material)
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  return `ip:${hex.slice(0, 32)}`
}

function windowKeys(now: Date) {
  const iso = now.toISOString()
  return [
    { key: `min:${iso.slice(0, 16)}`, expires: new Date(now.getTime() + 120_000) },
    { key: `day:${iso.slice(0, 10)}`, expires: new Date(now.getTime() + 172_800_000) },
  ]
}

/**
 * Throws RateLimitError when either window is exhausted. Fails **open**: if the
 * limiter itself is broken or unreachable, anime browsing keeps working rather
 * than the whole module going down to protect a third-party rate limit.
 */
export async function enforceRateLimit(req: Request, feature: string, userId: string | null = null) {
  const limits = ANIME_LIMITS[feature]
  if (!admin || !limits) return

  const bucket = await bucketFor(req, userId)
  const now = new Date()
  const [minute, day] = windowKeys(now)

  for (const [window, limit] of [[minute, limits.perMinute], [day, limits.perDay]] as const) {
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_bucket: bucket,
      p_feature: feature,
      p_window_key: window.key,
      p_limit: limit,
      p_expires: window.expires.toISOString(),
    })
    if (error) {
      console.error('[rateLimit] check failed, allowing', feature, error.message)
      return
    }
    if (data === null || data === undefined) {
      throw new RateLimitError(
        window.key.startsWith('min:')
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
