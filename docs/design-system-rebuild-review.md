# Design-system rebuild — review log

Running log kept while porting the remaining modules onto `src/components/`.
Read top to bottom once everything is ported; each section is one module.
Three kinds of entry, tagged so they can be skimmed:

- **[INPUT]** — a judgement call I made that you may want to override. The
  code works either way; this is taste, not correctness.
- **[NEW]** — a new shared component or hook, created only where the library
  had no answer.
- **[CHANGED]** — an edit to an existing shared component, with the reason
  and which other call sites it touches.
- **[CANDIDATE]** — a pattern seen 2+ times that *could* become a component
  but wasn't needed to finish the port. Left bespoke on purpose.

Branch stack (each cut from the previous tip, none merged):
`feat/design-system` → `design-system/anime-vocab` → `design-system/dictionary`
→ `design-system/immersion` → …

---

## Cross-module (done at the start of Immersion)

- **[NEW] `src/hooks/useIsMobile.js`** — the hook was copy-pasted byte-for-byte
  into ten module/page files. Extracted once; all ten call sites migrated.
  Not a component, zero visual change. Initialiser reconciled to
  `matchMedia(...).matches` (two copies did this, eight used
  `window.innerWidth`) so first render and the change listener read the same
  query.

## Immersion (`design-system/immersion`)

Files: `ImmersionModule.jsx`, `ImmersionReader.jsx`, plus the shared
`JapaneseReader.jsx` / `OptionPicker.jsx` it renders.

- **[CHANGED] `ToggleButton` — added `activeTone="neutral"`.** Immersion's and
  Story's "Show/Hide furigana" buttons were the *identical* hand-rolled
  white-tinted toggle. Neither `accent` nor `success` fit: furigana is a
  reading aid, not the module's own thing (a deck) or something you've saved
  (a follow). Same justification the existing `success` tone has. Existing
  callers (`EpisodeList`'s Follow, the style-guide demo) untouched. Style
  guide's tone picker lists it.
- **[CHANGED] `OptionPicker` — `ACCENT` was a hardcoded core-teal constant.**
  Same class of bug as settled decision #8; surfaced because `WordPopup`'s
  deck list rendered its "+ Create «typed»" row teal inside a red module.
  Now `useAccent()`. Affects every `OptionPicker` host (`DeckComboBox`,
  `WordPopup`) — all of them *want* the ambient accent, none passed one.
- **[CHANGED] `TokenizedBody` (in `JapaneseReader.jsx`) — two fixes.**
  1. `vocabHighlight` default was Immersion's red hardcoded
     (`rgba(224,90,78,0.22)`); now defaults to `${moduleAccent}38`. Zero
     visual change for Immersion (its accent *is* that red); Story's light
     layouts already pass their own values and are unaffected.
  2. Hover was a `hoveredIdx` `useState` — the exact StrictMode-rule
     violation `FeedCard` fixed for `ArticleCard`. Now `.reader-token:hover`
     / `.reader-token--vocab:hover` in `global.css`, with the two colours
     passed as CSS custom properties on the wrapper so per-layout theming
     still works. The `useEffect` that cleared hover when the popup closed is
     gone (real `:hover` doesn't need it).
- **[INPUT] Original/Simplified → `ChipSelector mode="single"`.** Chip's
  `sm` padding is `4px 11px` vs the original `3px 12px`, active tint `22`
  vs `18`. Deliberately took Chip's canonical values rather than adding a
  size.
- **[INPUT] Sign-in prompt → `Button variant="neutral" size="sm"`.** Was an
  underlined text link ("Sign in to save reading history"). Chose to match
  the precedent Anime Vocab's `DoneScreen` set ("Sign in to add to SRS" is a
  neutral sm Button). If you'd rather keep a text-link affordance for
  "sign in" hints, that's a `Button variant` decision to make once for the
  whole app — Grammar Map, Vocab SRS and Story all have one too.
- **[INPUT] "Show answer" → `Button variant="neutral" size="sm"`.** Original
  was slightly quieter (muted text, `0.04` background, radius 4). Neutral is
  the closest variant; didn't add a quieter one.
- **[CANDIDATE] Disclosure / collapsible section.** The "▶ English summary"
  toggle stays bespoke. Same shape exists in Dictionary's kanji-carousel
  collapse, Vocab Drill's word-list accordion, and DataList's `expand`. A
  `Disclosure` atom (chevron + label + open state) would unify them; not
  needed to finish this port.
- **[CANDIDATE] Section divider.** The reader's three `borderTop hairline +
  paddingTop 24` section breaks are a repeated pattern (Story has the same).
  Left inline.
- Not migrated, on purpose: article title/date typography, the
  "Recent reading — N items" line, `WordPopup` internals (already on
  Popover + OptionPicker + Button from the first build).
