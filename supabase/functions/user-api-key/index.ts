import { requireUser, authErrorResponse } from '../_shared/auth.ts'
import { encryptSecret, keyHint, looksLikeAnthropicKey, adminClient } from '../_shared/userKey.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Manages the caller's own Anthropic key. It is never returned — not to anyone,
// including its owner — so every response carries at most the four-character
// hint. The table has no RLS policy for `authenticated` at all, which is what
// makes that guarantee structural rather than a promise this function keeps.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const user = await requireUser(req)
    const admin = adminClient()
    if (!admin) return jsonResponse({ error: 'Server misconfigured: missing Supabase service role credentials' }, 500)

    const { action, apiKey } = await req.json()

    if (action === 'status') {
      const { data } = await admin
        .from('user_api_keys')
        .select('key_hint, created_at')
        .eq('user_id', user.id)
        .maybeSingle()
      return jsonResponse({ hint: data?.key_hint ?? null, createdAt: data?.created_at ?? null })
    }

    if (action === 'remove') {
      const { error } = await admin.from('user_api_keys').delete().eq('user_id', user.id)
      if (error) return jsonResponse({ error: `Could not remove the key: ${error.message}` }, 500)
      return jsonResponse({ hint: null })
    }

    if (action === 'save') {
      if (!looksLikeAnthropicKey(apiKey)) {
        return jsonResponse({ error: 'That doesn’t look like an Anthropic API key — they start with "sk-ant-".' }, 400)
      }
      const trimmed = apiKey.trim()

      // Check the key actually works before storing it, so a typo fails here
      // rather than silently breaking the next generation. Listing models
      // costs no tokens.
      const probe = await fetch('https://api.anthropic.com/v1/models?limit=1', {
        headers: { 'x-api-key': trimmed, 'anthropic-version': '2023-06-01' },
      })
      if (!probe.ok) {
        return jsonResponse({ error: 'Anthropic rejected that key. Check it and try again.' }, 400)
      }

      const { error } = await admin.from('user_api_keys').upsert({
        user_id: user.id,
        encrypted_key: await encryptSecret(trimmed),
        key_hint: keyHint(trimmed),
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (error) return jsonResponse({ error: `Could not save the key: ${error.message}` }, 500)

      return jsonResponse({ hint: keyHint(trimmed) })
    }

    return jsonResponse({ error: 'action must be "status", "save" or "remove"' }, 400)
  } catch (err) {
    const denied = authErrorResponse(err, jsonResponse)
    if (denied) return denied
    // Deliberately not logging err verbatim anywhere a key could appear in it.
    console.error('[user-api-key] request failed')
    return jsonResponse({ error: 'Could not update your API key' }, 500)
  }
})
