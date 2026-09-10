# Lantern — brand package

Product name: **Lantern**. Domain: **lantern.study**. One word in the product; the
domain says "study" so the app doesn't have to.

This folder is the source of truth for the identity. `tokens.js` is a drop-in for
`src/data/theme.js`; `sprites/` are Simon's own 32×32 pixel lanterns; `favicon/`
is generated from them; `CLAUDE-addendum.md` is the paragraph to paste into the
repo's `CLAUDE.md` so Claude Code applies all of this consistently.

---

## 1. Name and wordmark

- The name is `Lantern`. Never `Lantern Study`, never `lantern.study` as a label.
- Wordmark = the word `Lantern` set in **DotGothic16-Modified** (the kerning-fixed
  font already in `public/fonts/`). Sentence case. No custom lettering.
- Lockup = lantern sprite + wordmark, left-aligned, sprite baseline-centred on the
  text, gap `SPACE_8`. That is the logo. There is no other logo.
- 🏮 (U+1F3EE, "izakaya lantern") is the text-only stand-in: GitHub description,
  Discord, tweets. Never alongside the sprite. Never in the UI.
- Page title: `Lantern`. Landing/README title: `Lantern — Japanese vocabulary`.

## 2. The mark

Two sprites, both 32×32, drawn on a 2-px grid (16×16 logical pixels):

| file | state | when |
|---|---|---|
| `lamp-on.svg` | lit | default mark; small UI instances (nav, session-complete, loading, empty-queue badge) |
| `lamp-off.svg` | unlit | same, unlit state; 404; offline |

`-bg` variants carry the `#1E1E1E` background baked in, for app icons and share
images only. In the UI always use the transparent versions.

**`-hero` variants** (`lamp-on-hero.svg` / `lamp-off-hero.svg`) — a second pair,
still 32×32 but drawn pixel-by-pixel rather than on the small pair's 2-px grid,
so they hold up at illustration size instead of blurring/blocking up.
Transparent, like the small pair (not baked-in like `-bg` — the first version
of this pair was, and it showed up as a mismatched darker square, since it
baked in the page background `#1E1E1E` rather than the card's own lighter
`SURFACE`; transparent fixes that). Its viewBox is also cropped to its true
23×32 bounds (5px of dead canvas on the left, 4px on the right, trimmed) —
the small pair stays on its original square 32×32 canvas untouched, this
crop is illustration-only. `LANTERN_ASPECT` (theme.js) is 23/32 for the one
spot that needs an explicit numeric width against it. First and currently
only use: the Reviews home card's `cover` slot, at `COVER_SIZE` (104px,
matching the Practice card's textbook cover) — the Reviews card gets a real
illustration now instead of a small badge.
Every other instance in §4's table keeps the small pair.

Rules:
- Render only at 16, 24, 48, 96 px (or any multiple of 32). Other sizes blur.
  Always `image-rendering: pixelated` on `<img>`; the SVGs already carry
  `shape-rendering: crispEdges`.
- No recolouring, no rotation, no mirroring. The glow is drawn in — the yellow
  window and orange core are the glow — **except** the one loading-state CSS
  glow below, added after a live-review pass; every other instance stays flat.
- Never give it a face.
- It never animates in the nav bar. It animates in two places:
  - **Reviews card**, on its own state change: stepped on↔off swap, no crossfade.
  - **Loading** (`CenteredLoadingMessage`, `.lantern-pulse` in global.css): the
    sprite itself stays fully lit and opaque — it does **not** dim or swap to
    `lamp-off` — only a soft `filter: drop-shadow()` glow around it breathes,
    BRAND-coloured, ~1800ms ease-in-out. Reads as "steadily working," not
    "flickering." First shipped in EMBER (the lantern's own window-core
    colour), swapped to BRAND after a live-review pass — ties the loading
    state to the app's own accent directly. Two earlier mechanism versions
    were also tried and retired: a hard on/off `steps(1)` crossfade between
    the two sprites, then an eased version that also dimmed the lit
    sprite's own opacity — both are kept live for
    comparison at `#/dev/accent-polish`, not used anywhere real any more.
    Reduced-motion: static lit, no glow.

## 3. Colour

Base is unchanged (`#1E1E1E` bg, `#313131` surface, `#2E2E2E` border,
`#E8E8E8` text, `#888888` muted).

**One brand colour: `BRAND #FF004D`** (PICO-8 red). It appears in exactly these places:

1. The lit lantern.
2. The single primary button per screen — fill `BRAND`, text **white** (`#fff`),
   hover/pressed `BRAND_DEEP`. The contrast math below called for `ON_BRAND`
   here; on the actual filled button (DotGothic16, real size) white read
   clean and `ON_BRAND` read muddy — visual review overrode the math, and
   white is what shipped. `ON_BRAND` stays defined for any other surface
   that puts text directly on a `BRAND` fill.
3. The header avatar (top-right, every page) — tinted `BRAND`, same recipe
   as `Button`'s `accent-outline`. It's the one place BRAND shows up as a
   fixed, page-independent mark rather than a per-screen action.
4. Focus rings, active/selected chips (`BRAND_TINT` background, `BRAND` border).
5. Links and small red text — as `BRAND_TEXT #FF5C8A`, never raw `BRAND`.

The two primary home cards (New, Reviews) originally carried a 4-px `BRAND`
left edge — dropped after visual review. They carry no left-edge colour now.

`BRAND` itself does NOT appear as: module colours, card backgrounds,
headings, icons, badges, or error/wrong states. It does now appear in one
progress bar — see Accent-secondary below, which is a different colour
(`BRAND_TEXT`) used narrowly, not raw `BRAND` spread across the bar.

**Module accents are gone.** Every module renders in the base greys with `BRAND`
for its one primary action. Module identity comes from its pixel icon and its
name, not a hue. Module icons stay as they are — multicolour PICO-8
illustrations, like book covers. Illustration may use the whole PICO-8 palette;
chrome may not.

**Semantic colours are unchanged.** `SUCCESS/WARNING/DANGER` and `DRILL_COLORS`
keep their current values. `DRILL_COLORS.again` is a true red (`rgb(192,57,43)`);
`BRAND` is a pink-red. They are visibly different and live in different places
(judgment row vs. primary actions), so no collision. `SEGMENT_COLORS` is
**not** semantic-unchanged any more — see Accent-secondary below.

**Contrast, for reference**
- `BRAND` on bg 4.25:1 → OK for buttons/borders/large text, not body text.
- `ON_BRAND` on `BRAND` 4.25:1 → defined for any surface that wants it, but
  `Button`'s primary variant ships white text instead — see above.
- `BRAND_TEXT` on bg 5.7:1 → AA body text.
- `CAP #C2C3C7` on bg 9.6:1.

## 3a. Accent-secondary

One secondary accent family, not several: `GLOW #FFEC27` (PICO-8 10, the
lantern's lit window) and `EMBER #FFA300` (PICO-8 9, the window's core),
plus one more real PICO-8 colour, `ACCENT_SECONDARY_DIM #AB5236` (PICO-8 4,
brown), for a third ordinal step darker than either. All three are genuine
PICO-8 palette entries — same discipline `BRAND` itself follows (PICO-8 8).

**Used for:** `SEGMENT_COLORS`, the card-mastery ramp on `DistributionBar`
(Dashboard sidebar, and each deck row on the Reviews home screen):

```js
SEGMENT_COLORS = {
  new: CAP,                    // inert, unlit-cap grey
  learning: ACCENT_SECONDARY_DIM,
  young: EMBER,
  mature: GLOW,
  relearning: BRAND_TEXT,      // regression flag, not part of the amber run
}
```

The ramp reads as "this card gets brighter as it's learned" — the same way
the lantern's own window lights up. `relearning` is deliberately a different
hue (`BRAND_TEXT`, not an amber shade): it means "just got this wrong,
cooling down," a regression, not a further step of mastery — folding it into
the amber run would make it read as more-learned, not less.

Explored at `#/dev/segment-colors` against a brand-forward (all-`BRAND`)
ramp, a cool-blue ramp, and single-hue-only `EMBER` and `GLOW` variants
before landing on the blend — that page stays live as the record.

**Not adding a second (cool/blue) secondary.** Considered for contrast
variety, set aside: nothing needs it yet, and it has no grounding in the
brand the way the amber pair does (they're literally the lantern's own
colours). Revisit only on a real need — e.g. a chart wanting more than three
distinguishable ordinal steps — not speculatively.

**Not re-validated for CVD.** The pre-rebrand teal ramp this replaces was
documented as CVD-checked; this one hasn't been run through an actual
simulator (none available while building it). Do that before leaning on it
for accessibility.

## 4. Where the brand shows up

| surface | treatment |
|---|---|
| Nav | `lamp-on` at 24 px + `Lantern` at FS_NAV, top-left, home link, static |
| Header avatar | `BRAND` tint, top-right, every page, static |
| Home — New card | `BRAND` primary button. No left edge (dropped after review). |
| Home — Reviews card | `lamp-on-hero`/`lamp-off-hero` at COVER_SIZE (104 px, matching the Practice card's cover), on when due. No left edge. |
| Reviews — empty queue | `lamp-off` at 96 px, "Nothing to review", secondary button |
| Session complete | three `lamp-on` at 48 px in a row, then the existing stats |
| 404 / offline | `lamp-off` at 96 px, flat copy |
| Loading | `lamp-on`, static + a soft breathing BRAND glow (`.lantern-pulse`), no spinner |
| Favicon / tab | `favicon.svg` (= lamp-on), `favicon.ico` fallback |
| iOS / PWA icon | `apple-touch-icon.png`, `icon-192/512.png` (bg versions) |

Copy near the lantern is flat: "Nothing to review", "112 reviews waiting",
"Session complete". The lantern carries the mood; the words don't.

## 5. Typography

Unchanged. DotGothic16-Modified for all UI; `KANJI_FONT`/`MINCHO_FONT` for
Japanese content. The brand adds no new type sizes — the wordmark uses `FS_NAV`
in the nav and `FS_DISPLAY_HEADING` on the landing page.

## 6. Install

```
public/brand/lamp-on.svg
public/brand/lamp-off.svg
public/brand/lamp-on-hero.svg
public/brand/lamp-off-hero.svg
public/favicon.svg          ← replace
public/favicon.ico          ← replace
public/apple-touch-icon.png ← replace
public/icon-192.png, public/icon-512.png  ← add; reference from manifest
```

**Regenerating the raster icons** (favicon.ico, apple-touch-icon.png, icon-192/512.png)
when a sprite changes — no design tool involved, just ImageMagick against the SVGs
already in this repo:

```
# favicon.ico — from the small pair (transparent, tiny-instance sprite)
magick -background none brand/sprites/lamp-on.svg -filter point -resize 16x16 /tmp/favicon-16.png
magick -background none brand/sprites/lamp-on.svg -filter point -resize 32x32 /tmp/favicon-32.png
magick /tmp/favicon-16.png /tmp/favicon-32.png public/favicon.ico

# apple-touch-icon.png / icon-192.png / icon-512.png — from the HERO pair,
# flattened onto opaque BG (#1E1E1E) first: iOS/PWA icons need an opaque
# source, a transparent one renders unpredictably. -filter point keeps the
# pixel edges crisp — the default filter blurs/anti-aliases them.
magick -background '#1E1E1E' brand/sprites/lamp-on-hero.svg -flatten -filter point -resize 180x180 public/apple-touch-icon.png
magick -background '#1E1E1E' brand/sprites/lamp-on-hero.svg -flatten -filter point -resize 192x192 public/icon-192.png
magick -background '#1E1E1E' brand/sprites/lamp-on-hero.svg -flatten -filter point -resize 512x512 public/icon-512.png
```

`-background none` *before* the SVG matters — set after, it's too late to affect
how the SVG itself rasterizes and the transparent regions come out white instead.
Copy the results into `brand/favicon/` too, so that folder stays a true snapshot
of what's live in `public/`.

`index.html`:
```html
<title>Lantern</title>
<meta name="theme-color" content="#1E1E1E" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

## 7. Migration order (for Claude Code)

`useModuleTheme()` has ~260 call sites. Don't touch them.

1. Paste `tokens.js` contents into `theme.js`.
2. In `ModuleThemeContext.jsx`, set `CORE_ACCENT = BRAND` and make the provider
   ignore its `accent` prop (return `BRAND` unconditionally). The whole app
   unifies in one commit. Delete `accent` from `modules.js`.
3. Replace favicon set, `<title>`, add `public/brand/` sprites.
4. Nav lockup. Home cards. Reviews-card state. Empty/done/404/loading.
5. Audit red usage against §3 — anything red that isn't in the list of five
   becomes base grey. Anything using `BRAND` as small text becomes `BRAND_TEXT`.
6. Only then, as a separate pass: remove `useModuleTheme` call by call, replacing
   with `BRAND` directly, and delete the context.

## 8. Don'ts

- Don't add a second accent "just for this module."
- Don't put `BRAND` behind body text or use it as a heading colour.
- Don't render the sprite at arbitrary sizes or apply CSS filters to it.
- Don't add a "dim" state, a streak counter, or any glow effect outside the sprite.
- Don't use the emoji in the app.
- Don't write "Lantern Study."
