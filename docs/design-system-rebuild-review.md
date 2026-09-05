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

Branch stack (each cut from the previous tip, none merged — review and
merge in this order, each is a strict superset of the one before):

```
main
└─ feat/design-system            component library + style guide
   └─ design-system/anime-vocab   (13 commits)
      └─ design-system/dictionary (5)
         └─ design-system/immersion (2)
            └─ design-system/story (2)
               └─ design-system/vocab-drill (2)
                  └─ design-system/vocab-srs (2)   ← everything, incl. this file
```

Grammar Map was skipped per your note (module being removed).

## Summary — what changed in the shared library

| Kind | What | Why (one line) |
|---|---|---|
| NEW | `hooks/useIsMobile.js` | copy-pasted into 10 files |
| NEW | `theme.js`: `KANJI_FONT`, `SUCCESS`/`WARNING`/`DANGER` | declared in 5 files / only inside Badge+Button |
| NEW | `SectionLabel` (promoted from Dictionary) | second consumer (Vocab Drill preview) |
| NEW | `SignInGate` | identical block in SRS home + browse |
| NEW | `FileButton` | identical label-wrapping-input in SRS home + import panel |
| NEW | `HeaderMenuButton` (export) | the "Options" pill hand-rolled 4× |
| CHANGED | `ToggleButton` `activeTone="neutral"` | furigana toggles in Immersion + Story |
| CHANGED | `OptionPicker` accent ambient | hardcoded teal (decision #8 class) |
| CHANGED | `TokenizedBody` ambient highlight + CSS hover | hardcoded red; useState hover |
| CHANGED | `TextInput` accent focus ring; hover/focus rules fixed | rules had never applied |
| CHANGED | `Select` `size` + grouped options | Story's form; optgroup source picker |
| CHANGED | `Button` `warning-outline` | DoneScreen's amber Redo |
| CHANGED | `SectionHeader` `action` slot | title + control on the right, 2 call sites |
| CHANGED | `DataList` `bulkHeader: { selectFirst }`, editable `placeholder` | select-first-N header 2×; import hint |
| CHANGED | `Modal` `size="xl"` | import panel's 640px table |
| CHANGED | `HeaderMenu`, `SettingsSidebar` CSS hovers | useState-hover rule |
| CHANGED | `SpeedModeControls` composes `DrillButton` | had never been migrated |
| DELETED | `SelectButton`, `VocabModeToggle`, `DeckPickerSheet`, `SegmentedDeckAdd`, `DeckPickerLabPage` | superseded |

Open questions I'd most like your call on (details in each section):
1. **Vocab Drill is blue now** (modules.js accent) — keep, or change the hex?
2. **Sign-in prompts:** neutral Button (as ported) vs a text-link affordance.
3. **`SectionHeader` vs `SectionLabel`:** two heading components, or one with a `divider` flag?
4. **`Select` md text colour:** stays dim (0.65 white) next to a bright TextInput.
5. **FeedCard title font:** now `FONT` for Story's Japanese titles too.
6. **Browse-page select-all** now scopes to the loaded page (50), not all filtered.
7. **Vocab SRS signed-in screens weren't driven live** (OAuth gate) — please click through.

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

## Story (`design-system/story`)

Files: `StoryModule.jsx`, `StoryReviewPage.jsx`, `storyUI.jsx` (now just
`BG`/`SURFACE`), `storyFieldStyles.js` (now just `labelStyle`). The six
format layouts in `StoryLayouts.jsx` are untouched — they're content
presentation (newspaper, chat bubbles, postcard), not UI chrome.

- **[NEW] `KANJI_FONT` token in `theme.js`.** Declared identically in five
  files. Pure dedup, all call sites migrated.
- **[NEW] `SUCCESS` / `WARNING` / `DANGER` tokens in `theme.js`.** The
  semantic tones existed only as literals inside `Badge` and `Button`.
  Story was colouring "Correct" with the *core teal* and errors with
  *Immersion's red* — module colours standing in for semantics. Badge and
  Button now import the tokens (no visual change); Story's grading result
  and error lines use them.
- **[CHANGED] `Select` — `size` prop (`sm` default, `md`) and grouped
  options.** `sm` is the settings-drawer control it was extracted from;
  `md` matches TextInput's md padding so a select and an input sit level in
  a form. Story's generator form is the first place a select is a primary
  form field, not a drawer row. An option shaped `{ label, options: [...] }`
  renders as a native `<optgroup>` — the vocabulary-source picker groups
  sublists under their source and SRS decks under their own heading. Five
  existing callers untouched (default size, flat options).
  **[INPUT]** `Select`'s text stays `rgba(255,255,255,0.65)` at both sizes.
  In a drawer the value is secondary; in Story's form it's the main content
  and reads slightly dim next to a `TextInput` (which uses `TEXT`). Left as
  is rather than making colour depend on size — your call whether md should
  brighten.
- **[CHANGED] `TextInput` — focus ring is now the module accent**, passed as
  a `--focus-ring` CSS variable (same trick as `TokenizedBody`). In doing so
  found that neither the hover nor focus border rule had **ever** applied —
  the inline `border` outranked both (the documented gotcha). Both now
  `!important`; focus uses `:focus:not(:disabled)` so it matches hover's
  specificity and wins while the pointer is still over the field.
- **[INPUT] Story's local `Button` → shared `Button`.** The old primary was
  the accent with *dark* (`#1E1E1E`) text; the shared primary is accent with
  white text. Padding `10px 18px` → md `8px 16px`. "Generate" and "Check"
  are `primary`, "Preview context" / "New content" are `neutral`.
- **[INPUT] `RecentCard` → `FeedCard`.** Title font changes from
  `KANJI_FONT` to `FONT` (the open "Feed card title font" question in
  CLAUDE.md — both cards show Japanese titles, so this is the moment to
  decide it app-wide).
- **[INPUT] Story's `Field` (caption label above a control) kept as a local
  helper.** `Select` has a `subtext` slot that renders identically above the
  control, but it's named/documented as a field *description*, not a label.
  Using it for labels would be a naming lie; a proper `label` slot on
  `Select`/`TextInput` is the cleaner fix if forms recur (Vocab SRS's
  import panel is the next one).
- Dropped `StoryReviewPage`'s explicit `vocabHighlight="rgba(204,138,61,0.25)"`
  for the plain-text layout — the ambient default is now the same orange at
  0.22.
- Deleted `.story-btn`, `.story-field`, `.story-recent-card` CSS.
- **Pre-existing bug observed (not fixed, not UI):** the context preview
  shows "— undefined" for most words. `buildLearnerContext` reads
  `w.english`, but most Vocab Drill words now carry only `jmdictId` (the
  dictionary is the source of truth), so the LLM prompt literally contains
  "undefined" for them. Needs an async dictionary resolve in
  `learnerContext.js`; out of scope for this pass.

## Grammar Map — skipped

Per your note mid-run: the module is being removed, so it was not ported.
It still compiles and still uses `SectionHeader`/`useIsMobile`; nothing
else touched.

## Vocab Drill (`design-system/vocab-drill`)

Files: `VocabPage.jsx` (all four screens), plus the shared drill pieces it
owns (`SpeedModeControls`, `SettingsSidebar`, `HeaderMenu`).

- **[INPUT — most visible change in the whole pass] The page is now BLUE.**
  `modules.js` gives Vocab Drill (`school-vocab`) the accent `#3A7FEF`, but
  the page had core teal `#3ABDA4` hardcoded in 9 places (and shared that
  teal with Vocab SRS and the dashboard). Every other rebuild wired the
  `modules.js` accent, so this one does too — chips, "New" badges, Start
  review, the drill progress bar, JLPT badges and links are all blue now.
  If you'd rather it stayed teal, change the one hex in `modules.js` (or
  give it its own colour — that file is the source of truth now).
- **[CHANGED] `DataList` — `selection.bulkHeader` accepts
  `{ selectFirst: true }`.** Renders the caret → "Select first N words"
  panel (NumberField + Cancel/Confirm) inside the bulk header. DoneScreen
  and Anime Vocab's `EpisodeVocabBrowser` had hand-rolled the identical
  header; DoneScreen is migrated. **[CANDIDATE]** EpisodeVocabBrowser could
  follow, but its header only counts *eligible* rows (some words are
  filtered out of select-all), which `bulkHeader` doesn't model yet — left
  as is, with its local `SelectAllCheckbox`/`CaretButton` duplicates.
- **[CHANGED] `SectionHeader` — `action` slot.** Any node on the right of
  the title. DoneScreen's "Review words" + `DeckComboBox` uses it; Anime
  Vocab's `EpisodeDrill` has the same shape ("Words from this drill" + a
  Button) and could adopt it. The old `hasSelections`/`onClearAll` pair is
  unchanged for the settings drawers.
- **[NEW] `SectionLabel` promoted to `src/components/`.** Dictionary's
  label-plus-hairline group divider (from `pages/dictionaryShared.jsx`) got
  its second consumer in the Preview screen's per-sublist groups.
  **[INPUT]** There are now two section-heading components: `SectionHeader`
  (FS_BASE uppercase, action slot — drawers and done screens) and
  `SectionLabel` (FS_BADGE uppercase + divider — inside page content). Both
  have real, different call sites, but you may want one with a `divider`
  boolean instead. The "Recent stories" / "Comprehension check" headings in
  Story and Immersion are a *third* style (plain muted FS_HEADING), left
  alone.
- **[CHANGED] `Button` — `warning-outline` variant.** Same tint recipe as
  `danger-outline` in the amber tone, for DoneScreen's "Redo Troubled" —
  the one amber action in the app.
- **[CHANGED] `SpeedModeControls`** is now a named composition over
  `DrillButtonRow`/`DrillButton` with `DRILL_COLORS` (it had never actually
  been migrated despite `DrillButton`'s doc saying so). Same props, shared
  with Anime Vocab's `EpisodeDrill`.
- **[CHANGED] `HeaderMenu`, `SettingsSidebar`** — `useState` hovers
  (three of them) → CSS classes. Shared with Vocab SRS / Anime Vocab.
- **Deleted:** `SelectButton.jsx` (no importers anywhere — pre-Chip),
  `VocabModeToggle.jsx` (→ `ChipSelector mode="single" size="md" grow`),
  and the `.vocab-mode-btn` / `.vocab-glance-*` CSS.
- **[INPUT] Buttons.** Start review → `accent-outline lg` (the word-count
  suffix is a child span); Preview / Send to SRS → `neutral lg`; Restart /
  End review → `neutral lg`. Original padding was `10-11px 28px`; lg is
  `10px 24px`.
- **[INPUT] `SubListTile` kept bespoke** (hover moved to `.sublist-tile`,
  "New" → `Badge tone="accent" dimmed`). It's a two-line selectable tile in
  a grid — a Chip with a second line. If a "SelectableTile" ever gets built,
  this and the anime-vocab tile grid are its call sites.
- **[CANDIDATE] Progress bar.** The 3px drill progress bar under the header
  stays inline (now on the ambient accent). `DistributionBar` is explicitly
  not this; a `ProgressBar` atom would have this one call site.
- **[CANDIDATE] Stat pair** ("CORRECT 13 · TROUBLED 2") kept bespoke;
  `DrillHUD` renders the same numbers in a different layout.
- Note: CLAUDE.md's Vocab Drill section describes the word-list UI as a
  "collapsible accordion" of `SelectButton`s — that's stale, the real UI has
  been a `Select` + sublist tile grid for a while. Fixing in the final docs
  pass.

## Vocab SRS (`design-system/vocab-srs`)

Files: `VocabSrsModule.jsx`, `VocabSrsDrill.jsx`, `VocabSrsBrowsePage.jsx`,
`WordImportPanel.jsx`, new `cardStates.js`. Accent is unchanged (the
`modules.js` entry is the same teal the page had hardcoded).

**⚠ Verification caveat.** This module is sign-in gated and I can't drive
GitHub OAuth. I tried a temporary dev-only `useAuth` stub to exercise the
screens against localStorage and the permission classifier blocked editing
`AuthContext` — correctly, so I didn't work around it. The `SignInGate` is
verified live; the home, drill, browse and import screens are verified by
lint/build/tests and a line-by-line read of the diff only. **Please click
through them first when you review** — this is the one module where a
runtime surprise is possible.

- **[NEW] `SignInGate`** — full-page "sign in to use this" screen. The
  Module and Browse page rendered the identical block with a hand-styled
  accent button; now one component with the shared primary Button.
- **[NEW] `FileButton`** — a `Button` that opens a file picker (hidden
  input, `accept`/`capture` pass-through, value reset so re-picking the same
  file fires). Replaces the Module's `FileInput` and the import panel's
  `FileTrigger`, which were the same label-wrapping-an-input.
- **[NEW] `HeaderMenuButton`** (named export from `HeaderMenu.jsx`) — the
  "Options" text pill that VocabPage, VocabSrsModule and VocabSrsDrill each
  hand-rolled (with their own useState hover). All four call sites use it.
- **[NEW] `vocab-srs/cardStates.js`** — `STATE_SEGMENTS` / labels /
  descriptions, which the Module and Browse page each carried a copy of.
  Colours are `SEGMENT_COLORS` in theme.js (the Browse page had a third copy
  of the ramp).
- **[CHANGED] `Modal` — `size="xl"` (640).** Its own comment already noted
  WordImportPanel's review table was wider than `lg`.
- **[CHANGED] `DataList` — editable columns accept `placeholder`** (string
  or `row => string`) for the import table's "no dictionary match — enter
  meaning" hint.
- **Module home:** `DeckProgressBar` → `DistributionBar` + a danger `Badge`
  for the suspended count (a status, not a learning stage, so it stays out
  of the ramp); deck On/Off → `ToggleButton`; Start review →
  `accent-outline lg fullWidth`; daily-new / leech / advance-days →
  `NumberField` (the component existed; these three inputs had never used
  it); Apply / Reset → `neutral sm` / `danger-outline sm`; import buttons →
  `FileButton` / `Button neutral`; the whole desktop-rail + mobile-overlay
  sidebar → the shared `SettingsSidebar` (it was a verbatim copy).
- **Drill:** `RatingButton` → `DrillButton` + `DrillButtonRow` with
  `DRILL_COLORS` (fill opacity 0.75 → 0.85, the reconciled value the style
  guide already shows); `AudioButton` / Undo → `Button ghost-muted sm`;
  Done → `neutral lg`; amber literals → `WARNING`. `SrsCardFace` and
  `KanjiMeaningBar` stay bespoke (card-face content, container-query
  scaling).
- **Browse page:** `StateTabs` → `ChipSelector single md` with a stacked
  count/label node as each chip's label; state pills → `Badge` with the
  `SEGMENT_COLORS` accent override; Delete deck / Delete (N) →
  `danger-outline`; Select / Done selecting → `ToggleButton`; search →
  `TextInput`; the card list → `DataList` (selection + `bulkHeader` in
  manage mode, "Load more" in `footer`); **`DeckPickerSheet` → `DeckComboBox`**
  for "Move to deck".
  **[INPUT] Select-all scope changed.** The old header selected every
  *filtered* card across pages; `DataList`'s bulk header selects the loaded
  rows (50 per page) and counts "N of 50". To bulk-act on more, Load more
  first. If that's wrong, `bulkHeader` needs an "all rows" override.
- **Import panel:** hand-rolled scrim/panel → `Modal xl` (gains the mobile
  bottom-sheet it never had); tabs → `ChipSelector`; `PrimaryButton` →
  `accent-outline`; Back/Done → `neutral`; the review checklist →
  `DataList` with `editableFields` + selection + `bulkHeader` (replacing the
  Select all/none text buttons). **[INPUT]** Unselected rows used to dim to
  0.4 opacity; DataList's selectable rows don't dim, they show the checkbox
  and a selected background instead. **[CANDIDATE]** the paste `<textarea>`
  stays bespoke — no multiline `TextInput` in the library.
- **Retired and deleted:** `DeckPickerSheet.jsx`, `SegmentedDeckAdd.jsx`,
  `DeckPickerLabPage.jsx` (+ its `#/dev/deck-picker-lab` route) and every
  `.deck-picker-*` / `.deck-row-delete-btn` / `.deck-chip-btn` / `.srs-tab`
  / `.srs-browse-row` / `.done-btn*` CSS rule. `ToastLabPage`'s trigger
  button moved to `Button` since it was the last `.done-btn` user.
- **[CANDIDATE]** The relearn countdown, the per-deck due/new breakdown
  rows and the "N total cards" caption on the home screen stay bespoke.

## Review round 1 (`design-system/review-round-1`)

Your first-pass feedback, applied on top of the stack.

- **[NEW] `ActionBar`** (+ `ACTION_BAR_HEIGHT`) — extracted from Anime
  Vocab's fixed footer; now also Vocab Drill's home (Start review / Preview
  / Send to SRS) and Story's generator (Preview context / Generate, with the
  status line in the `leading` slot). **[INPUT]** It's `position: fixed`, so
  on Vocab Drill with the sidebar open the bar spans under the sidebar and
  its buttons centre on the viewport, not the content column — the same
  thing Anime Vocab already did. Making it column-scoped needs each host to
  wrap its scroll area in a positioned column; left for the redesign pass.
- **[NEW] `FilterCard` / `FilterRow`** — MediaSearch's inline filter block
  (label + control rows with hairlines), now shared with Story's generator.
  Story: Vocabulary and Format are `Select` rows; Length, Grammar and Card
  maturity are single-select chip rows. Mode + "based on" dropped from the
  UI (`mode: 'new'` still sent).
- **[NEW] `Disclosure`** — "▶ Label" reveal, used for the reader's English
  summary. Single consumer today; created because it's the atom the earlier
  CANDIDATE note described and a bespoke button was the alternative.
- **[NEW] `SidebarHeaderToggle`** (export from `SettingsSidebar`) — the
  mobile chevron in a rule-divided header section. Vocab Drill, Vocab SRS
  (home + drill), Anime Vocab all use it; Anime Vocab previously had *no*
  way to open its sidebar on mobile.
- **[CHANGED] `FeedCard` hover actually works now.** The `.feed-card:hover`
  rule had been outranked by the inline background (the same gotcha as
  TextInput). Only cards with an `onClick` get the `--interactive` class.
- **[CHANGED] `Checkbox`, `Select`, `SectionHeader`** set `FONT` explicitly
  instead of `inherit` — Dictionary's "Common words only" was the visible
  symptom.
- **Deleted:** `HeaderMenu` (+ `HeaderMenuButton`), `SpeakerIcon`,
  `storyFieldStyles.js`. Mute is gone from headers; audio stays in the
  settings sidebar's "Enable audio".
- **Dropped:** comprehension checks in the News reader and Story review
  (UI only — `questions` data and `story-grade` untouched).
- **Relabelled:** Original / Simplified → **Simple / Intermediate**
  (beginner-first). A third, easier tier means a pipeline change in
  `fetch-nhk.mjs` to generate it — not a UI change.
- **Rule recorded** as settled decision #13: cards represent content, lists
  represent data.
- **[INPUT] "Change the buttons to be medium"** — Story's buttons were
  already `md` (the default); I read this as "not lg", so Vocab Drill's
  home actions dropped from `lg` to `md` when they moved into the bar. If
  you meant something else, say which.

## Review round 2 (`design-system/review-round-2`)

Resolves round 1's open "medium buttons" question: **`xl`**, a new size one
step up from `lg`, used on every `ActionBar`. Branch stacked on
`design-system/review-round-1`.

### A. Shared library

- **[NEW] `Button` `size="xl"`** (`SPACE_12`/`SPACE_32`) — every `ActionBar`
  consumer moved up to it: Story's Generate, Vocab Drill's Send to SRS /
  Preview / Start review, Anime Vocab's Start Drill. Recorded as settled
  decision #17.
- **[NEW] `Select` `variant="inline"`** — no background/border, same height
  as a `sm` Chip, for a Select living inside a `FilterRow` next to chip
  rows (Story's Vocabulary/Format). The bordered `default` variant is
  unchanged. Settled decision #18.
- **[NEW] `NewspaperLayout` promoted** from `src/modules/story/StoryLayouts.jsx`
  to `src/components/`, so the News reader (a different module) can render
  real articles in it. Gained `subtitle`, a `body` plain-text fallback, and
  `masthead`/`edition`/`date` overrides — all defaulted to Story's original
  fixed values, so Story's own call site is unchanged (it re-exports the
  component so `StoryReviewPage`'s import path didn't need to change).
  `MINCHO` moved to `theme.js` as `MINCHO_FONT` (Story's other formats
  still use it).
- **[CHANGED] `DataList`'s search row** uses `TextInput variant="bare"`
  instead of a raw `<input>` — picks up the accent focus ring, needed once
  a real module (Anime Vocab) started feeding it a live lookup.

### B. Story generator

Vocabulary/Format → `Select variant="inline"`. Preview context button,
`showPreview` state, and the context `<pre>` card removed entirely (not
hidden). Generate → `size="xl"`.

### C. News reader

The article renders inside `NewspaperLayout` — `masthead` is the source
label (`SOURCE_LABEL`, extracted to a new tiny `sourceLabels.js` shared
with the list's badge), `edition` is "Simple edition"/"Intermediate
edition", `subtitle` is `title_en`. Chips/furigana toggle sit above the
paper; the summary `Disclosure` sits below it.

**Mark-as-read is now automatic** — opening an article marks it read via a
`useEffect` in `ImmersionModule`, gated on `user` (same gating the old
button had; `markRead` already de-dupes). The reader lost `isRead`/
`onMarkRead`, its "Mark as read" button, and the "✓ Marked as read" line;
the footer now renders *only* the signed-out sign-in prompt (nothing, and
no empty bordered section, when signed in).

### D. Vocab Drill

Scope reduced per your call mid-plan: only the `ActionBar`'s three buttons
move to `xl`. The FilterCard/chips/inline-select refactor of the *current*
home was skipped — `design-system/home-redesign` (separate branch/worktree,
already rebuilds this screen around textbook chapters) would have had the
work thrown away. That branch now has `FilterCard`, `ChipSelector`, and
`Select variant="inline"` available for its own chapter picker.

### E. Anime Vocab — episode view

`EpisodeVocabBrowser`'s filter `Card` → `FilterCard`: JLPT row left-aligned
under a plain label (dropped the old title + `space-between`); the four
filter checkboxes → one `ChipSelector mode="multi"` row, decomposed
straight from the returned Set into the four existing booleans (no diffing
needed — unlike MediaSearch's Difficulty row, these are independent
toggles with no "snap back to All" behavior).

The lookup input and the hand-rolled select-all/caret/"select first N"
header — which were literal duplicates of what `DataList`'s own
`BulkHeader` already does (added last round, never adopted here) —
collapsed into `DataList` itself via `search` and
`selection.bulkHeader: { selectFirst: true }`. Deleted: local
`SelectAllCheckbox`, `CaretButton`, `bulkOpen`/`bulkCountInput` state, and
their four handlers. The "No match" message is now `emptyMessage`
(including its dictionary-search link); `DataList` renders unconditionally
instead of being hidden when empty.

**[INPUT, verified live]** Select-all/select-first now scope to whatever
`DataList` is showing (`rows={displayedRows}`), not the `eligible`-only set
the old bespoke header used. With no search these are identical
(`displayed === eligible`); during an active lookup — which already
bypasses the JLPT/grammar/names/known filters — "select all" now also
covers those filter-bypassed rows. Confirmed intentional per the plan and
tested live (searched "あ", saw grammar-tagged rows in the results,
select-all counted them).

Start Drill → `size="xl"`.

### Verification

Story's inline selects and xl Generate, News reader's newspaper layout
with correct masthead/edition/subtitle and edition-label updates on
toggle, Vocab Drill's xl bar, and the full Anime Vocab episode view
(FilterCard layout, chip filter toggling the eligible count, search with
both a match and a no-match case, the select-first bulk header, xl Start
Drill) were all driven live in Chrome. Lint/build/tests (53/53) clean
after every section.
## Home redesign (`design-system/home-redesign`, stacked on review-round-2)

Rough first pass at the textbook-led home page — New / Review cards,
secondary module grid, stats sidebar. Full description in CLAUDE.md's
"Home page" section. Not yet built: the chapters page (Vocab Drill home
rebuilt around the chosen book) and the end-of-lesson "send to SRS" prompt.

- **[NEW] `src/data/textbooks.js`, `src/lib/textbookProgress.js`,
  `src/components/TextbookPicker.jsx`.** Config, pure resolver (unit
  tested), and the picker (Modal + OptionPicker — no new list component).
- **[CHANGED] `ModuleCard`** — `useState` hover → `.module-card` CSS class.
  Was the last dashboard useState-hover.
- **[CHANGED] `modules.js`** — `tier: 'primary'` on Vocab Drill + SRS;
  Grammar Map entry removed (route left in place).
- **[CHANGED] `VocabPage`** — honours `?chapter=<listKey>&start=1` at mount
  (seeds selection, autostarts, strips the query); drill results now save
  when signed out too (useProgress already falls back to localStorage — the
  `!user` gate was the only thing stopping it).
- **[CHANGED] `VocabSrsModule`** — honours `?start=1` once progress loads.
- **[INPUT] Stats sidebar contents** — proposed as Textbook / Reviews /
  Reading using only data that exists today. Streaks or a calendar need a
  per-day review log that doesn't exist yet; decide before designing them.
- **[INPUT] Textbook list** — seeded from the icons you provided (Quartet
  1/2, Marugoto A1 ×2, So-Matome N1/N2/N3) plus Genki 1/2 with no art. Only
  the So-Matome N3/N2 entries map to real word lists.
- **[CANDIDATE] Progress bar** — the 4px accent fill under the New card's
  title is the same inline bar Vocab Drill's header uses; a `ProgressBar`
  atom now has two call sites.
- **Not verified:** the mobile (single-column) layout — the browser tool's
  window resize didn't change the viewport. It uses the same `useIsMobile`
  switch as every other page.

### Home redesign — round 2 (visual pass)

- Header notice ("New accounts are currently disabled…") dropped.
- Primary cards: `actions` slot pinned to the bottom edge, quiet links
  stacked above it, so the two cards' main buttons align in every branch.
- Textbook cover 64 → 104px.
- Eyebrow labels (NEW / REVIEW) dropped; the title is the card's first line.
- Module accent bars added then removed again at your request — the
  secondary cards are waiting on per-module SVG icons instead.
- **[INPUT] Narrow-window fix.** Your window is ~900px, which put a 280px
  rail beside two cards in ~600px and squeezed them tall. Options
  considered: (a) rail moves below the cards as a 3-column strip,
  (b) collapsible rail behind a chevron like `SettingsSidebar`, (c) keep
  the rail and stack the two cards, (d) hide stats below some width. Took
  (a) — nothing is hidden, no new affordance to learn, and the cards get a
  near-square ratio back (≈480×440 at 820–1040px). (b) is the fallback if
  you want the stats visible beside the cards at every width.

### Home redesign — card state lab

`#/dev/home-cards` renders both primary cards in every state (8 New, 7
Review) plus three realistic pairs, with a column-width picker for the
real layout bands. `NewCard`/`ReviewCard` moved out of `DashboardPage`
into `src/pages/homeCards.jsx` so the lab exercises the real components
rather than a copy that would drift.

- **[INPUT] The lab's first finding: the bottom-alignment promise only
  half holds.** When the New card shows both Start-next and Continue, the
  two lg buttons wrap onto two rows at 400–480px, so its *last* row lines
  up with Review's primary but its own primary sits a row higher. Options:
  keep both as buttons and accept the offset; make Continue a quiet link
  in the links row (one lg button per card, guaranteed alignment); or make
  the pair a single split control. Left as is pending your call.

### Home redesign — round 3 (card content pass)

New card: cover is now the change-textbook affordance (hover reveals a link
over the artwork; tap works on touch), so the separate "Change textbook"
link left the row — **[INPUT]** if you'd rather keep a visible link as well,
it's one line back. Covers are pulled right by their own transparent gutter
(`COVER_GUTTER`) so the artwork, not the 32px canvas, aligns with the card
edge. Subtitle is just "N of 12 chapters" now; a finished book reads "Book
completed" with a **[Pick new textbook]** CTA and no badge. The empty state
drifts a cover marquee instead of the tagline. Quiet links shift left by
`GHOST_TEXT_INSET` (Button's own sm padding) so the first link's text lines
up with the primary button's box edge.

Review card: "Sign in with GitHub" → "Create account".

Genki 1/2 covers wired up.

**Equal heights confirmed, not incidental.** `PrimaryCard` now sets
`height: 100%` explicitly rather than leaning on the grid's default stretch;
measured live at 331×411 for both cards with very different content. The lab
grid deliberately opts out (`alignItems: flex-start`) — a stretched cell
there would include the caption in the card's 100%.

### Home redesign — round 4

- Empty-state carousel runs at true cover size (104px), each cover pulled
  left by one gutter so the artwork sits close rather than floating in its
  own transparent canvas.
- **[CHANGED] `modules.js` — Vocab SRS accent `#3ABDA4` → `#27AE60`.** Per
  settled decision #11 the accent is `modules.js`'s, so this repaints the
  whole SRS module (home, drill, browse), not just the home card. `#27AE60`
  is `DRILL_COLORS.good` without its alpha, so no new hue enters the palette
  — but it is now doing double duty as both "correct" and a module identity.
  **[INPUT]** if you want them distinct, pick a second green here.
- Cover hover fades the artwork to 0.2 rather than laying a scrim over it —
  a scrim could only ever cover the artwork's bounds, not the canvas.

### Textbook picker layout bench (`#/dev/textbook-picker`)

The shipped picker is name + meta only. `textbooks.js` gained `publisher`,
`description` and `purchase` (retailer **search** URLs — a product id rots
at the next edition; swap in real ones if you'd rather), and the lab shows
four ways to spend that content:

- **Rows** — today's list, enriched; a row expands in place for description,
  shops and a confirm button. Keeps search, scales past a dozen books.
- **Gallery** — cover grid with the selection's detail underneath. Leans on
  the pixel art being each book's most recognisable feature.
- **Split** — master list left, full detail right. The only one where
  description and shops need no extra click; wants ≥560px, so it needs a
  mobile fallback (Rows is the obvious one).
- **Spotlight** — one book at a time with a cover filmstrip. Most room per
  book, worst for finding a known title.

**[INPUT] My pick: Split on desktop, Rows on mobile** — buying a textbook is
a decision people make once, so showing the description without an extra
interaction is worth the width, and Rows already handles the narrow case.
Gallery is the strongest if the covers become the identity of the feature.

### Textbook picker — Split promoted, with a measured mobile arrangement

`TextbookPicker` is now the split browser rather than `Modal` +
`OptionPicker`; the bench keeps all four options and imports the real
`TextbookBrowser` for its Split tab so the two can't drift.

Mobile answers the "is there room?" question with numbers rather than a
guess, measured live in a 375×667 viewport (the smallest realistic phone):

| | 375×667 | 393×852 |
|---|---|---|
| Sheet (80vh) | 532 | 680 |
| Header | 59 | 59 |
| Pinned detail (cover 64, 3-line description, buy links, CTA) | 261 | 261 |
| List visible | 210 (≈4.8 rows) | 358 (≈8 rows) |

So yes — the whole detail plus about five of nine books fit on the smallest
phone, and the rest scroll under a detail that stays put.

- **Bug the measurement caught:** the first attempt scrolled the list itself
  (`height: 100%` on the browser, `flex: 1` on the list). The height never
  resolved — Modal's sheet is `max-height`-driven, so the body's height isn't
  definite and a percentage child falls back to auto — and the confirm button
  ended up below the fold. `position: sticky` on the detail needs no definite
  height and no magic numbers.
- **[CHANGED] `DashboardPage`** wraps the picker in `ModuleThemeProvider`
  with the Vocab accent: it opens from the New card, but rendered at the page
  root it was inheriting the dashboard's core teal, so its CTA was teal
  inside a blue card's flow.

### Textbook picker — row hover, mobile confirm in the footer

- **Row hover/active/focus** (`.tb-row` in `global.css`): background lift,
  text to full `TEXT`, and a left border at 50% of the module accent. Every
  rule needed `!important` — the rows set background, colour and border-left
  inline, and the pre-existing `.tb-row:hover` from the bench had therefore
  never fired. Verified live rather than assumed: hovering a row computes
  `rgba(255,255,255,0.05)` / `rgb(232,232,232)` / `rgba(58,127,239,0.5)`.
  The accent half travels as `--tb-accent-dim` set inline, since a class
  can't read a prop (decision #10's pattern).
- **Mobile confirm moved into `Modal`'s `footer` slot**, so it sits outside
  the body's scroll entirely instead of riding along with the sticky detail.
  That required lifting selection state from `TextbookBrowser` up into
  `TextbookPicker` — a footer rendered by the Modal can't read state held by
  the Modal's child. `TextbookBrowser` is now controlled
  (`selectedId`/`onSelectedChange`) with a `showConfirm` escape hatch, and
  the bench mirrors the same arrangement.

### Home redesign — `SectionLabel` merged into `SectionHeader` and deleted

Answers open question 3 above ("two heading components, or one with a
`divider` flag?"): **one component, no flag.** Your call, taken after
swapping the home page's four headings by hand and preferring the result.

- **What actually differed** between the two: a trailing hairline rule, and
  `FS_BADGE`/50%-muted versus `FS_BASE`/35%-white. That is one rule and 3px
  of type — not a component's worth of difference, and not worth a `divider`
  prop either, since the uppercase-and-dimmed treatment already reads as a
  group divider without the line.
- **`SectionHeader` gained `marginTop` (default 0)**, the one prop
  `SectionLabel` had that its callers genuinely used — Dictionary's entry
  page passes `marginTop={28}` to separate stacked groups. Existing
  `SectionHeader` callers (settings drawers, done screens) are unchanged at
  0; ex-`SectionLabel` callers that relied on its default 4 lose 4px, which
  is invisible in situ.
- **Call sites converted** (all `label=` → `title=`): `DashboardPage`
  (More tools + the three stats-rail groups), `DictionaryPage` (Kanji /
  Words), `DictionaryEntryPage` (Your Decks / Kanji / Example Sentences),
  `VocabPage` (preview groups), `HomeCardsLabPage`, `TextbookPickerLabPage`,
  and the style guide's own demo.
- **`src/components/SectionLabel.jsx` deleted**, along with its re-export
  from `pages/dictionaryShared.jsx` — the two Dictionary pages now import
  `SectionHeader` straight from `src/components/`, which is where a shared
  component should have been imported from anyway. The style guide's
  Section Label nav entry and demo are gone; the Section Header page now
  demonstrates both roles (with-action, and a second stacked group).
- **Visible change to accept:** every Dictionary and Vocab Drill group
  divider loses its hairline. Verified live on `#/dictionary` (Kanji /
  Words) and the style guide.
