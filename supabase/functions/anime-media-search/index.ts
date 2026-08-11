import { createClient } from 'npm:@supabase/supabase-js@2'

// Proxies Jiten.moe (https://api.jiten.moe, source: github.com/Sirush/Jiten)
// media search — required because Jiten's CORS policy only allowlists
// jiten.moe/localhost, so this app's origin is rejected by browser fetch.
// Duplicated fetch logic (not shared) from
// src/modules/anime-vocab/providers/jitenClient.js, matching this repo's
// existing pattern of independent per-edge-function implementations (see
// story-generate's kuromoji setup / word-import's dictionary lookup) — keep
// this in sync manually if the client-side version changes.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
const JITEN_API_KEY = Deno.env.get('JITEN_API_KEY')

const MEDIA_TYPE_LABELS: Record<number, string> = {
  1: 'Anime', 2: 'Drama', 3: 'Movie', 4: 'Novel', 5: 'Non-fiction',
  6: 'Video game', 7: 'Visual novel', 8: 'Web novel', 9: 'Manga', 10: 'Audio',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

async function searchMedia(query: string) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (JITEN_API_KEY) headers['X-Api-Key'] = JITEN_API_KEY
  const res = await fetch(`https://api.jiten.moe/api/media-deck/search-suggestions?query=${encodeURIComponent(query)}&limit=10`, { headers })
  if (res.status === 429) throw new Error('Jiten rate limit exceeded — try again shortly')
  if (!res.ok) throw new Error(`Jiten search failed (${res.status})`)
  const body = await res.json()
  return (body.suggestions ?? []).map((s: any) => ({
    externalId: String(s.deckId),
    title: s.englishTitle || s.romajiTitle || s.originalTitle,
    originalTitle: s.originalTitle,
    mediaType: MEDIA_TYPE_LABELS[s.mediaType] ?? 'Other',
    coverUrl: s.coverName,
  }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Server misconfigured: missing Supabase service role credentials' }, 500)
    }
    const { query } = await req.json()
    if (!query || typeof query !== 'string' || !query.trim()) return jsonResponse({ results: [] })

    const results = await searchMedia(query.trim())

    // Cross-reference already-linked media so the client can show "already added"
    // and route straight to the episode list instead of re-linking.
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const externalIds = results.map((r: any) => r.externalId)
    const { data: existingRefs } = externalIds.length
      ? await supabase.from('media_provider_ref').select('media_id, external_id').eq('provider', 'jiten').in('external_id', externalIds)
      : { data: [] }
    const linkedByExternalId = new Map((existingRefs ?? []).map((r: any) => [r.external_id, r.media_id]))

    return jsonResponse({ results: results.map((r: any) => ({ ...r, mediaId: linkedByExternalId.get(r.externalId) ?? null })) })
  } catch (err) {
    console.error('[anime-media-search]', err)
    return jsonResponse({ error: err?.message || 'Search failed' }, 500)
  }
})
