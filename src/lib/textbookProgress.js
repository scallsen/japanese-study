import { getTextbook } from '../data/textbooks.js'

// Pure resolver for the "New" card and the chapters page. Takes the
// `vocab-flashcard` progress payload and returns everything the UI needs to
// say "Continue Lesson 4 / Start Lesson 5" without re-deriving it per screen.
//
// Progress shape it reads:
//   progress.textbook = { id, currentChapterId }      // set by the picker / Start
//   progress.sublists = { [chapterId]: { [mode]: { lastReviewed, correct, total } } }
//                        (legacy rows are { lastReviewed, ... } with no mode key)
//
// "Drilled" means the chapter has at least one completed drill in any mode.
// The current-chapter pointer is honoured when it belongs to the chosen book;
// otherwise the first undrilled chapter is current, or the last chapter when
// every one has been drilled.

function lastReviewedOf(entry) {
  if (!entry) return null
  if ('lastReviewed' in entry) return entry.lastReviewed ?? null
  let latest = null
  for (const mode of Object.values(entry)) {
    if (mode?.lastReviewed && (!latest || mode.lastReviewed > latest)) latest = mode.lastReviewed
  }
  return latest
}

export function resolveTextbookState(progress, wordCountFor) {
  const textbook = getTextbook(progress?.textbook?.id)
  if (!textbook) return null

  const sublists = progress?.sublists ?? {}
  const chapters = textbook.chapters.map(ch => ({
    ...ch,
    wordCount: wordCountFor(ch.id),
    drilled: !!sublists[ch.id],
    lastReviewed: lastReviewedOf(sublists[ch.id]),
  }))

  const pointer = progress.textbook.currentChapterId
  let currentIndex = chapters.findIndex(ch => ch.id === pointer)
  if (currentIndex === -1) currentIndex = chapters.findIndex(ch => !ch.drilled)
  if (currentIndex === -1) currentIndex = chapters.length - 1

  const current = chapters[currentIndex] ?? null
  const next = chapters[currentIndex + 1] ?? null
  const doneCount = chapters.filter(ch => ch.drilled).length
  const wordsDrilled = chapters.filter(ch => ch.drilled).reduce((sum, ch) => sum + ch.wordCount, 0)
  const hasWords = chapters.some(ch => ch.wordCount > 0)

  return { textbook, chapters, current, next, doneCount, wordsDrilled, hasWords }
}
