export const FONT = "'DotGothic16', system-ui, sans-serif"
// Native CJK sans for Japanese word/reading content (dictionary forms,
// card faces, story questions) where the pixel FONT would hurt legibility.
// Was declared identically in five files before living here.
export const KANJI_FONT = "'Hiragino Sans', 'Yu Gothic', 'Noto Sans CJK JP', sans-serif"
// Serif counterpart of KANJI_FONT — the paper-and-print formats (Story's
// Newspaper/Letter/Postcard layouts, the promoted NewspaperLayout the News
// reader now shares). Declared once here instead of duplicated per format.
export const MINCHO_FONT = "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif CJK JP', serif"
export const TRACKING = '0.05em'
export const BORDER = '#2E2E2E'
export const TEXT = '#E8E8E8'
export const TEXT_MUTED = '#888888'

// ── Lantern brand ────────────────────────────────────────────────────────
// See brand/BRAND.md for the full spec. The one brand colour. PICO-8 red.
// Used for: the lit lantern body, the single primary action per screen, the
// left edge of the two home cards, focus rings, active chips. Nothing else.
export const BRAND = '#FF004D'

// Shade of BRAND — the lantern's shadow stripes. Use for BRAND's hover/pressed
// state and nothing else. Do not use as a second accent.
export const BRAND_DEEP = '#D80041'

// Text-safe tint of BRAND. BRAND on the #1E1E1E background is 4.25:1 — passes
// for UI components and large text, FAILS AA for body text. Use BRAND_TEXT
// (5.7:1) for links, inline emphasis, and any red text under 24px.
export const BRAND_TEXT = '#FF5C8A'

// #1E1E1E on #FF004D is 4.25:1; white on #FF004D is only 3.9:1 — on paper
// dark text wins, but on the real filled button (DotGothic16, real size)
// white read clean and this read muddy, so Button's primary variant ships
// white text instead. Kept defined for any other surface that puts text
// directly on a BRAND fill and wants the higher-contrast option.
export const ON_BRAND = '#1E1E1E'

// 15% BRAND, for tinted backgrounds (active chip, selected row, focus halo).
export const BRAND_TINT = 'rgba(255, 0, 77, 0.15)'

// Lantern-internal colours. These exist so the sprite and the UI can share a
// palette when a component echoes the lantern (loading state, review card).
// GLOW and EMBER now do double duty as ACCENT_SECONDARY's two brightest
// steps (below) — not a coincidence, the ramp is built to read as "getting
// brighter, like the lantern."
export const GLOW = '#FFEC27'   // lit window — PICO-8 10
export const EMBER = '#FFA300'  // lit window core — PICO-8 9
export const UNLIT = '#5F574F'  // unlit body — PICO-8 5
export const UNLIT_DEEP = '#3F3933'
export const CAP = '#C2C3C7'    // metal caps + hanging loop — PICO-8 6

// ── Accent-secondary ────────────────────────────────────────────────────
// One secondary accent family, not several. GLOW, EMBER, and this are all
// real PICO-8 palette colours (10 yellow, 9 orange, 4 brown) — same
// discipline BRAND itself follows (PICO-8 8). Used where an ordinal "how far
// along" ramp needs more range than grey alone — today, just
// SEGMENT_COLORS below. Explored at #/dev/segment-colors against a
// brand-forward (all-red) ramp, a cool blue ramp, and single-hue-only EMBER
// and GLOW ramps before landing on this three-step blend.
//
// A second, cool secondary (blue) was considered for contrast variety and
// set aside — nothing needs it yet, and BRAND.md's "don't add a second
// accent" discipline argues against introducing one speculatively. Revisit
// only if a real need shows up (e.g. a chart wanting more than three
// distinguishable ordinal steps).
export const ACCENT_SECONDARY_DIM = '#AB5236'  // PICO-8 4 — the ramp's dimmest/earliest step

// Sprite paths (public/). on = reviews due / caught-up moments / default mark;
// off = nothing to review / 404 / offline. No dim state — two sprites only.
export const LANTERN_ON = '/brand/lamp-on.svg'
export const LANTERN_OFF = '/brand/lamp-off.svg'

// Higher-detail pair, still 32×32 but drawn pixel-by-pixel instead of on the
// small pair's 2-px/16×16-logical grid — the small pair blurs/blocks up
// scaled past ~48px, this one holds up at illustration sizes. Reviews
// home-card cover (COVER_SIZE, matching the Practice card's textbook cover)
// is the first user; everywhere else keeps the small pair per BRAND.md §2.
export const LANTERN_ON_HERO = '/brand/lamp-on-hero.svg'
export const LANTERN_OFF_HERO = '/brand/lamp-off-hero.svg'

// The HERO pair's viewBox only (not the small pair, which stays square) is
// cropped to its true bounds (23×32 — no dead space baked in around the
// lamp shape) — anywhere a HERO sprite needs an explicit numeric width
// (rather than sizing off `height` and the image's own intrinsic ratio)
// should multiply by this instead of assuming square.
export const LANTERN_ASPECT = 23 / 32

// Sizes the sprite is allowed to render at. Multiples of 32 (its native grid)
// or exactly 16/24 for chrome. Anything else blurs the pixels.
export const LANTERN_SIZES = { nav: 24, card: 48, hero: 96, favicon: 16 }

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

// Card-state distribution ramp (DistributionBar). Now built from
// ACCENT_SECONDARY — learning → young → mature literally brighten
// (ACCENT_SECONDARY_DIM → EMBER → GLOW), reading as "this card is getting
// brighter/more lit the more it's learned." `new` is CAP (inert, unlit-cap
// grey). `relearning` is BRAND_TEXT — deliberately a different hue family
// from the amber run, since it's a regression flag ("just got this wrong"),
// not a further step in the getting-brighter progression; folding it into
// the amber ramp would make it read as more-mastered, not less.
//
// Was a teal-green ramp before the rebrand (learning #4c8a7d / young #5eb6a2
// / mature #7fe0c8), documented then as CVD-validated. This replacement
// hasn't been re-run through a CVD simulator — do that before trusting it
// the way the old ramp was trusted.
export const SEGMENT_COLORS = {
  new: CAP,
  learning: ACCENT_SECONDARY_DIM,
  young: EMBER,
  mature: GLOW,
  relearning: BRAND_TEXT,
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

// Fixed height for that same row. The pre-flip placeholder ("Space or tap to
// flip") and the post-flip judgment buttons are two different renders of the
// same slot — without a shared, explicit height, whichever one had more
// content (the buttons, with a hint + sublabel) was taller than the other,
// so flipping shifted the card and everything above it. A fixed height forces
// both to match regardless of what either renders, rather than relying on
// identical padding/line-count to happen to produce the same auto height.
export const DRILL_ROW_HEIGHT = 44
