import { TEXTBOOKS } from './textbooks.js'

// Each source is either flat (lists: null — the source id is the listKey)
// or hierarchical (lists: array — each sublist id is a listKey).
//
// A textbook source is derived from textbooks.js rather than restated here:
// one book has chapters, and that file already owns the chapter list. The
// So-Matome entries below predate that model (they split one book across
// several sources, mirroring a class rather than the book) and still spell
// their sublists out; they collapse into `fromTextbook` once their listKeys
// are re-chaptered to match.
function fromTextbook(id) {
  const book = TEXTBOOKS.find(t => t.id === id)
  return { id: book.id, label: book.title, lists: book.chapters }
}

// A personal source is one learner's own course material — a class's
// re-chunking of a textbook, with its own sentences and review markers. It is
// theirs, not the app's, so it only appears for the account that owns it (see
// visibleSources). The published book it was taken from lives alongside it as
// an ordinary source.
export const WORD_SOURCES = [
  fromTextbook('genki-1'),
  fromTextbook('genki-2'),
  fromTextbook('nsm-n3-kanji'),
  {
    id: 'nsm-n3',
    personal: true,
    label: 'Nihongo So-Matome N3 (I-3)',
    lists: [
      { id: 'nsm-n3-w1d1', label: 'Week 1, Day 1' },
      { id: 'nsm-n3-w1d2', label: 'Week 1, Day 2' },
      { id: 'nsm-n3-w1d3', label: 'Week 1, Day 3' },
      { id: 'nsm-n3-w2d1', label: 'Week 2, Day 1' },
      { id: 'nsm-n3-w2d2', label: 'Week 2, Day 2' },
      { id: 'nsm-n3-w2d3', label: 'Week 2, Day 3' },
      { id: 'nsm-n3-w3d1', label: 'Week 3, Day 1' },
      { id: 'nsm-n3-w3d2', label: 'Week 3, Day 2' },
      { id: 'nsm-n3-w3d3', label: 'Week 3, Day 3' },
      { id: 'nsm-n3-w4d1', label: 'Week 4, Day 1' },
      { id: 'nsm-n3-w4d2', label: 'Week 4, Day 2' },
      { id: 'nsm-n3-w4d3', label: 'Week 4, Day 3' },
    ],
  },
  {
    id: 'nsm-n3-i4',
    personal: true,
    label: 'Nihongo So-Matome N3 (I-4)',
    lists: [
      { id: 'nsm-n3-i4-w1d1', label: 'Week 1, Day 1' },
      { id: 'nsm-n3-i4-w1d2', label: 'Week 1, Day 2' },
      { id: 'nsm-n3-i4-w1d3', label: 'Week 1, Day 3' },
      { id: 'nsm-n3-i4-w2d1', label: 'Week 2, Day 1' },
      { id: 'nsm-n3-i4-w2d2', label: 'Week 2, Day 2' },
      { id: 'nsm-n3-i4-w2d3', label: 'Week 2, Day 3' },
      { id: 'nsm-n3-i4-w3d1', label: 'Week 3, Day 1' },
      { id: 'nsm-n3-i4-w3d2', label: 'Week 3, Day 2' },
      { id: 'nsm-n3-i4-w3d3', label: 'Week 3, Day 3' },
      { id: 'nsm-n3-i4-w4d1', label: 'Week 4, Day 1' },
      { id: 'nsm-n3-i4-w4d2', label: 'Week 4, Day 2' },
      { id: 'nsm-n3-i4-w4d3', label: 'Week 4, Day 3' },
    ],
  },
  {
    id: 'nsm-n3-i5',
    personal: true,
    label: 'Nihongo So-Matome N3 (I-5)',
    lists: [
      { id: 'nsm-n3-i5-w1d1', label: 'Week 1, Day 1' },
      { id: 'nsm-n3-i5-w1d2', label: 'Week 1, Day 2' },
      { id: 'nsm-n3-i5-w1d3', label: 'Week 1, Day 3' },
      { id: 'nsm-n3-i5-w2d1', label: 'Week 2, Day 1' },
      { id: 'nsm-n3-i5-w2d2', label: 'Week 2, Day 2' },
      { id: 'nsm-n3-i5-w2d3', label: 'Week 2, Day 3' },
      { id: 'nsm-n3-i5-w3d1', label: 'Week 3, Day 1' },
      { id: 'nsm-n3-i5-w3d2', label: 'Week 3, Day 2' },
      { id: 'nsm-n3-i5-w3d3', label: 'Week 3, Day 3' },
      { id: 'nsm-n3-i5-w4d1', label: 'Week 4, Day 1' },
      { id: 'nsm-n3-i5-w4d2', label: 'Week 4, Day 2' },
      { id: 'nsm-n3-i5-w4d3', label: 'Week 4, Day 3' },
    ],
  },
  {
    id: 'nsm-n2-a1',
    personal: true,
    label: 'Nihongo So-Matome N2 (A-1)',
    lists: [
      { id: 'n2-w1d1', label: 'Week 1, Day 1' },
      { id: 'n2-w1d2', label: 'Week 1, Day 2' },
      { id: 'n2-w1d3', label: 'Week 1, Day 3' },
      { id: 'n2-w2d1', label: 'Week 2, Day 1' },
      { id: 'n2-w2d2', label: 'Week 2, Day 2' },
      { id: 'n2-w2d3', label: 'Week 2, Day 3' },
      { id: 'n2-w3d1', label: 'Week 3, Day 1' },
      { id: 'n2-w3d2', label: 'Week 3, Day 2' },
      { id: 'n2-w3d3', label: 'Week 3, Day 3' },
      { id: 'n2-w4d1', label: 'Week 4, Day 1' },
      { id: 'n2-w4d2', label: 'Week 4, Day 2' },
      { id: 'n2-w4d3', label: 'Week 4, Day 3' },
    ],
  },
  {
    id: 'nsm-n2-a2',
    personal: true,
    label: 'Nihongo So-Matome N2 (A-2)',
    lists: [
      { id: 'n2-a2-w1d1', label: 'Week 1, Day 1' },
      { id: 'n2-a2-w1d2', label: 'Week 1, Day 2' },
      { id: 'n2-a2-w1d3', label: 'Week 1, Day 3' },
      { id: 'n2-a2-w2d1', label: 'Week 2, Day 1' },
      { id: 'n2-a2-w2d2', label: 'Week 2, Day 2' },
      { id: 'n2-a2-w2d3', label: 'Week 2, Day 3' },
      { id: 'n2-a2-w3d1', label: 'Week 3, Day 1' },
      { id: 'n2-a2-w3d2', label: 'Week 3, Day 2' },
      { id: 'n2-a2-w3d3', label: 'Week 3, Day 3' },
      { id: 'n2-a2-w4d1', label: 'Week 4, Day 1' },
      { id: 'n2-a2-w4d2', label: 'Week 4, Day 2' },
      { id: 'n2-a2-w4d3', label: 'Week 4, Day 3' },
    ],
  },
]

// Sources a given viewer should see. A personal source belongs to one account:
// VITE_PERSONAL_USER_ID names it, and with that unset nobody sees them, which
// is the right default for anyone else running this app.
//
// This governs what is OFFERED, not what is reachable — the word files ship in
// the bundle like every other list. It declutters; it is not access control.
export function visibleSources(userId) {
  const owner = import.meta.env?.VITE_PERSONAL_USER_ID
  return WORD_SOURCES.filter(s => !s.personal || (owner && userId === owner))
}
