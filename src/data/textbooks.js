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

// Retailer *search* links, not product pages: a search URL keeps working
// where a hardcoded product id rots as soon as an edition changes. Swap in
// real product links per book if you'd rather point at exact editions.
function storeLinks(query) {
  return [
    { label: 'Amazon', href: `https://www.amazon.com/s?k=${encodeURIComponent(query)}` },
    { label: 'Kinokuniya', href: `https://united-states.kinokuniya.com/products?keyword=${encodeURIComponent(query)}` },
  ]
}

export const TEXTBOOKS = [
  {
    id: 'genki-1',
    title: 'Genki 1',
    subtitle: 'Beginner · N5',
    publisher: 'The Japan Times',
    description: 'The standard first-year course. Twelve lessons of dialogue, grammar notes and drills, taught in kana and kanji from the start.',
    purchase: storeLinks('Genki 1 Japanese textbook third edition'),
    icon: `${ICONS}/genki-1.svg`,
    chapters: lessons('genki-1', 1, 12),
  },
  {
    id: 'genki-2',
    title: 'Genki 2',
    subtitle: 'Beginner · N4',
    publisher: 'The Japan Times',
    description: 'Picks up at lesson 13 and runs to 23, working through passive, causative and the polite registers that trip up most beginners.',
    purchase: storeLinks('Genki 2 Japanese textbook third edition'),
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
  // The two So-Matome entries are the only books with word data today — their
  // chapter ids are the existing nsm-n3-* / n2-* listKeys.
  {
    id: 'nsm-n3',
    title: 'Nihongo So-Matome N3',
    subtitle: 'Vocabulary · N3',
    publisher: 'ASK Publishing',
    description: 'JLPT N3 vocabulary drilling, split into short daily sets rather than long chapters. Built for a steady pace toward the test.',
    purchase: storeLinks('Nihongo So-matome N3 vocabulary'),
    icon: `${ICONS}/nihongo-so-matome-kanji-n3.svg`,
    chapters: weekDays('nsm-n3', 4),
  },
  {
    id: 'nsm-n2',
    title: 'Nihongo So-Matome N2',
    subtitle: 'Vocabulary · N2',
    publisher: 'ASK Publishing',
    description: 'The N2 volume of the same series — denser vocabulary in the same daily-set format.',
    purchase: storeLinks('Nihongo So-matome N2 vocabulary'),
    icon: `${ICONS}/nihongo-so-matome-kanji-n2.svg`,
    chapters: weekDays('n2', 4),
  },
  {
    id: 'nsm-n1',
    title: 'Nihongo So-Matome N1',
    subtitle: 'Vocabulary · N1',
    publisher: 'ASK Publishing',
    description: 'The N1 volume: the widest vocabulary range in the series, including formal and written-only words.',
    purchase: storeLinks('Nihongo So-matome N1 vocabulary'),
    icon: `${ICONS}/nihongo-so-matome-kanji-n1.svg`,
    chapters: weekDays('nsm-n1', 8),
  },
]

export function getTextbook(id) {
  return TEXTBOOKS.find(t => t.id === id) ?? null
}
