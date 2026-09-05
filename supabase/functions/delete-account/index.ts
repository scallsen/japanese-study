import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireUser, authErrorResponse } from '../_shared/auth.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Deleting an account can only happen server-side: auth.admin.deleteUser needs
// the service role, which must never reach the browser. The user is resolved
// from their own token, so a caller can only ever delete themselves — there is
// deliberately no user id in the request body.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const user = await requireUser(req)

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Server misconfigured: missing Supabase service role credentials' }, 500)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // progress.user_id and stories.user_id both reference auth.users with no
    // cascade, so the rows have to go before the user or the delete is
    // rejected by the foreign key.
    const { error: progressError } = await admin.from('progress').delete().eq('user_id', user.id)
    if (progressError) return jsonResponse({ error: `Could not delete progress: ${progressError.message}` }, 500)

    const { error: storiesError } = await admin.from('stories').delete().eq('user_id', user.id)
    if (storiesError) return jsonResponse({ error: `Could not delete stories: ${storiesError.message}` }, 500)

    const { error: userError } = await admin.auth.admin.deleteUser(user.id)
    if (userError) return jsonResponse({ error: `Could not delete account: ${userError.message}` }, 500)

    return jsonResponse({ ok: true })
  } catch (err) {
    const denied = authErrorResponse(err, jsonResponse)
    if (denied) return denied
    console.error('[delete-account]', err)
    return jsonResponse({ error: err?.message || 'Account deletion failed' }, 500)
  }
})
