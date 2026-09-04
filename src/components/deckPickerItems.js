// Maps the SRS deck map onto OptionPicker's { id, label, meta } shape.
// Lives in its own .js file rather than inside DeckComboBox.jsx so that file
// stays export-only-components (react-refresh), matching how vocabMap.js and
// attributionSegments.jsx are split out elsewhere.
export function deckPickerItems(decks, { lastUsedDeckId, exclude } = {}) {
  return Object.values(decks)
    .filter(d => !exclude?.(d))
    .sort((a, b) => {
      // Most recently used first — it's overwhelmingly the next pick.
      if (a.id === lastUsedDeckId) return -1
      if (b.id === lastUsedDeckId) return 1
      return (a.addedAt ?? 0) - (b.addedAt ?? 0)
    })
    .map(d => ({
      id: d.id,
      label: d.name,
      meta: d.id === lastUsedDeckId ? 'Last used' : undefined,
    }))
}
