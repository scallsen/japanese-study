export function buildVocabMap(vocabulary) {
  const map = {}
  if (!Array.isArray(vocabulary)) return map
  for (const entry of vocabulary) {
    if (entry.word) map[entry.word] = entry
  }
  return map
}
