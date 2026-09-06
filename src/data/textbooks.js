// One textbook has chapters — that's the whole model. The learner works
// through one book at a time at their own pace (no daily/weekly assumption),
// and `chapters` is the ordered progression path. A chapter's `id` is the
// listKey its words carry in src/data/words/*.json; books with no word data
// yet still list their chapters so the picker can show them as "no words yet".
// Chapter labels follow each book's own naming (Genki: "Lesson 1";
// So-Matome: "Week 1, Day 1"), never a generic "Chapter N".

function lessons(prefix, from, to) {
  const out = []
  for (let n = from; n <= to; n++) out.push({ id: `${prefix}-l${n}`, label: `Lesson ${n}` })
  return out
}

function topics(prefix, count) {
  const out = []
  for (let n = 1; n <= count; n++) out.push({ id: `${prefix}-t${n}`, label: `Topic ${n}` })
  return out
}

function weekDays(prefix, weeks, days = 3) {
  const out = []
  for (let w = 1; w <= weeks; w++) {
    for (let d = 1; d <= days; d++) out.push({ id: `${prefix}-w${w}d${d}`, label: `Week ${w}, Day ${d}` })
  }
  return out
}

const ICONS = '/placeholder-svg'

// Every cover is a 32×32 pixel-art canvas whose artwork occupies x 5–27, so
// 5/32 of each side is transparent gutter. Anything laying a cover out has to
// pull that off the margin, or the eye reads the phantom space as
// misalignment. Recheck this if a new cover is drawn to different bounds.
export const COVER_GUTTER_FRACTION = 5 / 32

// Amazon runs a separate storefront per country and a search on the wrong one
// finds nothing you can actually buy. Timezone is the best proxy available:
// navigator.language commonly reports en-US for someone living in Japan, while
// the timezone follows where the machine is. A wrong guess still lands on a
// working search, so this errs toward the larger catalogue.
function amazonHost() {
  try {
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Tokyo') return 'www.amazon.co.jp'
  } catch { /* no Intl — fall through */ }
  return 'www.amazon.com'
}

// Retailer *search* links, not product pages: a search URL keeps working where
// a hardcoded product id rots as soon as an edition changes. `extra` is for a
// publisher's own page, which is the better first link when a book has one.
// Kinokuniya is named for its US storefront because that is the one linked —
// kinokuniya.co.jp is a separate site and does not answer the same URL shape.
function storeLinks(query, extra = []) {
  return [
    ...extra,
    { label: 'Amazon', href: `https://${amazonHost()}/s?k=${encodeURIComponent(query)}` },
    { label: 'Kinokuniya US', href: `https://united-states.kinokuniya.com/products?keyword=${encodeURIComponent(query)}` },
  ]
}

// The publisher's own site for Genki, which is where the audio, answer keys and
// errata live — more useful to a learner than either retailer.
const GENKI_ONLINE = [{ label: 'Genki Online', href: 'https://genki3.japantimes.co.jp/en/' }]

// ASK's own page for the revised N3 kanji volume, by ISBN — the edition whose
// six-week structure the chapters here follow.
const SOMATOME_N3_KANJI = [{ label: 'ASK Publishing', href: 'https://ask-books.com/book-details/?slug=9784866394961' }]

export const TEXTBOOKS = [
  {
    id: 'genki-1',
    title: 'Genki 1',
    subtitle: 'Beginner · N5',
    publisher: 'The Japan Times',
    description: 'The standard first-year course, 3rd edition. Twelve lessons of dialogue, grammar notes and drills, taught in kana and kanji from the very start.',
    purchase: storeLinks('Genki 1 Japanese textbook third edition', GENKI_ONLINE),
    icon: `${ICONS}/genki-1.svg`,
    chapters: lessons('genki-1', 1, 12),
  },
  {
    id: 'genki-2',
    title: 'Genki 2',
    subtitle: 'Beginner · N4',
    publisher: 'The Japan Times',
    description: 'The second half, lessons 13 to 23. Passive, causative and the polite registers that trip up most beginners, still 3rd edition.',
    purchase: storeLinks('Genki 2 Japanese textbook third edition', GENKI_ONLINE),
    icon: `${ICONS}/genki-2.svg`,
    chapters: lessons('genki-2', 13, 23),
  },
  {
    id: 'quartet-1',
    title: 'Quartet 1',
    subtitle: 'Intermediate · N3',
    publisher: 'The Japan Times',
    description: 'Intermediate and reading-led: each chapter opens with a long text, then builds grammar, listening and writing around it.',
    purchase: storeLinks('Quartet 1 Intermediate Japanese textbook'),
    icon: `${ICONS}/quartet-1.svg`,
    chapters: lessons('quartet-1', 1, 6),
  },
  {
    id: 'quartet-2',
    title: 'Quartet 2',
    subtitle: 'Intermediate · N2',
    publisher: 'The Japan Times',
    description: 'The second half of Quartet, working up to essays, reports and the denser written registers expected at N2.',
    purchase: storeLinks('Quartet 2 Intermediate Japanese textbook'),
    icon: `${ICONS}/quartet-2.svg`,
    chapters: lessons('quartet-2', 7, 12),
  },
  {
    id: 'marugoto-a1-rikai',
    title: 'Marugoto A1 Rikai',
    subtitle: 'Starter · A1',
    publisher: 'The Japan Foundation',
    description: 'The Rikai volume — the grammar and vocabulary side of Marugoto\'s beginner course, organised by everyday topic.',
    purchase: storeLinks('Marugoto A1 Rikai'),
    icon: `${ICONS}/marugoto-a1-rikai.svg`,
    chapters: topics('marugoto-a1-rikai', 9),
  },
  {
    id: 'marugoto-a1-katsudou',
    title: 'Marugoto A1 Katsudou',
    subtitle: 'Starter · A1',
    publisher: 'The Japan Foundation',
    description: 'The Katsudou volume — the speaking and listening companion to Rikai, built around the same nine topics.',
    purchase: storeLinks('Marugoto A1 Katsudou'),
    icon: `${ICONS}/marugoto-a1-katsudou.svg`,
    chapters: topics('marugoto-a1-katsudou', 9),
  },
  // So-Matome N3 Kanji follows the book: 6 weeks of 6 vocabulary days. (The
  // book's day 7 each week is review and introduces nothing, so it has no
  // chapter.) It was rebuilt from a course's own re-chunking of the same book —
  // see scripts/migrate-somatome-kanji.mjs.
  {
    id: 'nsm-n3-kanji',
    title: 'Nihongo So-Matome N3 Kanji',
    subtitle: 'Kanji · N3',
    publisher: 'ASK Publishing',
    description: 'JLPT N3 kanji in six weeks of short daily sets, each day themed around a handful of characters. Every seventh day is review and teaches nothing new, which is why there are 36 chapters rather than 42.',
    purchase: storeLinks('Nihongo So-matome N3 kanji', SOMATOME_N3_KANJI),
    icon: `${ICONS}/nihongo-so-matome-kanji-n3.svg`,
    chapters: weekDays('nsm-n3-kanji', 6, 6),
  },
  // Course material rather than published books: one class's own chunking of a
  // So-Matome volume, with its own example sentences. The words live in the
  // learner's account (custom_words), so these appear only for whoever owns
  // them — the picker offers a book when it has words for the viewer, and for
  // everyone else these have none.
  {
    id: 'nsm-n3',
    title: 'Coto Intermediate 3',
    subtitle: 'N3',
    publisher: 'Coto Academy',
    description: 'Coto Academy\'s own chunking of the N3 kanji book, with its own example sentences and review markers.',
    purchase: [],
    icon: `${ICONS}/nihongo-so-matome-kanji-n3.svg`,
    chapters: weekDays('nsm-n3', 4),
  },
  {
    id: 'nsm-n3-i4',
    title: 'Coto Intermediate 4',
    subtitle: 'N3',
    publisher: 'Coto Academy',
    description: 'The second term of the same N3 material.',
    purchase: [],
    icon: `${ICONS}/nihongo-so-matome-kanji-n3.svg`,
    chapters: weekDays('nsm-n3-i4', 4),
  },
  {
    id: 'nsm-n3-i5',
    title: 'Coto Intermediate 5',
    subtitle: 'N3',
    publisher: 'Coto Academy',
    description: 'The third term of the same N3 material.',
    purchase: [],
    icon: `${ICONS}/nihongo-so-matome-kanji-n3.svg`,
    chapters: weekDays('nsm-n3-i5', 4),
  },
  {
    id: 'nsm-n2-a1',
    title: 'Coto Advanced 1',
    subtitle: 'N2',
    publisher: 'Coto Academy',
    description: 'Coto Academy\'s own chunking of the N2 material, with its own example sentences.',
    purchase: [],
    icon: `${ICONS}/nihongo-so-matome-kanji-n2.svg`,
    chapters: weekDays('n2', 4),
  },
  {
    id: 'nsm-n2-a2',
    title: 'Coto Advanced 2',
    subtitle: 'N2',
    publisher: 'Coto Academy',
    description: 'The second term of the same N2 material.',
    purchase: [],
    icon: `${ICONS}/nihongo-so-matome-kanji-n2.svg`,
    chapters: weekDays('n2-a2', 4),
  },
]

export function getTextbook(id) {
  return TEXTBOOKS.find(t => t.id === id) ?? null
}
