import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')

const admin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null

export class AuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

// Shared rather than duplicated per function (the norm elsewhere in this
// directory) on purpose: an auth check that drifts between copies is worse
// than no check at all.
//
// The gateway's verify_jwt only proves the bearer is *a* valid project JWT --
// and the anon key is one, shipped in every browser bundle, so it clears the
// gateway and lands in the function body. Resolving the token to an actual
// user is what separates a signed-in caller from anyone who opened devtools.
// Deliberately not a local claims decode: that would silently become
// bypassable if a future deploy ever passed --no-verify-jwt.
export async function requireUser(req: Request) {
  if (!admin) throw new AuthError('Server misconfigured: missing Supabase service role credentials', 500)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new AuthError('Sign in to use this feature.')

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) throw new AuthError('Sign in to use this feature.')

  return data.user
}

// Maps an AuthError onto the caller's own JSON responder, so each function
// keeps its existing error contract. Returns null for anything else, letting
// the caller's normal catch handle it.
export function authErrorResponse(err: unknown, jsonResponse: (body: unknown, status?: number) => Response) {
  if (err instanceof AuthError) return jsonResponse({ error: err.message }, err.status)
  return null
}
