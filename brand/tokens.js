// ── Lantern brand tokens ─────────────────────────────────────────────────
// Paste into src/data/theme.js (below TEXT_MUTED). Everything colour-related
// that is *brand* lives here; semantic tones (SUCCESS/WARNING/DANGER),
// SEGMENT_COLORS and DRILL_COLORS are unchanged and stay where they are.

// The one brand colour. PICO-8 red. Used for: the lit lantern body, the single
// primary action per screen, the left edge of the two home cards, focus rings,
// active chips. Nothing else.
export const BRAND = '#FF004D'

// Shade of BRAND — the lantern's shadow stripes. Use for BRAND's hover/pressed
// state and nothing else. Do not use as a second accent.
export const BRAND_DEEP = '#D80041'

// Text-safe tint of BRAND. BRAND on the #1E1E1E background is 4.25:1 — passes
// for UI components and large text, FAILS AA for body text. Use BRAND_TEXT
// (5.7:1) for links, inline emphasis, and any red text under 24px.
export const BRAND_TEXT = '#FF5C8A'

// Text colour on a BRAND-filled surface. #1E1E1E on #FF004D is 4.25:1;
// white on #FF004D is only 3.9:1. Dark text wins.
export const ON_BRAND = '#1E1E1E'

// 15% BRAND, for tinted backgrounds (active chip, selected row, focus halo).
export const BRAND_TINT = 'rgba(255, 0, 77, 0.15)'

// Lantern-internal colours. These exist so the sprite and the UI can share a
// palette when a component echoes the lantern (loading state, review card).
// They are NOT general-purpose accents.
export const GLOW = '#FFEC27'   // lit window
export const EMBER = '#FFA300'  // lit window core
export const UNLIT = '#5F574F'  // unlit body
export const UNLIT_DEEP = '#3F3933'
export const CAP = '#C2C3C7'    // metal caps + hanging loop

// Sprite paths (public/). on = reviews due / caught-up moments / default mark;
// off = nothing to review / 404 / offline. No dim state — two sprites only.
export const LANTERN_ON = '/brand/lamp-on.svg'
export const LANTERN_OFF = '/brand/lamp-off.svg'

// Sizes the sprite is allowed to render at. Multiples of 32 (its native grid)
// or exactly 16/24 for chrome. Anything else blurs the pixels.
export const LANTERN_SIZES = { nav: 24, card: 48, hero: 96, favicon: 16 }
