// Column order Anki receives. Scheduling is deliberately absent, and not by
// oversight: Anki's text importer only ever writes note fields and tags. It
// cannot set due dates, intervals, ease, or FSRS memory state, and a review
// card's due date is a day offset from the collection's creation day, which a
// browser has no way to know. So this exports content — the part that is
// actually portable — and the app remains the home for scheduling.
const COLUMNS = ['front', 'back', 'kana', 'sentence', 'sentenceEnglish']

// A tab or newline inside a field would silently shift every column after it,
// producing a file that imports without error and is quietly wrong.
function cell(value) {
  return String(value ?? '').replace(/[\t\r\n]+/g, ' ').trim()
}

// Anki tags are whitespace-separated, so "Imported Words" would arrive as two
// unrelated tags rather than one deck name.
function deckTag(name) {
  return cell(name).replace(/\s+/g, '-') || 'deck'
}

/**
 * cards: resolved SRS cards (run bundled ones through resolveCard first —
 * scheduling-only state has no front/back).
 * deckNames: { [deckId]: displayName }
 */
export function buildAnkiTsv(cards, deckNames = {}) {
  const rows = cards
    // resolveCard returns empty content for a bundled card whose JSON entry has
    // since been removed; exporting those would create blank notes in Anki.
    .filter(card => cell(card.front) && cell(card.back))
    .map(card => [
      ...COLUMNS.map(field => cell(card[field])),
      deckTag(deckNames[card.deckId] ?? card.deckId),
    ].join('\t'))

  // Recognised by Anki 2.1.55+, so the user doesn't have to configure the
  // separator or field mapping by hand. Older versions treat them as comments,
  // and this app's own parseAnkiExport skips '#' lines too.
  return [
    '#separator:tab',
    '#html:false',
    `#tags column:${COLUMNS.length + 1}`,
    ...rows,
  ].join('\n') + '\n'
}

export function buildBackupJson({ progress, stories, exportedAt = new Date() }) {
  return JSON.stringify({
    format: 'japanese-study-backup@1',
    exportedAt: exportedAt.toISOString(),
    progress,
    stories,
  }, null, 2)
}

export function timestampedName(base, extension) {
  return `${base}-${new Date().toISOString().slice(0, 10)}.${extension}`
}

export function downloadFile(filename, content, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
