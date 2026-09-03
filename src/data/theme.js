export const FONT = "'DotGothic16', system-ui, sans-serif"
// Native CJK sans for Japanese word/reading content (dictionary forms,
// card faces, story questions) where the pixel FONT would hurt legibility.
// Was declared identically in five files before living here.
export const KANJI_FONT = "'Hiragino Sans', 'Yu Gothic', 'Noto Sans CJK JP', sans-serif"
export const TRACKING = '0.05em'
export const BORDER = '#2E2E2E'
export const TEXT = '#E8E8E8'
export const TEXT_MUTED = '#888888'

export const FS_SM = 13
export const FS_BASE = 15  // THE DEFAULT — use this for body/UI text unless a specific token below actually fits better (a badge, a caption, nav). Don't reach for a different size just because it "looks nicer" here.
export const FS_NAV = 16

export const SUBHEADING_STYLE = { fontSize: FS_BASE, textTransform: 'uppercase', letterSpacing: '0.08em' }

// Semantic font sizes — all FS_BASE for now, adjust as a group
export const FS_BADGE = 12         // inline pill labels: source, difficulty, JLPT, POS, "common"
export const FS_CAPTION = FS_BASE  // dates, hints, secondary metadata below controls
export const FS_HEADING = FS_BASE  // screen/section headings ("No active decks", panel headings)
export const FS_ENTRY = FS_BASE    // dictionary word form, word popup content

// General heading — proven reused across 3 unrelated contexts already
// (article reader title, module stat summary, grammar node heading), not a
// one-off despite living near the exceptions below. Reach for this for any
// new section/content heading before inventing another size.
export const FS_CONTENT_HEADING = 22

// Exceptions: intentionally outside the semantic token system — each tied to
// one specific screen's specific content, not general-purpose sizes.
export const FS_DISPLAY_HEADING = 28  // done-screen "Session complete"
export const FS_STAT_VALUE = 24       // done-screen reviewed / again / time numbers
// WATCH — FS_LIST_TITLE, FS_STAT_VALUE, and FS_DISPLAY_HEADING are single-use
// today but plausible candidates for promotion to general tokens (a FeedCard's
// title, a HUD's stat number, a completion headline elsewhere). Don't
// consolidate on a hunch — confirm when FeedCard/HUD/verdict-style components
// actually get built and reuse becomes real, the same way FS_CONTENT_HEADING
// just did.
export const FS_LIST_TITLE = 17       // article card title in list view
export const FS_ENTRY_WORD = 20       // word form in dictionary results & word popup
export const FS_ENTRY_KANJI = 36      // dictionary large kanji display
export const FS_ENTRY_HEADING = 52    // dictionary entry page primary word/kanji display
export const FS_ENTRY_ALT = 18        // dictionary entry page alternate word forms
export const FS_ARTICLE_BODY = 18     // article body text (reading-optimised, do not normalise)

// Spacing — a deliberately small scale (doubling-ish progression), not a
// catalogue of every pixel value already in use. New component code should
// reach for one of these six first; a literal is still fine for a specific,
// real reason (e.g. the '10px 14px' row-padding pairing several components
// share) the same way FS_DISPLAY_HEADING etc. below are named exceptions
// rather than part of the general type scale. Retrofitting existing inline
// styles onto these is a separate, deliberate pass, not a side effect of
// adding this list.
export const SPACE_4 = 4    // tightest — icon-to-label gaps, a stacked label/subtext pair
export const SPACE_8 = 8    // compact gaps — chip rows, tight groupings
export const SPACE_12 = 12  // THE DEFAULT — the standard gap/padding. Use this unless a specific reason (tighter grouping, section-level separation) calls for one of the others.
export const SPACE_16 = 16  // standard card/section padding
export const SPACE_24 = 24  // page-level padding, section separation
export const SPACE_32 = 32  // large section breaks

// Semantic tones (Tailwind-derived light tints for dark text — see the
// DRILL_COLORS note below for why the drill palette is NOT these). Badge and
// Button read these; Story's grading result and error lines are the first
// non-component consumers, replacing a module red and the core teal that had
// been standing in for "wrong" and "right".
export const SUCCESS = '#4ade80'
export const WARNING = '#fbbf24'
export const DANGER = '#f87171'

// ── Component colour sets ────────────────────────────────────────────────
// These live here rather than in their components so every colour the app
// uses is declared in one file, and so the components themselves stay
// export-only-components (react-refresh).

// Card-state distribution ramp (DistributionBar). An ordinal ramp —
// learning → young → mature get progressively lighter — deliberately
// validated for colour-vision deficiency and contrast. NOT drift toward the
// semantic tokens; don't "reconcile" it onto success/warning without redoing
// that check. `new` sits outside the ramp as inert grey on purpose.
export const SEGMENT_COLORS = {
  new: '#aaaaaa',
  learning: '#4c8a7d',
  young: '#5eb6a2',
  mature: '#7fe0c8',
  relearning: '#e0a72e',
}

// Drill judgment buttons (DrillButton). A Flat-UI lineage that predates and
// sits outside the Tailwind-derived semantic tokens above: these are solid
// fills behind white text, where the semantic tokens are light tints meant
// for dark text, so they are not interchangeable — and "easy" blue has no
// semantic equivalent at all.
export const DRILL_COLORS = {
  again: 'rgba(192,57,43,0.85)',
  hard: 'rgba(180,120,40,0.85)',
  good: 'rgba(39,174,96,0.85)',
  easy: 'rgba(41,128,185,0.85)',
}

// Standard width for every drill control row — the flip card, the judgment
// buttons, and the undo slot share it so they stack in one aligned column.
export const DRILL_ROW_WIDTH = 'min(380px, calc(100vw - 32px))'
