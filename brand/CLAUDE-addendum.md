## Brand — Lantern

The app is **Lantern** (lantern.study). Full rules in `brand/BRAND.md`; read it
before touching colour, the nav, home cards, empty/done/error states, or icons.

Non-negotiables while working in this repo:
- One brand colour, `BRAND` (#FF004D) from `theme.js`. It appears only in: the lit
  lantern sprite, the single primary button per screen (dark `ON_BRAND` text),
  the 4-px left edge on the two home cards, focus rings and active chips
  (`BRAND_TINT`), and links as `BRAND_TEXT`. Nowhere else.
- Module accents are removed. Never introduce a per-module colour. Module
  identity is its pixel icon + name, in base greys.
- `SUCCESS/WARNING/DANGER`, `SEGMENT_COLORS`, `DRILL_COLORS` are unchanged and
  are not brand — don't reconcile them onto `BRAND`.
- The lantern sprites (`public/brand/lamp-on.svg`, `lamp-off.svg`) render at
  16/24/48/96 px only, `image-rendering: pixelated`, never recoloured, filtered,
  or animated in the nav. Reviews card: `lamp-on` when reviews are due,
  `lamp-off` when the queue is empty. No dim state.
- The wordmark is the word `Lantern` in DotGothic16-Modified. No custom lettering,
  no emoji in the UI, never "Lantern Study".
- Copy next to the lantern stays flat and short; the sprite carries the tone.
