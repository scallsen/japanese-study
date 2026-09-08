// Fixed taxonomy Claude assigns per-article at generation time — must stay
// in sync with ARTICLE_CATEGORIES in scripts/fetch-nhk.mjs. Articles from
// before this taxonomy existed have `category: null` and only ever show up
// under "All".
export const CATEGORIES = [
  { id: 'politics', label: 'Politics' },
  { id: 'business', label: 'Business' },
  { id: 'sports', label: 'Sports' },
  { id: 'culture', label: 'Culture' },
  { id: 'technology', label: 'Technology' },
  { id: 'science', label: 'Science' },
  { id: 'society', label: 'Society' },
  { id: 'world', label: 'World' },
]

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]))
