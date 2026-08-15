// Mirrors the named difficulty tiers Jiten shows in its own UI (not exposed
// via their API — extracted from their frontend's difficulty-label lookup,
// which floors+clamps the score into this exact 6-entry array).
const DIFFICULTY_LABELS = ['Beginner', 'Easy', 'Average', 'Hard', 'Expert', 'Insane']

export function difficultyLabel(bucket) {
  if (bucket == null) return null
  const idx = Math.min(Math.max(Math.floor(bucket), 0), DIFFICULTY_LABELS.length - 1)
  return DIFFICULTY_LABELS[idx]
}
