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
| `lamp-on.svg` | lit | default mark; reviews card when reviews are due |
| `lamp-off.svg` | unlit | reviews card when nothing is due; 404; offline |

`-bg` variants carry the `#1E1E1E` background baked in, for app icons and share
images only. In the UI always use the transparent versions.

Rules:
- Render only at 16, 24, 48, 96 px (or any multiple of 32). Other sizes blur.
  Always `image-rendering: pixelated` on `<img>`; the SVGs already carry
  `shape-rendering: crispEdges`.
- No recolouring, no rotation, no mirroring, no drop shadow, no CSS glow.
  The glow is drawn in — the yellow window and orange core are the glow.
- Never give it a face.
- It never animates in the nav bar. It may animate in two places: the reviews
  card when its state changes (stepped on↔off swap, no crossfade), and a loading
  state (on/off alternating at ~600 ms, `steps(1)`). Reduced-motion: static lit.

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

It does NOT appear as: module colours, card backgrounds, headings, icons,
progress bars, badges, or error/wrong states.

**Module accents are gone.** Every module renders in the base greys with `BRAND`
for its one primary action. Module identity comes from its pixel icon and its
name, not a hue. Module icons stay as they are — multicolour PICO-8
illustrations, like book covers. Illustration may use the whole PICO-8 palette;
chrome may not.

**Semantic colours are unchanged.** `SUCCESS/WARNING/DANGER`, `SEGMENT_COLORS`
and `DRILL_COLORS` keep their current values. `DRILL_COLORS.again` is a true
red (`rgb(192,57,43)`); `BRAND` is a pink-red. They are visibly different and
live in different places (judgment row vs. primary actions), so no collision.

**Contrast, for reference**
- `BRAND` on bg 4.25:1 → OK for buttons/borders/large text, not body text.
- `ON_BRAND` on `BRAND` 4.25:1 → button labels ≥ FS_BASE, DotGothic.
- `BRAND_TEXT` on bg 5.7:1 → AA body text.
- `CAP #C2C3C7` on bg 9.6:1.

## 4. Where the brand shows up

| surface | treatment |
|---|---|
| Nav | `lamp-on` at 24 px + `Lantern` at FS_NAV, top-left, home link, static |
| Header avatar | `BRAND` tint, top-right, every page, static |
| Home — New card | `BRAND` primary button. No left edge (dropped after review). |
| Home — Reviews card | `lamp-on` at 48 px when due, `lamp-off` when queue is empty. No left edge. |
| Reviews — empty queue | `lamp-off` at 96 px, "Nothing to review", secondary button |
| Session complete | three `lamp-on` at 48 px in a row, then the existing stats |
| 404 / offline | `lamp-off` at 96 px, flat copy |
| Loading | `lamp-on`/`lamp-off` alternating, no spinner |
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
public/favicon.svg          ← replace
public/favicon.ico          ← replace
public/apple-touch-icon.png ← replace
public/icon-192.png, public/icon-512.png  ← add; reference from manifest
```

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
