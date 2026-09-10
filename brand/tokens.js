// ── Lantern brand tokens ─────────────────────────────────────────────────
// Paste into src/data/theme.js (below TEXT_MUTED). Everything colour-related
// that is *brand* lives here; semantic tones (SUCCESS/WARNING/DANGER) and
// DRILL_COLORS are unchanged and stay where they are. SEGMENT_COLORS is
// NOT unchanged — see Accent-secondary in BRAND.md §3a; it now builds on
// GLOW/EMBER/ACCENT_SECONDARY_DIM below, so it must come after this block
// in theme.js, not stay where it originally lived.

// The one brand colour. PICO-8 red. Used for: the lit lantern body, the single
// primary action per screen, the header avatar, focus rings, active chips.
// Nothing else. (No longer a left edge on the two home cards — dropped after
// visual review.)
export const BRAND = '#FF004D'

// Shade of BRAND — the lantern's shadow stripes. Use for BRAND's hover/pressed
// state and nothing else. Do not use as a second accent.
export const BRAND_DEEP = '#D80041'

// Text-safe tint of BRAND. BRAND on the #1E1E1E background is 4.25:1 — passes
// for UI components and large text, FAILS AA for body text. Use BRAND_TEXT
// (5.7:1) for links, inline emphasis, and any red text under 24px.
export const BRAND_TEXT = '#FF5C8A'

// Text colour on a BRAND-filled surface. #1E1E1E on #FF004D is 4.25:1;
// white on #FF004D is only 3.9:1. On paper dark text wins, but Button's
// primary variant ships white — on the real filled button it read clean
// where ON_BRAND read muddy. Kept defined for any other surface that wants
// the higher-contrast option.
export const ON_BRAND = '#1E1E1E'

// 15% BRAND, for tinted backgrounds (active chip, selected row, focus halo).
export const BRAND_TINT = 'rgba(255, 0, 77, 0.15)'

// Lantern-internal colours. These exist so the sprite and the UI can share a
// palette when a component echoes the lantern (loading state, review card).
// GLOW and EMBER also do double duty as ACCENT_SECONDARY's two brightest
// steps below — the ramp is built to read as "getting brighter, like the
// lantern," not a coincidence.
export const GLOW = '#FFEC27'   // lit window — PICO-8 10
export const EMBER = '#FFA300'  // lit window core — PICO-8 9
export const UNLIT = '#5F574F'  // unlit body — PICO-8 5
export const UNLIT_DEEP = '#3F3933'
export const CAP = '#C2C3C7'    // metal caps + hanging loop — PICO-8 6

// ── Accent-secondary (BRAND.md §3a) ──────────────────────────────────────
// One secondary accent family, not several. GLOW, EMBER, and this are all
// real PICO-8 palette colours (10, 9, 4) — same discipline BRAND follows.
// Feeds SEGMENT_COLORS (below theme.js's existing SUCCESS/WARNING/DANGER
// block) — see BRAND.md §3a for the full ramp and why a second, cool
// secondary was considered and set aside.
export const ACCENT_SECONDARY_DIM = '#AB5236'  // PICO-8 4 — the ramp's dimmest/earliest step

// Sprite paths (public/). on = reviews due / caught-up moments / default mark;
// off = nothing to review / 404 / offline. No dim state — two sprites only.
export const LANTERN_ON = '/brand/lamp-on.svg'
export const LANTERN_OFF = '/brand/lamp-off.svg'

// Higher-detail pair (BRAND.md §2) — same 32×32 canvas, pixel-by-pixel
// instead of the small pair's 2-px grid, for illustration-size renders.
// Reviews home-card cover is the only user so far.
export const LANTERN_ON_HERO = '/brand/lamp-on-hero.svg'
export const LANTERN_OFF_HERO = '/brand/lamp-off-hero.svg'

// Sizes the sprite is allowed to render at. Multiples of 32 (its native grid)
// or exactly 16/24 for chrome. Anything else blurs the pixels.
export const LANTERN_SIZES = { nav: 24, card: 48, hero: 96, favicon: 16 }
