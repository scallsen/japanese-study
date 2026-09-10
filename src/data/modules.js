// `tier: 'primary'` marks the two modules the dashboard renders as its large
// New / Review cards; everything else is a secondary ModuleCard.
//
// Modules no longer carry their own accent colour (brand/BRAND.md §3, §7) —
// Lantern has one brand colour, BRAND, used everywhere a module used to have
// its own hue. Module identity comes from its icon and name.
export const MODULES = [
  {
    id: 'school-vocab',
    label: 'Vocabulary',
    sublabel: 'Drill vocabulary words manually',
    tier: 'primary',
    stats: null,
    href: '#/vocab',
    external: false,
    requiresAuth: false,
  },
  {
    id: 'vocab-srs',
    label: 'Reviews',
    sublabel: 'A simple spaced repetition tool for vocabulary',
    tier: 'primary',
    stats: null,
    href: '#/vocab-srs',
    external: false,
    requiresAuth: true,
  },
  {
    id: 'anime-vocab',
    label: 'Anime vocabulary',
    sublabel: 'Drill vocabulary from anime, drama, and more',
    icon: '/module-icons/module-anime.svg',
    stats: null,
    href: '#/anime-vocab',
    external: false,
    requiresAuth: false,
  },
  {
    id: 'story',
    label: 'Story generator',
    sublabel: 'Generate content using words you know',
    icon: '/module-icons/module-generate.svg',
    stats: null,
    href: '#/story',
    external: false,
    requiresAuth: false,
  },
  {
    id: 'immersion',
    label: 'News reader',
    sublabel: 'Read up-to-date Japanese news',
    icon: '/module-icons/module-news.svg',
    stats: null,
    href: '#/immersion',
    external: false,
    requiresAuth: false,
  },
  {
    id: 'dictionary',
    label: 'Dictionary',
    sublabel: 'Look up kanji and vocabulary',
    icon: '/module-icons/module-dictionary.svg',
    stats: null,
    href: '#/dictionary',
    external: false,
    requiresAuth: false,
  },
  {
    id: 'katsuyou',
    label: 'Conjugation Drill',
    sublabel: 'Practice conjugating verb forms and adjectives',
    stats: null,
    href: 'https://scallsen.ca/katsuyou-drill/',
    external: true,
    requiresAuth: false,
  },
]
