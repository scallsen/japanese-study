// Mirrors DAILY_LIMITS in supabase/functions/_shared/quota.ts. A Deno edge
// function and the browser bundle can't share a module, so these are kept in
// sync by hand — the same arrangement as VOICEVOX_VOICES and the VOICES list
// in scripts/generate-audio.mjs. The server is authoritative; this copy only
// decides what the account page displays, so drift shows a wrong number rather
// than letting anyone past a limit.
export const AI_DAILY_LIMITS = [
  { feature: 'story-generate', label: 'Story generation', limit: 5 },
  { feature: 'word-import-image', label: 'Word import from a photo', limit: 10 },
  { feature: 'story-grade', label: 'Answer checking', limit: 30 },
]
