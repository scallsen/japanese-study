// Mirrors DAILY_LIMITS in supabase/functions/_shared/quota.ts. A Deno edge
// function and the browser bundle can't share a module, so these are kept in
// sync by hand — the same arrangement as VOICEVOX_VOICES and the VOICES list
// in scripts/generate-audio.mjs. The server is authoritative; this copy only
// decides what the account page displays, so drift shows a wrong number rather
// than letting anyone past a limit.
export const AI_DAILY_LIMITS = [
  { feature: 'story-generate', label: 'Story generation', limit: 5 },
  { feature: 'word-import-image', label: 'Word import from a photo', limit: 10 },
]

// Mirrors GLOBAL_DAILY_LIMITS in the same edge-function module: the ceiling
// across all users combined, which exists so the Anthropic bill can't run away
// with the user count. Same hand-sync caveat as above, and the same safe
// direction of failure — the server decides, this copy only decides whether the
// "temporarily unavailable" banner is showing.
//
// The ai_availability() RPC returns raw counters rather than a ready-made
// boolean deliberately: it keeps the limits themselves out of SQL, so there are
// two copies to keep in step rather than three.
export const GLOBAL_AI_DAILY_LIMITS = {
  'story-generate': 100,
  'word-import-image': 200,
}
