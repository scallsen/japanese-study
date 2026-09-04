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

export const TEXTBOOKS = [
  { id: 'genki-1', title: 'Genki 1', subtitle: 'Beginner · N5', icon: `${ICONS}/genki-1.svg`, chapters: lessons('genki-1', 1, 12) },
  { id: 'genki-2', title: 'Genki 2', subtitle: 'Beginner · N4', icon: `${ICONS}/genki-2.svg`, chapters: lessons('genki-2', 13, 23) },
  { id: 'quartet-1', title: 'Quartet 1', subtitle: 'Intermediate · N3', icon: `${ICONS}/quartet-1.svg`, chapters: lessons('quartet-1', 1, 6) },
  { id: 'quartet-2', title: 'Quartet 2', subtitle: 'Intermediate · N2', icon: `${ICONS}/quartet-2.svg`, chapters: lessons('quartet-2', 7, 12) },
  { id: 'marugoto-a1-rikai', title: 'Marugoto A1 Rikai', subtitle: 'Starter · A1', icon: `${ICONS}/marugoto-a1-rikai.svg`, chapters: topics('marugoto-a1-rikai', 9) },
  { id: 'marugoto-a1-katsudou', title: 'Marugoto A1 Katsudou', subtitle: 'Starter · A1', icon: `${ICONS}/marugoto-a1-katsudou.svg`, chapters: topics('marugoto-a1-katsudou', 9) },
  // The two So-Matome entries are the only books with word data today — their
  // chapter ids are the existing nsm-n3-* / n2-* listKeys.
  { id: 'nsm-n3', title: 'Nihongo So-Matome N3', subtitle: 'Vocabulary · N3', icon: `${ICONS}/nihongo-so-matome-kanji-n3.svg`, chapters: weekDays('nsm-n3', 4) },
  { id: 'nsm-n2', title: 'Nihongo So-Matome N2', subtitle: 'Vocabulary · N2', icon: `${ICONS}/nihongo-so-matome-kanji-n2.svg`, chapters: weekDays('n2', 4) },
  { id: 'nsm-n1', title: 'Nihongo So-Matome N1', subtitle: 'Vocabulary · N1', icon: `${ICONS}/nihongo-so-matome-kanji-n1.svg`, chapters: weekDays('nsm-n1', 8) },
]

export function getTextbook(id) {
  return TEXTBOOKS.find(t => t.id === id) ?? null
}
