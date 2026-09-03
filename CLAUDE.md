# Codebase guide

Japanese study dashboard. Vite + React, no TypeScript. Houses multiple learning modules behind a single landing page.

## Worktree dev server
When working in a git worktree (`.claude/worktrees/<name>/`), two things must be done before the dev server will work correctly:

1. **Symlink `.env`** — the worktree has no `.env` file. Without it, Supabase is unconfigured and all DB queries fail silently or throw. Fix:
   ```
   ln -s /Users/simoncallsen/Documents/GitHub/japanese-study/.env \
         /Users/simoncallsen/Documents/GitHub/japanese-study/.claude/worktrees/<name>/.env
   ```
2. **Run `npm run dev` from the worktree directory**, not from the repo root. Running from root serves committed files, not the worktree's edits.

Both issues have occurred in previous sessions and caused confusing bugs (search failures, edits appearing to have no effect).

## Conventions
- **Inline styles only** — no CSS modules, no Tailwind. CSS files only for things that can't be expressed inline (e.g. keyframe animations, scrollbar styles, `:hover` / `:focus` pseudo-selectors).
- **Never use `useState` for hover** — the app runs in React StrictMode which double-invokes renders; `onMouseEnter`/`onMouseLeave` + `useState` causes crashes in dev. Use a CSS class + a `:hover` rule in `global.css` instead.
- **No comments** unless the WHY is non-obvious (a hidden constraint, a workaround, a subtle invariant).
- **No TypeScript** — plain JS throughout.
- **No i18n** — all strings hardcoded in English.
- **No Japanese text in the UI** — labels, buttons, headings, and all other UI strings must be in English. Japanese text belongs only in word/card data (e.g. `kanji`, `kana`, `front` fields).
- Hash-based routing — `window.location.hash` read in `App.jsx`. No third-party router.

## App architecture

Two patterns for internal modules. Pick the right one before looking for code:

**Page-based** (`src/pages/`) — for simpler modules. The page component lives in `src/pages/`, pulls from shared components in `src/components/` and `src/hooks/`. Example: `VocabPage`.

**Self-contained module** (`src/modules/<name>/`) — for complex modules with their own logic, data, and UI. Everything lives under the module directory; the only cross-module imports are from `src/components/`, `src/hooks/`, `src/data/theme.js`, `src/FlipCard.jsx`, and `src/lib/supabase.js`. Example: `vocab-srs`.

**Quick lookup — where to look for a given task:**

| Task area | Files to look at |
|---|---|
| Dashboard layout / module cards | `src/pages/DashboardPage.jsx`, `src/data/modules.js`, `src/components/ModuleCard.jsx` |
| Vocabulary drill (`#/vocab`) | `src/pages/VocabPage.jsx` + its components listed below |
| Vocab SRS (`#/vocab-srs`) | `src/modules/vocab-srs/` only |
| Grammar Map (`#/grammar-map`) | `src/modules/grammar-map/` only |
| Auth / sign-in flow | `src/context/AuthContext.jsx`, `src/components/AuthSlot.jsx` |
| Progress sync (Supabase / localStorage) | `src/hooks/useProgress.js` |
| Shared UI components | `src/components/` |
| Design tokens | `src/data/theme.js` |

**Database:** Three Supabase tables: `progress` (user learning state, schema in Auth section), `dictionary` (JMdict central dictionary, schema in Immersion section), and `kanji` (KANJIDIC2 kanji data, schema in Dictionary section). All word/card content lives in static JSON files in the repo — never in the database.

## Routing

`App.jsx` reads `window.location.hash` and renders the matching page component. Current routes:

| Hash | Component | File |
|---|---|---|
| `#/` (or empty) | `DashboardPage` | `src/pages/DashboardPage.jsx` |
| `#/vocab` | `VocabPage` | `src/pages/VocabPage.jsx` |
| `#/vocab-srs` | `VocabSrsModule` | `src/modules/vocab-srs/VocabSrsModule.jsx` |
| `#/immersion` | `ImmersionModule` | `src/modules/immersion/ImmersionModule.jsx` |
| `#/grammar-map` | `GrammarMapModule` | `src/modules/grammar-map/GrammarMapModule.jsx` |
| `#/dictionary` | `DictionaryPage` | `src/pages/DictionaryPage.jsx` |
| `#/dictionary/entry/:id` | `DictionaryEntryPage` | `src/pages/DictionaryEntryPage.jsx` |
| `#/story` | `StoryModule` | `src/modules/story/StoryModule.jsx` |
| `#/story/:id` | `StoryReviewPage` | `src/modules/story/StoryReviewPage.jsx` |

To add a route: add a branch in `App.jsx`. Page-based → create `src/pages/YourPage.jsx`. Self-contained → create `src/modules/<name>/` and import the root component in `App.jsx`.

## Module config shape

Each entry in `src/data/modules.js`:

```js
{
  id: string,           // unique stable key
  label: string,        // display name shown on card
  sublabel: string,     // subtitle shown below label
  stats: null,          // reserved, currently unused
  href: string,         // hash path ('#/vocab') or full URL for external modules
  external: boolean,    // true → opens in new tab; false → hash navigation
  accent: string,       // CSS color string (currently unused in card design)
  requiresAuth: boolean,// true → dashboard card shows auth-gated state
  icon: string,          // optional — path to an icon image, used instead of accent (see 'katsuyou' entry)
}
```

## Adding a module
1. Add an entry to `src/data/modules.js`.
2. **Page-based:** add a branch in `App.jsx` and create `src/pages/YourPage.jsx`.
3. **Self-contained:** create `src/modules/<name>/`, add a branch in `App.jsx` importing your root component from `src/modules/<name>/`.

## Design tokens (`src/data/theme.js`)

| Token | Value | Usage |
|---|---|---|
| `FONT` | `'DotGothic16', system-ui, sans-serif` | All text |
| `TRACKING` | `0.05em` | Letter spacing |
| `BG` | `#1E1E1E` | Page background (also set in index.html) |
| `SURFACE` | `#2A2A2A` | Card background |
| `SURFACE_HOVER` | `#313131` | Card hover state |
| `BORDER` | `#2E2E2E` | Header bottom separator |
| `TEXT` | `#E8E8E8` | Primary text |
| `TEXT_MUTED` | `#888888` | Secondary / label text |

## Style Guide (`#/dev/style-guide`)

Living component library + progress tracker for the app-wide design-system consolidation. Dev-only lab page, same pattern as `ToastLabPage` — not linked from the dashboard. **Status (Sep 2026): every module is ported** — Anime Vocab, Dictionary, Immersion, Story, Vocab Drill, Vocab SRS, each on its own `design-system/<module>` branch stacked on `feat/design-system` (Grammar Map skipped: being removed). The branch-by-branch decision log, every shared-component change and every judgement call that wants a second opinion, is in `docs/design-system-rebuild-review.md` — read it before relitigating anything below. Left nav lists every planned component (built + placeholder); clicking a placeholder shows its description and "Not built yet" rather than being hidden, so the roster below doubles as the page's own content.

**Key files:** `src/pages/StyleGuideLabPage.jsx` (the whole page — nav, `ComponentPage`/`FoundationPage` wrappers, per-component demo + controls). Design-system components live in `src/components/`: `Button.jsx`, `Badge.jsx`, `Card.jsx`, `TextInput.jsx`, `NumberField.jsx`, `Select.jsx`, `Checkbox.jsx`, `FileButton.jsx`, `SectionHeader.jsx`, `SectionLabel.jsx`, `SignInGate.jsx`, `ActionBar.jsx`, `FilterCard.jsx` (+ `FilterRow`), `Disclosure.jsx`, `Chip.jsx`, `DataList.jsx`, `Modal.jsx`, `ConfirmDialog.jsx`, `Toast.jsx`, `FeedCard.jsx`, `ToggleButton.jsx`, `DistributionBar.jsx`, `Popover.jsx`, `OptionPicker.jsx`, `DeckComboBox.jsx`, `DrillButton.jsx`, `SpeedModeControls.jsx` (a named composition of DrillButton), `DrillHUD.jsx`, `SettingsSidebar.jsx` (+ its `SidebarHeaderToggle` export), `NewspaperLayout.jsx` (promoted from Story, shared with Immersion). Module accent context: `src/context/ModuleThemeContext.jsx`. Shared hook: `src/hooks/useIsMobile.js`. Semantic colour tokens `SUCCESS`/`WARNING`/`DANGER` and `KANJI_FONT` live in `theme.js`.

**Conventions established while building this — follow for every remaining component:**
- **Ground every value in real code, never invent.** Before designing a component, read the actual call sites it's meant to unify and extract real pixel values/colors/behavior rather than guessing something "reasonable." Where real call sites disagree, reconcile deliberately and say so in a comment (e.g. `Button`'s `danger-outline` fixed `ConfirmDialog`'s mismatched background/text hue instead of copying the bug forward).
- **Token discipline:** `FS_BASE` (15px) and `SPACE_12` are the defaults — use them unless a specific, stated reason calls for something else. `theme.js`'s `SPACE_4/8/12/16/24/32` and the `FS_*` constants are the sanctioned scale; a literal is fine when it's a faithful port of a real historical value (comment why) or must stay byte-identical to another component's own default (e.g. `DataList`'s row padding matching `SelectableRow`'s). Simplify token scales rather than cataloguing every pixel value already in use — colors should be grounded in exact real values since they carry identity, but a spacing/type scale exists to *constrain* choice.
- **Component API shape:** prop names describe what they configure, not a generic `mode` enum — see `DataList`'s independently-combinable `selection`/`navigate`/`expand` instead of one flat mode string. Variant-style components (`Button`, `Badge`) use a `variant`/`tone` string prop against a lookup object.
- **Hover states are CSS classes in `global.css`, never `useState`** — the StrictMode double-invoke rule above applies to every new component too. Reuse the existing `filter: brightness()` idiom for colored/tinted elements (`.btn-tint`); explicit background-shift for near-transparent ones (`.btn-neutral`, `.btn-ghost`, `.data-list-row`).
- **Page pattern:** `ComponentPage` (heading + description + preview-left/controls-right split, controls built from the real `Select`/`Checkbox` — dogfooding on purpose) for interactive components; `FoundationPage` (full-width reference list, no controls) for token references like Type/Spacing/Color.

**Deliberate non-components** — these were on the roster and were *removed* after examination, not skipped. Don't re-add them:
- **Info Row** — a read-only list row is `DataList` with no `selection`/`navigate`/`expand`. A separate component would be the same thing with fewer options.
- **Verdict Buttons / Rating Button** — one component (`DrillButton`), not two. They already shared the `.verdict-btn` class, row width, radius, and fill treatment; they differed only in padding, fill opacity, and whether a second line rendered (`sublabel`).
- **Icon Button** — an icon-only button is `Button` with an `icon` and no children, not a separate component. `Button`'s `icon` prop also covers icon **+** label, which a dedicated IconButton couldn't express. Use `variant="ghost-muted"` for dismiss/remove affordances (muted until hovered, then reddens).

**Gotcha — inline styles outrank hover classes.** A component that sets `background` inline (`transparent`, a tint) needs `!important` on the matching `:hover` rule in `global.css` or the hover silently does nothing. This has now bitten `.btn-neutral`, `.chip--off`, and `.track-toggle`. Check hover actually fires when adding a component that styles `background` inline.

**Component roster** (`NAV` in `StyleGuideLabPage.jsx` — flip `built: false` → `true` and register in `PAGES` once built):

| Component | Status | Real call sites it replaces |
|---|---|---|
| Type, Spacing, Color | Built (Foundations) | `theme.js` |
| Button, Badge, Card, Text Input, Number Field | Built (Atoms) | `ConfirmDialog`, `WordImportPanel`, `VocabSrsModule`, `DeckComboBox`, `TrackedAnimeSection`, `Toast`, `MediaSearch`, `DeckPickerSheet` |
| Chip Selector | Built, migrated everywhere | `MediaSearch`'s `Chip` + `ViewModeButton`, `EpisodeVocabBrowser`'s JLPT filter + its four filter checkboxes (now one `mode="multi"` row), Immersion's Simple/Intermediate toggle, `VocabModeToggle` (deleted), `WordImportPanel`'s `TabButton`, `VocabSrsBrowsePage`'s `StateTabs`, Story's Length/Grammar/Card maturity (all migrated). Story's Vocabulary/Format use `Select variant="inline"` instead — they're a single value from a long list, not a small visible set |
| Data List | Built, migrated everywhere | `EpisodeVocabBrowser`, `EpisodeList`, `TrackedAnimeSection`, `EpisodeDrill`'s `DoneScreen`, `MediaSearch`'s list results, `DictionaryPage`'s `EntryRow`, `DictionaryEntryPage`'s `DeckRow`, `VocabPage`'s `DoneScreen` + Preview groups, `VocabSrsBrowsePage`'s card list, `WordImportPanel`'s review table (all migrated). Gained `navigate.href`, `rowState`, `selection.bulkHeader: { selectFirst }`, and per-column `placeholder` for editable cells along the way |
| Modal | Built — `ConfirmDialog` now composes it | `WordImportPanel`, `DeckComboBox` (mobile), `DeckPickerSheet`, `SegmentedDeckAdd`'s `CreateDeckModal` |
| Toast | Built (pre-existing component, now in the guide) | — |
| Feed Card | Built, migrated everywhere — gained an `image?: {src?, aspectRatio?}` cover slot + `disabled` boolean | `MediaSearch`'s `ResultTile`, `ImmersionModule`'s `ArticleCard`, `StoryModule`'s `RecentCard` (all migrated) |
| Toggle Button | Built, migrated everywhere — composes Chip; tones `accent` / `success` / `neutral` | `EpisodeList`'s `TrackToggle`, `VocabSrsModule`'s deck On/Off, Immersion's and Story's Show/Hide furigana (`neutral`), `VocabSrsBrowsePage`'s Select/Done selecting (all migrated) |
| Distribution Bar | Built, migrated | `VocabSrsModule`'s `DeckProgressBar` (now a thin wrapper adding the suspended Badge) |
| Drill Button | Built, migrated | `SpeedModeControls` (now composes it), `VocabSrsDrill`'s `RatingButton` (deleted) |
| Drill HUD | Built (pre-existing component, now in the guide) | — |
| Popover, Option Picker | Built | The duplicated anchored-popover math in `DeckComboBox` + `WordPopup`; the search/list/create surface in `DeckComboBox` |
| Deck Picker | Built — `DeckComboBox`, now a thin wrapper over Popover + OptionPicker | `DeckPickerSheet.jsx`, `SegmentedDeckAdd.jsx`, `DeckPickerLabPage.jsx` (all deleted; `VocabSrsBrowsePage`'s "Move to deck" was the last caller) |
| Select | Built — `size` sm/md, `variant` default/inline, grouped options → `<optgroup>` | `VocabPage`'s word-list picker, every settings drawer (`size`); Story's generator form's Vocabulary/Format rows (`variant="inline"`, living inside a `FilterCard` next to chip rows) |
| File Button | Built | `VocabSrsModule`'s `FileInput`, `WordImportPanel`'s `FileTrigger` |
| Section Header / Section Label | Built — Header has an `action` slot (done screens); Label is the label+hairline group divider (Dictionary, Vocab Drill preview) | see the review log's open question on whether they should merge |
| Sign-in Gate | Built | `VocabSrsModule`, `VocabSrsBrowsePage` |
| Definition Popover | Built — `WordPopup`, now Popover + an in-place view switch | — |

**Settled design decisions — don't relitigate:**
1. **Drill palette stays separate from the semantic tokens.** `DRILL_COLORS` in `theme.js` is a Flat-UI lineage (`#C0392B`/`#27AE60`/`#2980B9`/`#B47828`) distinct from the Tailwind-derived semantic tokens (`#f87171`/`#4ade80`/`#fbbf24`). Not interchangeable: drill colours are solid fills behind white text, semantic tokens are light tints for dark text, and "easy" blue has no semantic equivalent. Both stay.
2. **Module accents come from context, not props.** `ModuleThemeProvider` / `useAccent(override)` in `src/context/ModuleThemeContext.jsx`. A module root wraps its screens with its own accent and `Chip`/`ToggleButton` (and any future accent-aware component) read it ambiently — passing it per-call-site failed silently when forgotten. The `accent` prop survives as an explicit per-instance override. Outside any provider the core teal applies, which is correct for the dashboard.
3. **Components are named for their role, not their location.** `DrawerSelect`/`DrawerCheckbox`/`DrawerSectionHeader` → `Select`/`Checkbox`/`SectionHeader`. Don't reintroduce location-prefixed names.
4. **`DeckComboBox` is the one deck picker.** Type-to-filter with an inline "+ Create «typed»" row; popover on desktop, bottom sheet on mobile. `DeckPickerSheet.jsx`, `SegmentedDeckAdd.jsx` and `DeckPickerLabPage.jsx` are **deleted** (Vocab SRS rebuild).
5. **Atoms forward refs.** `Button` and `TextInput` use `forwardRef` so callers can measure and focus them (`DeckComboBox` positions its popover against the button and focuses the search field). Any new atom wrapping a DOM element should do the same.
6. **Floating surface and its contents are separate components.** `Popover` owns anchoring (fixed positioning, flip-above, horizontal clamp, click-outside, close-on-scroll) and the desktop-popover / mobile-sheet switch, delegating the sheet to `Modal` rather than being a third sheet implementation. `OptionPicker` owns the search + list + optional inline "+ Create «typed»" behaviour and knows nothing about positioning or decks. This split is what lets `WordPopup` swap its own content from definition to deck list **in place** — previously it rendered a `DeckComboBox`, stacking a second floating layer inside the first with competing click-outside handlers. Anything that picks from a searchable list should compose `OptionPicker`, not reimplement it.
7. **A stateful toggle is `ToggleButton`, not a `Button` variant.** The deciding test is what *hover* means: `Button`'s hover is derived from its variant and always reinforces the resting state, whereas a toggle's label, colour, and (with `destructiveHover`) the meaning of hovering all change with state. Folding that into `Button` would put four toggle-only props on a component ~50 non-toggle call sites use. `ToggleButton` composes `Chip` rather than restyling a button, so both share one visual language — a chip picks one option out of a set and keeps a fixed label; a toggle is a standalone binary that renames itself.
8. **Every color-bearing shared component must actually check its own accent-awareness before a module rebuild, not assume it from Chip/ToggleButton being correct.** Anime Vocab (the first real module rebuild, `feat/design-system` → `design-system/anime-vocab`) found the *same* hardcoded-core-teal bug independently in `Button` (`primary`/`accent-outline`/`ghost` variants), `SelectAllCheckbox`, `DataList`'s `RowCheckbox`, and `SelectableRow` — none caught by the original build pass because nothing exercised `ModuleThemeProvider` with a non-teal accent until this rebuild. All are now accent-aware via `useAccent()`, verified zero-risk since no pre-existing call site sat inside a provider. `Badge` also gained an `accent` override prop (mirroring `Chip`'s) and a generic `dimmed` boolean (for approximate/inferred values, not JLPT-specific) during this pass. **Lesson for every future module rebuild:** grep for hardcoded core-teal/hex accent literals across `src/components/` *before* wiring `ModuleThemeProvider` at a new module root, don't wait to discover them one broken button at a time.
9. **`DataList`'s `navigate` supports `href(row)` alongside `onClick(row)`.** Dictionary's rebuild (`feat/design-system` → `design-system/dictionary`) found that `EntryRow` and `DeckRow` were both real `<a href>` cross-route links — converting them to `navigate`'s onClick-only `<div>` would have silently dropped cmd/ctrl/middle-click, "open in new tab", and hover-preview. `navigate.href(row)` renders the row as a real `<a>` instead (onClick still fires alongside it if also given); `RowCheckbox` now also calls `preventDefault` (not just `stopPropagation`) since an ancestor `<a>`'s native navigation is gated on the click event's canceled flag, which only `preventDefault` sets — `stopPropagation` alone doesn't stop it. Existing onClick-only callers (`EpisodeList`, `TrackedAnimeSection` — same-app hash navigation via a side effect, not a real link) are unaffected. **Use `href` whenever the row is a genuine link to another route; keep `onClick` for a same-app navigation side effect that isn't itself a link.**

10. **Hover/focus rules that fight an inline style need `!important` — and it's worth checking they ever applied.** `TextInput`'s hover *and* focus border rules had never fired (inline `border` outranked both) until the Story port noticed. When a class rule targets a property a component also sets inline, `!important` it, and if two pseudo-classes can apply at once (`:hover` + `:focus`) give the winner matching specificity (`:focus:not(:disabled)`). Per-instance colours a class needs (a module accent, a layout's tint) travel as CSS custom properties set inline — `TokenizedBody`'s `--reader-vocab`, `TextInput`'s `--focus-ring`.
11. **A module's accent is `modules.js`'s, even when the page disagreed.** Vocab Drill had core teal hardcoded in nine places while `modules.js` said blue; the port wired blue. If a module should look different, change the one hex in `modules.js` — that file is the source of truth, not the page.
12. **Grammar Map is not ported** — it's being removed. Don't spend time on it.
13. **Cards are for content, lists are for data.** A `FeedCard` represents an actual thing to read (an article, a story); a `DataList` row is a record among records (a word, a card, a deck). Don't render word lists as cards or articles as list rows.
14. **A screen's primary actions live in `ActionBar`**, the sticky bottom bar — Anime Vocab's Start Drill, Vocab Drill's Start review / Preview, Story's Generate. Consumers pad their scroll container by `ACTION_BAR_HEIGHT`. It's `position: fixed`, so with a settings sidebar open it spans under the sidebar column too (the pre-existing Anime Vocab behaviour) — a known imperfection, not a bug to fix per screen.
15. **Module headers are the plain `PageHeader` + `AuthSlot`.** No per-module header buttons (the old `HeaderMenu` with Mute/Options is gone — audio lives in the settings sidebar). On mobile, screens with a `SettingsSidebar` add `SidebarHeaderToggle` after `AuthSlot`: a chevron in a rule-divided section, the header's counterpart of the desktop rail.
16. **Comprehension checks are gone** from both the News reader and Story review (the data and the `story-grade` function remain; only the UI was dropped). The reader's "English summary" is a `Disclosure`.
17. **A screen's `ActionBar` buttons are `size="xl"`**, one step up from the `lg` a bare primary CTA elsewhere in the app uses — the sticky bar is meant to read as *the* action for the whole screen, not one button among several. Every `ActionBar` consumer (Story's Generate, Vocab Drill's Start review, Anime Vocab's Start Drill) was moved up when `xl` was added; a future `ActionBar` consumer should default to it too.
18. **`Select`'s `inline` variant is for a Select living inside a `FilterCard`/`FilterRow`** next to chip rows — no background/border, same height as a `sm` Chip, so it doesn't read as a different kind of control from its neighbours. The bordered `default` variant stays for settings drawers and any Select that's the only control in its row. `EpisodeVocabBrowser`'s filter block and its lookup/bulk-select header are the template for absorbing a module's remaining hand-rolled filter UI into `FilterCard` + `DataList`'s `search`/`bulkHeader` — look here first before hand-rolling either again.

**Still open:**
- **Six greens.** `#4ade80` (success), `#6BCB6B` (read/tracked), `#7fe0c8` (mature), `#27AE60` (drill correct), `#5eb6a2` (young), `#4c8a7d` (learning). The last three are the validated CVD ramp and are legitimate; `#6BCB6B` vs `#4ade80` looks like plain drift and probably wants merging.
- **Feed card title font.** `ArticleCard` used `FONT` (DotGothic16), `RecentCard` used `KANJI_FONT` (Hiragino), both for Japanese titles. `FeedCard` currently standardises on `FONT`.

## Shared components (`src/components/`)

Used by multiple modules/pages:

| Component | Usage |
|---|---|
| `PageHeader.jsx` | Breadcrumb header — all pages |
| `AuthSlot.jsx` | Sign in / sign out control — dashboard header and module headers |
| `SectionHeader.jsx` / `Checkbox.jsx` / `Select.jsx` | Settings-drawer primitives (formerly `Drawer*`) — see the Style Guide section |
| `SettingsSidebar.jsx` | The desktop chevron-rail / mobile-overlay settings panel — Vocab Drill, Anime Vocab, Vocab SRS. Exports `SidebarHeaderToggle`, the mobile header chevron that opens it |
| `ActionBar.jsx` | Sticky bottom bar for a screen's primary actions (see settled decision #14) |
| `FilterCard.jsx` | Card of labelled control rows — Anime Vocab's search filters, Story's generator form |
| `ModuleCard.jsx` | Dashboard module card |
| `AttributionFooter.jsx` | Third-party data credit line at the foot of a page — `<AttributionFooter sources={['dictionary', 'tanaka-corpus']} />`. See Attribution system section below |

### PageHeader

Used by every page and module. Always renders a 64 px tall header row.

```js
<PageHeader
  crumbs={[
    { label: 'Japanese Study', href: '#/' },    // href → <a> link
    { label: 'SRS', onClick: () => ... },        // onClick → clickable span (for non-hash nav)
    { label: 'Review' },                          // no href/onClick → current page (dimmer style)
  ]}
  rightSlot={<AuthSlot />}   // optional — floated right
/>
```

A crumb with `href` navigates via hash change. Use `onClick` when you need to exit a drill that's already at the right hash (e.g. SRS Review → SRS home). A crumb with neither is rendered as the current page label.

### FlipCard

`src/FlipCard.jsx` + `src/FlipCard.css` — low-level 3D flip animation. Shared between `VocabCard` (vocab drill) and `VocabSrsDrill` (SRS). Click, Space, or Enter flips; `isFlipped` prop controls state from parent.

## Key files — Dashboard

| File | Purpose |
|---|---|
| `src/data/modules.js` | Module config array — single source of truth for dashboard cards |
| `src/data/theme.js` | Design tokens |
| `src/components/ModuleCard.jsx` | Renders one module card |
| `src/pages/DashboardPage.jsx` | Dashboard layout — header, module grid |
| `src/App.jsx` | Hash router |

## Vocabulary Drill (`#/vocab`)

Mirrors katsuyou-drill's UI exactly. Speed-mode only (no text input). Card front: kanji. Card back: kanji + furigana (via `<ruby>/<rt>`, in-flow for correct vertical centering) + English meaning + optional example sentence.

### Key files — Vocab drill

| File | Purpose |
|---|---|
| `src/pages/VocabPage.jsx` | Main drill page — layout, settings drawer, state |
| `src/components/VocabCard.jsx` | Flip card — front (kanji) / back (kanji + furigana + English + optional sentence); wraps `FlipCard` |
| `src/FlipCard.jsx` + `src/FlipCard.css` | 3D flip animation (ported from katsuyou-drill) |
| `src/components/DrillHUD.jsx` | Streak display + undo + score (VocabPage-only) |
| `src/components/SpeedModeControls.jsx` | Incorrect [Z] / Correct [X] pair — a named composition of `DrillButtonRow`/`DrillButton`, shared with Anime Vocab's `EpisodeDrill` |
| `src/components/PageHeader.jsx` | Breadcrumb header |
| `src/components/SectionHeader.jsx`, `Checkbox.jsx`, `Select.jsx` | Settings-panel primitives |
| `src/hooks/useDrill.js` | Drill state machine hook (VocabPage-only) |
| `src/hooks/useTTS.js` | Browser Speech Synthesis TTS — fallback when Voicevox audio isn't available |
| `src/hooks/useAudioGenerationStatus.js` | Polls the `audio_generation_status` row — drives the "Audio is being generated" note |
| `src/hooks/useSFX.js` | Web Audio API sound effects (no asset files) |
| `src/hooks/useGamepad.js` | Gamepad controller support (VocabPage-only) |
| `src/hooks/useKanjiMeanings.js` | `useKanjiMeanings(text, enabled)` → `{ [kanjiChar]: firstGloss }` — resolves per-kanji meanings for the "Show kanji meanings" bar; shared with Vocab SRS |
| `src/utils/kanjiMeaningLookup.js` | `kanjiCharsOf(str)` (extracts Han-script chars) + `fetchKanjiMeanings(chars)` (queries the `kanji` table, module-level cache) — backs `useKanjiMeanings` |
| `src/hooks/useDictionaryEntries.js` | `useDictionaryEntries(ids, enabled)` / `useDictionaryEntry(id, enabled)` — resolves `dictionary` rows by `jmdictId`; shared with Vocab SRS. See Dictionary linkage section above |
| `src/utils/dictionaryEntryLookup.js` | `fetchDictionaryEntries(ids)` (batched, module-cached) + `briefGloss(row)` — backs `useDictionaryEntries` |
| `src/lib/dictionaryLookup.js` | `lookupDictionaryEntries(client, bases)` + `pickBestDictionaryMatch(rows)` — shared two-stage `dictionary` lookup used by scripts and `lookupVocabulary.js` |
| `src/hooks/useSentenceForWord.js` | `useSentenceForWord(id, enabled)` / `useSentencesForWords(ids, enabled)` — resolves the best Tanaka Corpus sentence per `jmdictId`; shared with Vocab SRS |
| `src/utils/sentenceLookup.js` | `fetchSentencesFor(ids)` (batched, module-cached) — backs `useSentenceForWord` |
| `src/utils/voicevoxAudio.js` | Voicevox voice list, audio-source picker options, Storage URL helper — shared with Vocab SRS |
| `src/engines/simpleQueue.js` | Card queue engine — wrong cards reinsert after 3 |
| `src/utils/furigana.js` | `buildFurigana(kanji, kana)` → decomposed furigana parts |
| `src/utils/storage.js` | Safe localStorage get/set wrappers |
| `src/data/wordLists.js` | Word source/list metadata: `WORD_SOURCES` array |
| `src/data/words/sample.json` | Placeholder word data |
| `scripts/generate-audio.mjs` | Generates Voicevox audio for word lists + `keigo.json`, uploads to Storage, prunes orphaned files (see Vocab audio section below) |
| `.github/workflows/generate-vocab-audio.yml` | Runs the above automatically on every push touching word-list/keigo JSON, or via manual dispatch |
| `src/global.css` | sidebar-scroll scrollbar styles; letter-spacing reset for form elements |

### Word source / list structure (`src/data/wordLists.js`)

`WORD_SOURCES` is an array of sources. Each source is either **flat** (no sublists) or **hierarchical** (has sublists):

```js
// Flat source — the source id is the listKey used in word data
{ id: 'sample', label: 'Sample Words', lists: null }

// Hierarchical source — each sublist id is a listKey used in word data
{
  id: 'nsm-n3',
  label: 'Nihongo So-Matome N3',
  lists: [
    { id: 'nsm-n3-w1d1', label: 'Week 1, Day 1' },
    { id: 'nsm-n3-w1d2', label: 'Week 1, Day 2' },
    // ...
  ],
}
```

**UI behavior:** the home screen is a `Select` of sources, then a grid of `SubListTile`s (label, word count, "New" badge or last-reviewed) for the chosen source's sublists — click tiles to toggle them into the drill. (An older accordion-of-`SelectButton`s UI this paragraph used to describe is gone.)

### Word data format

Each word object in a `src/data/words/*.json` file:

```js
{
  "id": "nsm-n3-w1d1-001",  // unique stable key — suggest "{listKey}-{index}"
  "kanji": "魚",              // display form (front of card); use kana if no kanji form
  "kana": "さかな",           // full hiragana/katakana reading — spoken by TTS on flip
  "english": "fish",          // meaning — shown on back of card (concise, 1–5 words)
  "sentence": "...",          // optional example sentence — shown on back when "Show sentence" is on
  "listKey": "nsm-n3-w1d1",  // must match a source id (flat) or sublist id (hierarchical)
  "voicevoxVoices": [2, 11], // set by scripts/generate-audio.mjs — speaker ids with generated audio; absent/empty until generated
  "jmdictId": "1426920"      // set by scripts/backfill-vocab-jmdict.mjs — links to the `dictionary` table row for this word; absent if unmatched (see Dictionary linkage section)
}
```

### Per-kanji meanings

`vocab-show-kanji-meaning` (default `false`) toggles a `KanjiMeaningBar` row on the card back showing each kanji character in the word alongside its first `kanji` table gloss (via `useKanjiMeanings`/`kanjiMeaningLookup.js`, see Key files above). `KanjiMeaningBar` is defined locally in both `VocabCard.jsx` and `VocabSrsDrill.jsx` (not extracted to a shared component). The SRS module has the equivalent `srs-show-kanji-meaning` setting (see SRS settings table below).

### Dictionary as source of truth (jmdictId linkage) & Tanaka Corpus sentences

Every word/card that carries a `jmdictId` field is linked to a row in the Supabase `dictionary` table (see Dictionary section below), which is the **authoritative source for definitions and readings** — not a fallback preference, a hard rule. The static `english`/`back` text on a word or card is used only when there's no `jmdictId` or the dictionary lookup returns nothing (legacy/unmatched entries). This applies identically to Vocab Drill words and Vocab SRS cards (bundled and imported).

Resolution is **live-query + cache**, never denormalized into JSON/storage:
- `src/utils/dictionaryEntryLookup.js` (`fetchDictionaryEntries(ids)`) + `src/hooks/useDictionaryEntries.js` (`useDictionaryEntries`/`useDictionaryEntry`) — batched, module-cached lookup by `jmdictId`, mirroring the `kanjiMeaningLookup.js`/`useKanjiMeanings.js` pattern above. Used by `VocabCard.jsx`, `VocabPage.jsx`'s `GlanceScreen`, and `VocabSrsDrill.jsx`'s `SrsCardFace`.
- `src/lib/dictionaryLookup.js` (`lookupDictionaryEntries`, `pickBestDictionaryMatch`) — the shared two-stage `dictionary` lookup (primary_form exact match, then kana_forms GIN overlap, tie-broken by common+shortest) used by `lookupVocabulary.js`, the backfill/import scripts below, and (in spirit — Deno can't share the module) `supabase/functions/word-import/index.ts`.

**Example sentences** come from the Tanaka Corpus (EDRDG, CC-BY licensed), imported into a Supabase `sentences` table:
```sql
create table if not exists sentences (
  id             text primary key,        -- Tanaka/Tatoeba sentence id
  japanese       text not null,
  english        text not null,
  dictionary_ids text[] not null default '{}',
  quality        boolean not null default false  -- Tanaka Corpus '~' "recommended example" flag
);
create index sentences_dictionary_ids_gin on sentences using gin (dictionary_ids);
grant select on sentences to anon, authenticated;
grant all on sentences to service_role;
-- Supabase enables RLS on every new table by default — without a policy,
-- anon/authenticated reads silently return zero rows (no error):
alter table sentences enable row level security;
create policy "public read" on sentences for select using (true);
```
`src/utils/sentenceLookup.js` (`fetchSentencesFor`) + `src/hooks/useSentenceForWord.js` (`useSentenceForWord`, `useSentencesForWords`) resolve the best sentence per `jmdictId` (quality-flagged first, then shortest), same cached-batch pattern as above.

**Sentence resolution has the opposite priority rule from definitions** — a word/card's own curated `sentence` wins by default; a Tanaka sentence only fills the gap when there isn't one. `vocab-sentence-source` (Vocab Drill) / `srs-sentence-source` (SRS) — both `'custom' | 'tanaka'`, default `'custom'` — flip that priority outright when set to `'tanaka'`. Each renders as a `Select` ("Sentence source", options from `src/data/sentenceSource.js`) nested under the "Show sentence" checkbox, shown only while it's checked — same visual pattern as "Enable audio" → "Text to speech". Attribution for Tanaka-sourced sentences is handled at the page level, not per-card — see Attribution system below.

### Attribution system (`src/data/attributions.js` + `AttributionFooter.jsx`)

Third-party data/asset credits (JMdict/EDICT, KANJIDIC2, Tanaka Corpus, Voicevox) are centralized rather than hand-copied per call site:

- `src/data/attributions.js` — `ATTRIBUTIONS`, a `{ id: segments[] }` registry. Each credit is an array of text segments — `{ text }` for plain text, `{ text, href }` for a clickable piece — rather than one flat string, so file names can link to their EDRDG project page inline within the sentence (their licence page explicitly permits linking or quoting those URLs as the acknowledgement — https://www.edrdg.org/edrdg/licence.html). `dictionary` covers JMdict/EDICT + KANJIDIC together (short, own wording — not EDRDG's full suggested sample text, which is verbose; the requirement is "a general acknowledgement of the sources", not that exact wording); `tanaka-corpus` covers the Tanaka Corpus (CC BY); `voicevox-2`/`voicevox-11` cover the two Voicevox voices (plain text, no link). Adding a new data source (e.g. a future bundled word list with its own attribution requirement) means adding one entry here.
- `src/utils/attributionSegments.jsx` — `renderAttributionSegments(segments)` turns a segment array into inline JSX (`<a>` for linked segments, `<span>` otherwise). Kept out of `AttributionFooter.jsx` to satisfy react-refresh lint (same reasoning as `vocabMap.js`) since it's used both by `AttributionFooter.jsx` and the contextual Voicevox credit line under the "Text to speech" picker (`VocabPage.jsx`/`VocabSrsModule.jsx`, via `getVoicevoxCredit(audioSource)` in `voicevoxAudio.js` — that function now returns segments, not a string).
- `src/components/AttributionFooter.jsx` — `<AttributionFooter sources={['dictionary', 'tanaka-corpus']} />`. Each page/screen declares which credits it actually needs (explicit per-page list, not auto-detected) and the footer renders them (via `renderAttributionSegments`) joined at the foot of the page. It's a normal in-flow block, not `position: fixed`/`sticky` — deliberately, so it never overlaps scrolled content. Each host page uses the classic flexbox "sticky footer" trick instead: the scrollable container is a flex column, and its content is wrapped in an inner `flex: 1` div with the footer as a trailing sibling — short content stretches the wrapper and pushes the footer to the bottom of the viewport, tall content just overflows normally with the footer trailing after it. Preserve that `flex: 1` wrapper when editing these pages' layout, or the footer will stop behaving correctly.
- **Rendered everywhere JMdict/KANJIDIC2/Tanaka-sourced text can actually appear on screen**, including the drill/review screens — not just deck-management/browse screens. The distinction isn't "is this the dictionary module", it's "does this screen ever show text pulled from `dictionary`/`kanji`/`sentences`": `VocabCard.jsx`'s `resolvedEnglish` and `SrsCardFace`'s `resolvedBackText` render JMdict's own gloss text (not just link to it) whenever a word has a `jmdictId` match, `showKanjiMeaning`'s `KanjiMeaningBar` renders KANJIDIC2 meanings, and both can show a Tanaka sentence — so `ActiveDrill`/`DoneScreen` in `VocabPage.jsx` and `VocabSrsDrill.jsx` (both its in-session view and its done-screen return) all carry `['dictionary', 'tanaka-corpus']` too, computed once per component as `footerSources`/inline in the JSX rather than gated off. (Individual flashcards themselves still never render attribution text — it's page/screen-level, not per-card.) Elsewhere: `DictionaryPage.jsx` (`['dictionary']`), `DictionaryEntryPage.jsx` (`['dictionary']`, plus `'tanaka-corpus'` when `sentences.length > 0`).
- **Voicevox** is added into that same footer array *conditionally*, on top of staying in its existing contextual spot: its credit depends on *which voice is currently selected*, not "this page uses this data source", so it stays rendered directly under the "Text to speech" picker in `VocabPage.jsx`/`VocabSrsModule.jsx` (`getVoicevoxCredit(audioSource)` in `voicevoxAudio.js`) for whenever the settings drawer is open. Independently of that, every screen's `AttributionFooter` (Home, Glance, and the drill/review screens — every place the footer renders at all) also appends `` `voicevox-${speakerId}` `` (via `speakerIdFromAudioSource(audioSource)`) whenever audio is enabled and a Voicevox voice is the active source — not gated to only-while-drilling — so the credit is visible whenever the *setting* is on, whether or not audio happens to be playing at that instant or the drawer is open. `VOICEVOX_VOICES`' `credit` fields pull their text from `ATTRIBUTIONS` instead of owning their own copy.

**Scripts:**
| Script | Purpose |
|---|---|
| `scripts/backfill-vocab-jmdict.mjs` | One-off — matches every Vocab Drill word (`src/data/words/*.json`) and bundled SRS deck entry (`core2000.json`, `keigo.json`) against `dictionary`, writing `jmdictId` back into the JSON. Reading-verified (rejects a match if the candidate's `kana_forms` don't include the word's own reading) to avoid linking the wrong homograph — e.g. it deliberately leaves `する`/`ある` unmatched rather than guessing among 為る/刷る/剃る/擦る/掏る. Writes unmatched entries to `backfill-vocab-jmdict-report.json` for manual review; not all entries will ever auto-match (compound/decorated forms like `〇〇向き`, `正確（な）`). |
| `scripts/import-tanaka.mjs` | Downloads/parses the Tanaka Corpus (`examples.utf.gz` from `https://www.edrdg.org/pub/Nihongo/examples.utf.gz` — the `ftp://` URL EDRDG's own docs reference isn't reachable from every network), resolves each sentence's per-word index tags to `dictionary.id`, populates `sentences`. Destructive full-refresh like `import-jmdict.mjs`. |

`jmdictId` write sites for SRS cards (all pass it through `createCard`'s `extras`): `VocabPage.jsx`'s `handleAddToSrs`, `WordImportPanel.jsx`, `ImmersionReader.jsx`, `StoryReviewPage.jsx`. `IMPORTED_CONTENT_FIELDS` in `srs.js` includes `jmdictId` so it survives `resetCardProgress`.

### Adding a word list

**Flat source (no sublists):**
1. Create `src/data/words/mylist.json` with words using `"listKey": "mylist"`.
2. Import the JSON in `VocabPage.jsx` and spread it into `WORD_DATA`.
3. Add `{ id: 'mylist', label: 'My List', lists: null }` to `WORD_SOURCES` in `wordLists.js`.

**Hierarchical source (with sublists):**
1. Create one JSON file per sublist: `src/data/words/nsm-n3-w1d1.json`, etc.
   - Each file is an array of word objects with the matching `listKey`.
2. Import all JSON files in `VocabPage.jsx` and spread them into `WORD_DATA`.
3. Add the source entry (with its `lists` array) to `WORD_SOURCES` in `wordLists.js`.
   - If adding a new sublist to an existing source, append to its `lists` array and add the import.

### Settings persistence
All VocabPage settings are stored in localStorage with `vocab-` prefix (e.g. `vocab-show-furigana`) to avoid colliding with katsuyou-drill's keys. `vocab-audio-source` stores the audio-source picker value (see below).

### Vocab audio (Voicevox)

Word audio is pre-generated via [Voicevox](https://voicevox.hiroshiba.jp/) (neural Japanese TTS) rather than relying solely on the browser's Speech Synthesis API, which varies wildly in quality by OS/browser. This applies to the Vocab drill word lists and the `keigo` bundled SRS deck (see Vocab SRS section) — not to Core 2000 (already has real human-recorded Anki audio), Immersion, Story, or Dictionary (all dynamic/on-demand content a local Voicevox instance can't serve live).

**Voices** (`VOICEVOX_VOICES` in `src/utils/voicevoxAudio.js`, kept in sync with `VOICES` in `scripts/generate-audio.mjs`):
- Speaker id `2` — 四国めたん (Shikoku Metan), Normal style
- Speaker id `11` — 玄野武宏 (Kurono Takehiro), Normal style

**Storage layout**: `audio/voicevox/<speakerId>/<entryId>.mp3` in the same public Supabase Storage `audio` bucket used by Vocab SRS's `audio/imported/` (Anki-uploaded audio) — kept in a separate prefix so the two can never collide or interfere with each other's cleanup.

**Generation** (`scripts/generate-audio.mjs`): reads `src/data/words/*.json` and `src/modules/vocab-srs/decks/keigo.json`, generates audio for any entry missing a voice in its `voicevoxVoices` array (using `kana` as the TTS text for word-list entries, `front` for `keigo.json` entries which have no separate kana field), uploads to Storage, and writes the updated `voicevoxVoices` array back into the source JSON. Every run also **reconciles** each voice folder against the current entries and deletes any orphaned file — this is what makes removing a word/card from the JSON automatically delete its audio too, no separate cleanup step needed. Requires a running Voicevox engine (desktop app, or the headless `voicevox/voicevox_engine` Docker image) reachable at `VOICEVOX_URL` (default `http://localhost:50021`).

**Automation** (`.github/workflows/generate-vocab-audio.yml`): runs the script automatically on every push to `main` touching `src/data/words/**` or the keigo deck (plus manual `workflow_dispatch`), using the official headless Voicevox Docker image spun up just for the job. Commits the updated JSON straight back to `main` with a bot identity — no PR step. The repo is public, so GitHub Actions minutes are free regardless of run frequency.

**Processing status**: the workflow flips a single-row Supabase table, `audio_generation_status` (`id='vocab-audio'`, `status: 'idle'|'processing'`), to `'processing'` while it runs and back to `'idle'` when done (both in the script's own `try/finally` and, as a backstop against runner-level failures, an `if: always()` workflow step). `useAudioGenerationStatus()` polls this row and drives the "Audio is being generated" note shown under the audio-source picker in both the Vocab and SRS settings drawers.

```sql
create table if not exists audio_generation_status (
  id text primary key default 'vocab-audio',
  status text not null default 'idle', -- 'idle' | 'processing'
  updated_at timestamptz not null default now()
);
grant select on audio_generation_status to anon, authenticated;
grant all on audio_generation_status to service_role;
```

**Attribution**: Voicevox's license requires a discoverable text credit for each character voice used, and its own examples credit the Japanese character name (e.g. "VOICEVOX:四国めたん") — an intentional exception to the "no Japanese in the UI" convention. Each voice's credit segments (`ATTRIBUTIONS['voicevox-2']`/`['voicevox-11']` in `src/data/attributions.js`, e.g. "Text to speech powered by VOICEVOX (四国めたん)" with "VOICEVOX" linking to the project — see Attribution system section under Vocabulary Drill for the full segment/link mechanism) render as their own line directly below the "Text to speech" select (`getVoicevoxCredit(audioSource)` in `voicevoxAudio.js`, via `renderAttributionSegments`) — not as the select's `subtext` (that renders above the control, which would read as a field description rather than a credit) — and only while that voice is the selected option, hidden entirely when "Browser TTS" is selected. The same credit is also folded into the drill-screen `AttributionFooter` while that voice is actively speaking (see Attribution system section).

**Playback priority** (both Vocab drill and Vocab SRS): recorded file audio (Core 2000's Anki audio, SRS-only) → Voicevox audio for the selected voice, if generated → browser TTS. The audio-source picker (`AUDIO_SOURCE_OPTIONS` in `src/utils/voicevoxAudio.js`, labeled "Text to speech" in both settings drawers) offers "Female (Shikoku Metan)", "Male (Kurono Takehiro)" (`DEFAULT_AUDIO_SOURCE`, `'voicevox-11'`), and "Browser TTS"; picking a Voicevox voice still silently falls back to browser TTS for any entry that voice hasn't been generated for yet.

**Audio preload** (Vocab drill only): a `useEffect` in `VocabPage.jsx` preloads the current card's Voicevox audio plus the next few upcoming cards (`AUDIO_PRELOAD_COUNT`) into an `Audio` object cache keyed by URL, so flipping to a card doesn't wait on a network fetch. The cache is trimmed to the current window (current + upcoming) on every card change/audio-source change.

### Layout
- Desktop: main content area + chevron toggle + collapsible sidebar (420px wide)
- Mobile: full-screen overlay triggered by "Show options" button in header
- `useIsMobile(768)` and `useIsShort(680)` hooks defined inline in `VocabPage.jsx`

## Auth

GitHub OAuth via Supabase. The auth layer is intentionally thin — no login page, no modal. The sign-in button in the dashboard header triggers the OAuth redirect directly.

| File | Purpose |
|---|---|
| `src/lib/supabase.js` | Supabase client (reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) |
| `src/context/AuthContext.jsx` | `AuthProvider` + `useAuth()` — exposes `{ user, signIn, signOut, loading }` |
| `src/components/AuthSlot.jsx` | Sign in / sign out control — used in dashboard header and module headers |
| `src/hooks/useProgress.js` | `useProgress(namespace)` — Supabase-backed progress hook (see below) |

`AuthProvider` wraps the entire app in `main.jsx`. `loading` is true until the initial session resolves; the header auth slot renders nothing during this window to avoid a flash.

### useProgress hook

```js
const { data, save, loading } = useProgress('my-module-namespace')
```

- **Logged in**: Supabase is the source of truth. Waits for auth to resolve before setting `loading = false` (prevents the init-effect race where `data = null` triggers a fresh-state overwrite before Supabase has responded). Writes to both Supabase and localStorage on every `save()`; localStorage is a write-through cache for fast display on the next load.
- **Logged out**: reads and writes localStorage only under the key `progress-{namespace}`.
- **First sign-in migration**: if Supabase has no row but localStorage has data, the local data is automatically upserted to Supabase and used as the starting state.
- `data` is the stored payload (any JSON-serialisable value), or `null` if nothing saved yet.
- `save(payload)` upserts the full payload and optimistically updates local state.
- Supabase errors are logged as `[useProgress] Supabase save/load/migration failed: …`; localStorage is used as fallback on load errors.

### Supabase schema

The `progress` table. All card/word content lives in static JSON in the repo.

```sql
create table if not exists progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  namespace text not null,
  payload jsonb not null,
  updated_at timestamptz not null,
  unique (user_id, namespace)
);

alter table progress enable row level security;

create policy "select own rows" on progress for select
  using (auth.uid() = user_id);

create policy "insert own rows" on progress for insert
  with check (auth.uid() = user_id);

create policy "update own rows" on progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on progress to authenticated;
grant select, update on progress to service_role;
```

## Vocab SRS (`#/vocab-srs`)

**Self-contained module** — all code under `src/modules/vocab-srs/`. Do not look elsewhere unless touching shared components.

Anki-style spaced repetition using [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs). **Sign-in required** — the module renders a sign-in gate when the user is logged out; progress is stored in Supabase only (no localStorage fallback for this module).

### Key files

| File | Purpose |
|---|---|
| `src/modules/vocab-srs/srs.js` | FSRS functions — see exports below |
| `src/modules/vocab-srs/session.js` | In-session queue — see exports below |
| `src/modules/vocab-srs/migrate.js` | `migrateProgress(raw)` — shape migration; `initializeDeckCards(progress, deckId)` — first-activation setup |
| `src/modules/vocab-srs/import.js` | `parseAnkiExport(tsvString, existingIds)` — Anki plain-text export parser |
| `src/modules/vocab-srs/wordImportApi.js` | `extractWordsFromText(text)` / `extractWordsFromImage(base64, mediaType)` — wrappers over `supabase.functions.invoke('word-import', ...)`; `readImageAsBase64(file)` helper |
| `src/modules/vocab-srs/WordImportPanel.jsx` | Modal UI for the "Import from text / image" flow — paste/image input, review checklist (editable surface/reading/meaning per row), confirm → `onConfirm(cards)` |
| `src/modules/vocab-srs/VocabSrsModule.jsx` | Home screen + sidebar: deck management, stats, settings, Start Review |
| `src/modules/vocab-srs/VocabSrsDrill.jsx` | Drill UI — FlipCard, rating buttons, audio, relearn countdown, session complete |
| `src/modules/vocab-srs/decks/core2000.json` | Bundled deck — 2007 Core 2000 cards with word + sentence audio |
| `src/modules/vocab-srs/decks/keigo.json` | Bundled deck — 30 keigo/formal-register words; audio generated via Voicevox (see Vocab audio section under Vocabulary Drill), no Anki recordings |
| `src/modules/vocab-srs/srs.test.js` | Vitest unit tests for srs.js |
| `src/modules/vocab-srs/session.test.js` | Vitest unit tests for session.js |
| `src/modules/vocab-srs/import.test.js` | Vitest unit tests for import.js |
| `scripts/generate-deck-json.mjs` | One-off — converts an Anki Core 2000 TSV export to `decks/core2000.json` |
| `scripts/upload-audio.mjs` | One-off — uploads Core 2000 Anki audio files to Supabase Storage `audio/imported/` |
| `scripts/anki-sync.py` | One-off — exports FSRS scheduling state from a local Anki Core 2000 deck to a JSON file importable into this app's SRS module, for migrating existing Anki progress |
| `supabase/functions/word-import/index.ts` | Edge function backing "Import from text / image" — see Word import section below |

**Note:** `config.js` exists in the directory but is not imported anywhere — it is vestigial and can be ignored.

### srs.js exports

```js
// Card lifecycle
createBundledCardState(id, deckId)       // New FSRS card state — no content stored
createCard(front, back, id, deckId, extras) // Full card for imported decks (content inline)
resetCardProgress(card)                   // Reset FSRS scheduling; preserve content fields
reviewCard(card, rating, now?)            // Apply FSRS rating; returns updated card

// Queue
getTodaysQueue(cardsObj, decks, { newPerDay, maxOverdueDays })
// → { due, newCards, rescheduled }
//   due: cards with dueDate ≤ now and ≤ 7 days overdue
//   newCards: State.New cards, sliced to newPerDay
//   rescheduled: cards > 7 days overdue, due reset to now; skips suspended cards

// Content resolution
resolveCard(cardState)
// Bundled: looks up all content fields from DECK_FILES[deckId] Map.
// Imported: already has content inline, returned as-is.
// The drill always receives resolved cards.

// Interval preview (for button hints)
previewIntervals(card, now?) → { [Rating.Again|Hard|Good|Easy]: Date }

// Stats
getStats(cards)                  // → { dueToday, newAvailable, learned } for a flat card array — only used internally by the vestigial config.js, see note above
getDeckStats(cardsObj, deckId)   → { total, dueToday, newAvailable, learned }
getGlobalStats(cardsObj, decks)  → { totalCards, dueToday, newAvailable, learned, estimatedMinutes, activeDecks }
getCardStateCounts(cardsObj, decks) → { unlearned, learning, graduated, relearning }

// Re-exports from ts-fsrs
Rating, State
```

### session.js exports

```js
initSession(due, newCards)
// → { queue, completed, history, startTime, initialCount, againCount, goodCount }

getCurrentCard(session)
// Returns first queue card whose waitUntil is in the past (or absent). null if all waiting.

getWaitMs(session)
// ms until the earliest waiting card becomes available (for countdown display). 0 if none.

answerCard(session, card, rating, opts?)
// opts: { leechThreshold = 0 }
// Again on review card → pushed to end of queue with waitUntil = now + 10 min (relearn step)
// Again on new card    → requeued at position 3 immediately
// Hard/Good/Easy       → moved to completed
// If lapses >= leechThreshold on a non-New card: suspended = true added to card
// Returns { session, updatedCard, isLeech }

undoLastAnswer(session)
// Restores the last snapshot from history (ring buffer of 20). Returns { session, revertedCard }.
// revertedCard is the original pre-answer card state — use it directly, no need to re-call reviewCard.

isComplete(session)   // queue.length === 0

getSessionStats(session)
// → { total, remaining, waitingCount, againCount, goodCount, elapsedSeconds, canUndo }
```

### Deck architecture

Cards come from two sources:

**Bundled decks** — static JSON files in `decks/`. Content lives in the JSON; only FSRS scheduling state is persisted to storage. New bundled decks start with no card entries in storage; entries are created on first activation via `initializeDeckCards`.

**Imported decks** — created from Anki TSV exports, or from the "Import from text / image" flow (see Word import below). Content (front/back/audio/sentence fields) is stored inline on each card object in storage.

Both sources write to the same `cards{}` object, distinguished by `deckId`.

### Core 2000 deck content format

Each entry in `core2000.json` (also the shape for `resolveCard` output for this deck):

```js
{
  "id": "anki-1",
  "front": "それ",
  "back": "that, that one",
  "wordAudio": "8b0ee07c....mp3",        // Supabase Storage filename
  "sentenceAudio": "c951babc....mp3",    // Supabase Storage filename
  "sentence": "それはとってもいい話だ。",
  "sentenceEnglish": "That's a really nice story."
}
```

`sentenceEnglish` is shown below the Japanese sentence on the card back (smaller font).

### Audio playback

Audio files live in Supabase Storage bucket `audio/imported/`. URL pattern:

```
${VITE_SUPABASE_URL}/storage/v1/object/public/audio/imported/${filename}
```

### Word import (text / OCR)

"Import from text / image" in the home screen's Import section opens `WordImportPanel.jsx` — paste raw Japanese text, or upload/photograph an image, to bulk-add cards without an Anki export. The image tab offers two file-input triggers: "Take photo" (`capture="environment"`, opens the rear camera directly on mobile) and "Choose image" (gallery/file picker). `capture` is simply ignored on desktop browsers, so no feature-detection branch is needed — both buttons behave identically there. Client sends the input to the `word-import` edge function (`supabase/functions/word-import/index.ts`) and never touches the Anthropic API key directly.

**Pipeline** (`word-import` edge function):
1. *Image input only* — Claude (vision, default `claude-sonnet-5`, override via `WORD_IMPORT_MODEL`) OCRs the Japanese text out of the image via a `json_schema`-constrained `{ text }` response.
2. The resulting (or directly pasted) text is tokenized with the same `npm:@patdx/kuromoji` + jsDelivr dictionary setup `story-generate` uses (duplicated, not shared — see Edge functions section under Story generator for why duplication over abstraction is the norm here). Particles/symbols are dropped; content words are deduped by dictionary base form, capped at 60 (`MAX_WORDS`) with a `truncated` flag if the cap was hit.
3. Each unique base form is looked up against the `dictionary` table with the same two-stage query as `lookupVocabulary.js` (`primary_form` match, then `kana_forms` GIN overlap fallback) using a service-role Supabase client — the edge function's own copy, not the browser one. Words with no dictionary match are still returned (`jmdictId: null`, empty `meaning`) so OCR noise/proper nouns aren't silently dropped, just left for the user to fill in or discard.

Response: `{ words: [{ id, surface, reading, meaning, jmdictId }], truncated }`.

**Client flow**: `WordImportPanel` shows the returned words as a checklist (all pre-selected) with editable surface/reading/meaning fields per row — necessary since OCR and dictionary matching are both imperfect. On confirm, checked rows with both surface and meaning filled in become cards via `createCard(surface, meaning, `word-import-${ts}-${i}`, 'word-import', { kana, jmdictId })`, merged into a dedicated `word-import` deck (name "Imported Words", auto-created on first use — kept separate from the Anki-export `imported` deck so the two sources stay distinguishable in the deck list).

**Deploy**: needs its own `supabase functions deploy word-import` (see Edge functions deploy steps under Story generator) — reuses the same `ANTHROPIC_API_KEY` secret; `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are auto-provided to edge functions and don't need setting.

Built in `VocabSrsDrill.jsx` via the `AUDIO_BASE` constant. Autoplay sequence on flip: word audio first, then sentence audio. Autoplay can be toggled independently for front (on card load) and back (on flip).

### FSRS setup

- `fsrs(generatorParameters({ enable_fuzz: true }))`
- All four ratings are used: **Again** (1), **Hard** (2), **Good** (3), **Easy** (4). Hard/Easy can be hidden via `showHardEasy` setting — when hidden, only Again + Good are shown and keyboard shortcuts remap accordingly.
- `reviewCard` special-cases `New + Again` to keep the card in `State.New` (FSRS would normally transition it to Learning, but we handle new card re-queueing in session logic instead).
- `previewIntervals(card)` returns the projected due date for each rating, displayed as a hint below each rating button.

### Relearn steps

When a **review card** (non-New) is answered Again, `answerCard` pushes it to the end of the queue with `waitUntil = Date.now() + 10min`. `getCurrentCard` skips it until the timer expires; the drill shows a live countdown. When a **new card** is answered Again, it requeues at position 3 immediately (no wait).

### Leech detection

Configured via `leechThreshold` (default 8, localStorage key `srs-leech-threshold`). If `card.lapses >= leechThreshold` on an Again answer for a non-New card, `suspended: true` is added. `getTodaysQueue` skips suspended cards. The drill shows a toast. Suspended cards can be unsuspended by resetting their progress via `resetCardProgress`.

### Progress shape (`useProgress('vocab-srs')`)

```js
{
  decks: {
    [deckId]: {
      id: string,
      name: string,
      active: boolean,
      source: 'bundled' | 'imported',
      addedAt: timestamp,
    }
  },
  cards: {
    [cardId]: {
      id: string,
      deckId: string,
      suspended?: true,              // set by leech detection; absent means not suspended
      // imported decks only — bundled decks read content from static JSON:
      front?: string,
      back?: string,
      kana?: string,
      wordAudio?: string,
      sentenceAudio?: string,
      sentence?: string,
      sentenceEnglish?: string,
      jmdictId?: string,             // set on immersion-words cards when word matched JMdict
      voicevoxVoices?: number[],     // set on vocab-drill-words cards — speaker ids with generated audio, copied from the source word
      voicevoxId?: string,           // set alongside voicevoxVoices — original word id, since cardId is a synthetic vocab-drill-words-<ts>-<i> string and Voicevox storage paths are keyed by the original word id
      // FSRS scheduling fields (stability, difficulty, due, state, lapses, …):
      ...fsrsFields
    }
  },
  lastSession: string | null,
  totalReviews: number,
  newCardDay: {
    date: string,   // YYYY-MM-DD UTC — the date new cards were last introduced
    count: number,  // how many new cards were introduced on that date
  },
}
```

`migrateProgress(raw)` handles three cases: fresh install, already-new shape (also drops retired `core3k` deck and its cards), and old shape (cards was an array). Always safe to call on load.

`initializeDeckCards(progress, deckId)` populates card entries for a bundled deck when it is first activated (skips cards that already exist).

`newCardDay` is missing from old data — always access as `progress.newCardDay ?? { date: '', count: 0 }`.

### Daily new card limit

`dailyNewCards` (localStorage key `srs-daily-new-cards`, default 10) caps how many new cards can be introduced per calendar day. Computed in `VocabSrsModule`:

```js
const todayStr = new Date().toISOString().split('T')[0]  // YYYY-MM-DD UTC
const newCardsIntroducedToday = newCardDay.date === todayStr ? newCardDay.count : 0
const effectiveNewPerDay = Math.max(0, dailyNewCards - newCardsIntroducedToday)
```

`newCardDay.count` reflects new cards **actually introduced** — cards that have been answered out of `State.New` — not cards merely pulled into a session. It is **not** bumped when a review starts: `handleStartReview` records the session's new-card ids and the day's baseline count in `sessionNewCardsRef`, and `computeNewCardDay` recounts on every card save (and on session done) as `baseline + (session new cards no longer in State.New)`. This way, starting a review of N new cards and quitting without studying them does not consume the daily allowance, and undo lowers the count back. (Historically the count was incremented up-front at session start, which made an abandoned session report "no new left".)

### Session flow

1. Compute `effectiveNewPerDay = max(0, dailyNewCards - newCardsIntroducedToday)`.
2. `getTodaysQueue(cardsObj, decks, { newPerDay: effectiveNewPerDay })` returns `{ due, newCards, rescheduled }`.
3. `canStart = due.length > 0 || newCards.length > 0 || rescheduled.length > 0`. Rescheduled cards are included so advancing many days doesn't produce "Nothing due".
4. On "Start review": the session's new-card ids + day baseline are stashed in `sessionNewCardsRef` (count is **not** bumped yet — see Daily new card limit); rescheduled cards merged into `due` (their updated due dates saved); all cards resolved via `resolveCard`.
5. `initSession(resolvedDue, resolvedNewCards)` creates the session object.
6. Drill calls `getCurrentCard(session)` each render — skips cards with a future `waitUntil`.
7. `answerCard(session, card, rating, { leechThreshold })` returns `{ session, updatedCard, isLeech }`.
8. `undoLastAnswer(session)` restores the previous snapshot; `revertedCard` is the pre-answer state.
9. Session ends when `isComplete(session)` (queue empty).
10. Drill returns the resolved session card array; module calls `resolvedArrayToCardsObj` to strip `front`/`back` from bundled cards before merging back into `cards{}`.

### SRS settings (localStorage)

All keys use `srs-` prefix. The VocabSrsModule reads these on mount; VocabSrsDrill receives them as props.

| Key | Default | Purpose |
|---|---|---|
| `srs-daily-new-cards` | `10` | New cards per calendar day |
| `srs-show-hard-easy` | `true` | Show Hard + Easy rating buttons (4-way vs 2-way) |
| `srs-leech-threshold` | `8` | Lapse count before card is suspended (0 = disabled) |
| `srs-audio-enabled` | `true` | Master audio switch |
| `srs-autoplay-audio` | `true` | Parent toggle for front/back autoplay |
| `srs-autoplay-front` | `true` | Autoplay word audio when card loads |
| `srs-autoplay-back` | `true` | Autoplay word → sentence audio on flip |
| `srs-audio-source` | `'voicevox-11'` | Audio source picker — `'voicevox-2'` \| `'voicevox-11'` \| `'browser'`, see Vocab audio section |
| `srs-tts-voice` | `''` | Browser TTS voice name (used when audio source is `'browser'`) |
| `srs-sfx-enabled` | `true` | Sound effects (correct/wrong beeps) |
| `srs-show-furigana` | `true` | Show kana reading on card front; always shown on back |
| `srs-show-translation` | `true` | Show English translation on card back |
| `srs-show-sentence` | `true` | Show example sentence on card back |
| `srs-sentence-source` | `'custom'` | `'custom'` \| `'tanaka'` — which sentence wins when both a curated sentence and a Tanaka Corpus match exist (see Dictionary linkage section under Vocabulary Drill) |
| `srs-show-kanji-meaning` | `false` | Show per-kanji meaning bar on card back (see Per-kanji meanings under Vocabulary Drill) |
| `srs-pixel-font` | `true` | Use DotGothic16 pixel font on cards |
| `srs-visual-effects` | `true` | Enable card visual effects |

### Dev advance feature (DEV only)

Visible in the settings sidebar when `import.meta.env.DEV` and cards exist. "Advance N days" shifts all card `due` dates back by N days and resets `newCardDay: { date: '', count: 0 }` to grant a fresh daily new card allocation. Each click is cumulative. Rescheduled-card inclusion in sessions means advancing arbitrarily many days still surfaces all due cards correctly.

## Immersion (`#/immersion`)

**Self-contained module** — all code under `src/modules/immersion/`. NHK-style Japanese reading articles generated nightly by a GitHub Actions pipeline.

### Key files

| File | Purpose |
|---|---|
| `src/modules/immersion/ImmersionModule.jsx` | Article list screen — fetches from Supabase, reading history, auto-marks the opened article read |
| `src/modules/immersion/ImmersionReader.jsx` | Reader — renders inside the shared `NewspaperLayout`, word popup, furigana toggle, SRS bridge |
| `src/modules/immersion/sourceLabels.js` | `SOURCE_LABEL` — shared between the list's `ArticleCard` badge and the reader's `NewspaperLayout` masthead |
| `scripts/fetch-nhk.mjs` | Nightly pipeline — discovers current news topics across a broad range of sources via Claude's web search tool, generates articles via Claude Haiku, tokenizes with Kuromoji, looks up JMdict definitions |
| `scripts/import-jmdict.mjs` | One-time import — downloads jmdict-simplified JSON and populates the Supabase `dictionary` table |
| `scripts/backfill-jmdict.mjs` | One-off backfill — re-tokenizes existing articles and regenerates `vocabulary_ja` from JMdict |
| `scripts/backfill-definitions.mjs` | Legacy — original Claude Haiku definition backfill, superseded by `backfill-jmdict.mjs` |
| `.github/workflows/fetch-articles.yml` | GHA cron — runs `fetch-nhk.mjs` nightly at 01:00 UTC; requires Node 22 (for native WebSocket in `@supabase/realtime-js`) |

### Supabase `articles` table

```sql
create table if not exists articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  source       text,
  title        text not null,
  title_en     text,
  published_at timestamptz not null,
  body_ja      text not null,
  body_simple  text,
  summary_en   text,
  questions    jsonb,   -- [{q, a}] x3
  difficulty   smallint,
  tokens_ja    jsonb,   -- [{t, r, w}] — Kuromoji tokens for body_ja
  tokens_simple jsonb,  -- [{t, r, w}] — Kuromoji tokens for body_simple
  vocabulary_ja jsonb,  -- [{word, reading, meaning, jmdictId, pos}] — JMdict entry per content token
  active       boolean not null default true
);
grant select on articles to anon, authenticated;
```

Token shape: `{ t: "surface", r: "hiragana-reading|null", w: boolean }` — `w: false` for particles, auxiliary verbs, punctuation, BOS/EOS.

`vocabulary_ja` entry shape: `{ word, reading, meaning, jmdictId, pos }` — `jmdictId` and `pos` are null for words not found in JMdict (proper nouns, new slang, etc).

### Supabase `dictionary` table

Central dictionary backed by [jmdict-simplified](https://github.com/scriptin/jmdict-simplified). 217,625 entries; `common = true` on ~22,610 entries (ichi1/ichi2/news1/news2/spec1/spec2 priority markers). To prune to common-only: `DELETE FROM dictionary WHERE NOT common;`

```sql
create table if not exists dictionary (
  id           text primary key,       -- JMdict entry id
  primary_form text not null,          -- first kanji form, or first kana form if no kanji
  kanji_forms  text[] not null default '{}',
  kana_forms   text[] not null default '{}',
  gloss_en     text,                   -- all English glosses joined with '; ' (flattened, for search/preview)
  pos          text[],                 -- partOfSpeech codes across all senses
  common       boolean not null default false,
  senses       jsonb,                  -- full per-sense breakdown, see below
  jlpt_level   text,                   -- 'N5'..'N1', community-estimated (see below) — null for unmatched entries
  jlpt_level_inferred boolean not null default false -- true when jlpt_level came from suffix-stripping inference, not a direct source match
);
create index dictionary_primary_form_idx on dictionary (primary_form);
create index dictionary_kana_forms_gin   on dictionary using gin (kana_forms);
create index dictionary_common_idx       on dictionary (common);
create index dictionary_jlpt_level_idx   on dictionary (jlpt_level);
grant select on dictionary to anon, authenticated;
grant all on dictionary to service_role;
```

`senses` is an array of `{ gloss[], pos?[], field?[], misc?[], info?[], dialect?[], languageSource?[{lang, text?, wasei?}], related?[], antonym?[] }` — one entry per JMdict sense, built by `transformEntry()` in `scripts/import-jmdict.mjs`. It powers the full-detail view in `DictionaryEntryPage.jsx` (grouped by part-of-speech, with field/misc/dialect tags and cross-references); rows imported before this column existed fall back to rendering `gloss_en` as a flat block.

**`jlpt_level`** — no official JLPT vocabulary list exists (the Japan Foundation stopped publishing one when the test moved from 4 levels to N1–N5 in 2010; this is also why JMdict's own former JLPT field was dropped), so this is a **community-estimated approximation**, populated by `scripts/import-jlpt-vocab.mjs` from [stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab) (CC BY-SA 4.0 — a JMdict-id-matched conversion of Jonathan Waller's JLPT Resources list, tanos.co.uk, CC BY; same de-facto list Jisho.org uses). Matching is a direct `jmdict_seq` → `dictionary.id` join, reading-verified against `kana_forms` the same way `backfill-vocab-jmdict.mjs` verifies matches elsewhere, since JMdict snapshots can drift between when this app's `dictionary` table was built and when the JLPT source list was last generated — mismatches are skipped and logged rather than trusted. UI copy referencing this data should say "estimated"/"approximate", never "official". Attribution: `ATTRIBUTIONS['jlpt-vocab']` in `src/data/attributions.js`. If this source is ever swapped, the next-best fallback found during research was [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) (MIT, same Waller/tanos.co.uk root data) — no JMdict ids though, so it would need the same reading-verified matching pipeline the Jiten integration below already uses rather than a direct id join.

Waller's list only tags root vocabulary, not derived/compound forms (e.g. 刺激 is N3 but 刺激的/刺激性/刺激剤 aren't listed at all — confirmed live, only ~60% of a real anime episode's content words get a direct tag). `scripts/infer-jlpt-vocab.mjs` fills in some of the gap by stripping 1–2 trailing characters off an untagged word's kanji forms and checking whether the remainder is a directly-tagged root — reading-verified against `kana_forms` (not just a kanji-substring match), since the same kanji can carry very different levels across different dictionary entries (confirmed live: 人 ranges N5 as a standalone noun to N1 as a counter-suffix; 私 has 11 entries from N5 to N1 depending on reading). If multiple reading-verified candidates disagree on level, the word is left untagged rather than guessed. Matches are written with `jlpt_level_inferred = true` and rendered dimmer/prefixed `~` wherever `jlpt_level` is shown (`EpisodeVocabBrowser.jsx`), since it's an approximation of an already-unofficial approximation. Never chains through another inferred row — only directly-sourced (`jlpt_level_inferred = false`) rows are used as strip targets.

Lookup in the pipeline uses a two-stage query: stage 1 matches `primary_form` against Kuromoji `basic_form`; stage 2 uses GIN array overlap on `kana_forms` for entries where the basic form is kana but the JMdict primary form is kanji (e.g. `ある` → `有る`).

### Word popup / definitions

Every content token (`w: true`) in `tokens_ja`/`tokens_simple` is clickable in the reader. Clicking shows a popup with the word, its reading, part of speech, and an English definition sourced from `vocabulary_ja`. Run `backfill-jmdict.mjs` to regenerate definitions for existing articles.

### Reader layout

The article (title, `title_en` as a subtitle, date, body) renders inside the shared `NewspaperLayout` (`src/components/NewspaperLayout.jsx`, promoted from Story's `news` format so both modules render real reading content the same way) — `masthead` is the article's source label, `edition` is "Simple edition" / "Intermediate edition" from the active toggle. The version toggle is labelled **Simple / Intermediate**, not Original/Simplified — `body_simple` is the beginner rewrite, `body_ja` (the "original") is the intermediate one; a true beginner tier would need a `fetch-nhk.mjs` pipeline change, not a UI one. The toggle and furigana `ToggleButton` sit in a row above the paper; the English-summary `Disclosure` sits below it.

### Article retention

Articles accumulate indefinitely — there is no cleanup job. The reader fetches the 10 most recent (`limit(10)` ordered by `published_at desc`), so old articles are invisible to users but stay in the database. At ~5 articles/day × ~10 KB each (with JSONB tokens), growth is ~18 MB/year — well within Supabase free tier limits. If storage ever becomes a concern, add a post-upsert delete to `fetch-nhk.mjs` that removes rows beyond the newest N.

### `useProgress('immersion')` payload

```js
{ read: { [slug]: { readAt: ISO string, score: null } } }
```

Marked automatically — `ImmersionModule` calls `markRead` in a `useEffect` keyed on `selectedArticle`, gated on `user` (signed-out visitors never mark; the same gating the old explicit button had). There is no "Mark as read" control; opening an article is the action. `markRead` itself de-dupes against `readSet`, so re-opening an already-read article is a no-op.

### SRS bridge

`ImmersionReader` imports `createCard` from `../vocab-srs/srs.js` and writes directly to the `vocab-srs` progress namespace, appending words to an `immersion-words` imported deck (created on first add). Story generator does the same thing with a `story-words` deck (see Story generator section) — together these are the only cross-module writes in the codebase.

## Grammar Map (`#/grammar-map`, experimental)

**Self-contained module** — `src/modules/grammar-map/`. A dependency graph of Japanese grammar points rendered with [`@xyflow/react`](https://reactflow.dev/) (React Flow). Grammar points that share the same prerequisite set are laid out as columns inside a shared group box; points are visually "locked" until their prerequisites are marked known, gamifying the learning order. Progress (which points are marked known) is local-only — `localStorage` key `grammar-map-known`, no `useProgress`/Supabase involvement, no sign-in required.

### Key files

| File | Purpose |
|---|---|
| `src/modules/grammar-map/GrammarMapModule.jsx` | The whole module — graph state, side panel (progress stats + selected-node detail), core-only filter, known/unknown toggling |
| `src/modules/grammar-map/GrammarNode.jsx` | React Flow node renderer for a single grammar point (locked/unlocked/known/selected visual states) |
| `src/modules/grammar-map/GrammarGroupNode.jsx` | React Flow node renderer for a group box (the column of nodes sharing one prerequisite set) |
| `src/modules/grammar-map/grammarNodes.js` | Joins `grammar-list.json` (content) with `grammar-deps.json` (prereqs) into `GRAMMAR_NODES` — the data the module renders |
| `src/modules/grammar-map/layout.js` | `computeGroupedLayout(nodes)` — groups nodes by identical prereq set, lays out each group as a 3-column grid via `dagre`, positions groups relative to each other |
| `src/modules/grammar-map/grammar-list.json` | Grammar point content — `{ id, term, level, description, meaning, example, jlptLevel, category }[]`. Duplicated at the repo root; see Data pipeline below |
| `src/modules/grammar-map/grammar-deps.json` | Grammar point prerequisites — `{ term, level, prereqs[], jlptLevel, category }[]`. Duplicated at the repo root |

### Data pipeline (one-off, run manually)

The grammar data was built once via a chain of scripts, each reading/writing the **root-level** `grammar-list.json`/`grammar-deps.json` (the module's copies under `src/modules/grammar-map/` are the ones actually imported by the app and must be kept in sync — some scripts write both copies, some only the root):

1. `scripts/extract-dojg-grammar.mjs` — extracts JLPT grammar entries from the DOJG Yomichan dictionary → writes root `grammar-list.json`.
2. `scripts/generate-grammar-deps.mjs` — asks Claude to infer prerequisite relationships between grammar points in `grammar-list.json` → writes root `grammar-deps.json`. Requires `ANTHROPIC_API_KEY`.
3. `scripts/enrich-grammar-jlpt.mjs` — asks Claude to assign a JLPT level (N5–N1) to each point → writes `jlptLevel` back into **both copies** of both JSON files. Requires `ANTHROPIC_API_KEY`.
4. `scripts/enrich-grammar-category.mjs` — asks Claude to classify each point into one of six functional categories → writes `category` back into **both copies** of `grammar-list.json`. Requires `ANTHROPIC_API_KEY`.

There is no automation (no GitHub Actions workflow) re-running this pipeline — it's a manual, occasional process for adding/correcting grammar data.

### `GRAMMAR_NODES` shape (`grammarNodes.js`)

```js
{
  id: string,          // = term
  label: string,        // = term
  sublabel: string,     // = meaning
  description: string,
  example: string | null,
  level: string,         // 'basic' | 'intermediate' (from DOJG)
  jlptLevel: string | null, // 'N5'–'N1'
  category: string | null,
  prereqs: string[],    // term ids of prerequisite grammar points
  position: { x: 0, y: 0 }, // placeholder — real position computed by layout.js
}
```

### Layout algorithm (`layout.js`)

`computeGroupedLayout(nodes)` groups nodes that share an identical (sorted) prereq set into one group box, laid out as a `dagre`-positioned 3-column grid inside the box; nodes with a unique prereq set become standalone ("solo") nodes. Groups themselves are then arranged via `dagre`. A synthetic `grp:gateways` group holds all zero-prereq ("foundation") nodes.

### UI behavior

- **Core-only filter**: toggling "Core grammar only" in the side panel filters to N5+N4 nodes only (`CORE_LEVELS`), recomputing the layout and edge set against just the visible subset.
- **Unlocking**: a node is "unlocked" when every one of its prereqs (that's still visible under the current filter) is in the `known` set. Locked/unlocked/known are three distinct visual states on `GrammarNode`.
- **Side panel**: shows global progress stats (known/unlocked/locked counts) by default; clicking a node switches it to that node's detail (description, example, "Mark as known" button when unlocked, clickable prerequisite/dependent lists that re-select).
- Desktop: collapsible side panel with chevron toggle (mirrors the Vocab drill sidebar pattern). Mobile (`useIsMobile(768)`, defined inline): side panel is hidden entirely — the module is desktop-oriented.

## Dictionary (`#/dictionary`)

**Page-based** — two routes: `#/dictionary` → `DictionaryPage.jsx` (search) and `#/dictionary/entry/:id` → `DictionaryEntryPage.jsx` (full entry detail). JMdict-backed dictionary with inline kanji lookup. Searches the Supabase `dictionary` table (JMdict) and the `kanji` table (KANJIDIC2).

Each word result row on `DictionaryPage` (`EntryRow`) is a link to `#/dictionary/entry/${entry.id}`, not an inline expansion. `DictionaryEntryPage` re-fetches the full row (including `senses` and `kanji_forms`) plus `kanji` table rows for every kanji character in `primary_form`, and renders: the word with alternate forms, a grouped-by-part-of-speech sense list (via `SensesSection`, using the `senses` jsonb column — falls back to the flat `gloss_en` string for pre-`senses` rows), a "Your Decks" section, a "Kanji" breakdown section listing each component kanji's readings/meanings/grade/JLPT/stroke count/frequency (reusing the same visual card style as the search page's kanji carousel), and an "Example Sentences" section.

**"Your Decks" section** — shows which decks this word (by `entry.id` = `jmdictId`) appears in, and its SRS status. Renders when there's a Vocab Drill match (`WORD_DATA.filter(w => w.jmdictId === entry.id)`, resolved to human labels via `WORD_SOURCES`, no auth needed — pure client-side, already-bundled data) or the user is signed in (in which case SRS decks are checked too, via `useProgress('vocab-srs')` → `migrateProgress` → `resolveCard(card).jmdictId === entry.id` for every card, showing deck name + `cardStateLabel(card)` from `srs.js`). Signed-out visitors with no Vocab Drill match see nothing — the section is skipped entirely rather than nagging every word to sign in.

**"Example Sentences" section** — up to 5 rows from the `sentences` table (`.overlaps('dictionary_ids', [entry.id])`, quality-flagged first), each showing the Japanese sentence + English translation. Attribution is handled by the page-level `AttributionFooter`, not per-sentence — see Attribution system section under Vocabulary Drill for the full `sentences` table schema and import pipeline.

### Key files

| File | Purpose |
|---|---|
| `src/pages/DictionaryPage.jsx` | Search UI, query logic, result rendering, kanji carousel |
| `src/pages/DictionaryEntryPage.jsx` | Full entry detail page — grouped senses, alternate forms, per-kanji breakdown |
| `scripts/import-jmdict.mjs` | One-time import — populates `dictionary` table from jmdict-simplified JSON |
| `scripts/import-kanjidic2.mjs` | One-time import — populates `kanji` table from KANJIDIC2 JSON or zip |

### Search branches

`doSearch` in `DictionaryPage.jsx` has three branches based on input:

1. **Japanese typed** (`isJapanese(trimmed)`, offset 0) — two queries merged: `primary_form` prefix + `kana_forms` GIN containment. Results deduped and sorted by `relevanceScore`.
2. **Romaji input** (converts via wanakana's `toKana()` to a valid kana string, offset 0) — four parallel queries: kana_forms containment + three word-boundary English gloss queries. Merged, deduped, sorted.
3. **Pure English** (no kana conversion, offset 0) — three word-boundary English gloss queries (first, middle, last gloss position). Merged, deduped, sorted.
4. **Pagination** (offset > 0) — single range query, DB order only.

**Word-boundary gloss matching**: English gloss queries use word-boundary patterns rather than substring `%term%`, preventing "car" from matching "carriage", "carpet", etc. Patterns for each term:
- `term + '; %'` — term is first gloss item
- `'%; ' + term + '; %'` — term is middle gloss item
- `'%; ' + term` — term is last gloss item

### `relevanceScore(row, term, effectiveTerm)`

Client-side sort applied after merging query results. Scoring:

| Signal | Points |
|---|---|
| `common = true` | +100 |
| `primary_form` exact match | +80 |
| `kana_forms` contains effective term | +60 |
| `primary_form` starts with term | +25 |
| First gloss exact match | +40 |
| Any gloss exact match | +30 |
| First gloss starts with term | +20 |
| Length penalty | −min(primary_form.length, 20) |

### Kanji carousel

When results include common kanji (from `vocabulary_ja` in the articles table or direct KANJIDIC2 lookup), a horizontal carousel appears above the word results showing kanji cards. Each card shows the character, readings, and meaning and can be expanded in place for full detail (stroke count, JLPT level, frequency, all readings/meanings).

### Supabase `kanji` table

```sql
create table if not exists kanji (
  literal     text primary key,
  grade       smallint,
  stroke_count smallint,
  jlpt        smallint,
  frequency   smallint,
  meanings    text not null default '',  -- English meanings joined with '; ' (plain text, not array)
  on_readings text[] not null default '{}',
  kun_readings text[] not null default '{}',
  common      boolean not null default false
);
grant select on kanji to anon, authenticated;
grant all on kanji to service_role;
```

Populated by `scripts/import-kanjidic2.mjs` (accepts raw XML zip or pre-converted JSON).

## Story generator (`#/story`, `#/story/:id`)

**Self-contained module** — `src/modules/story/`. Generates original Japanese written content (stories, fake news articles, dialogue transcripts) constrained to vocabulary the learner already knows, with Japanese comprehension questions graded leniently by a second model call.

Two routes, two components:
- `#/story` → `StoryModule.jsx` — the overview: vocabulary source / format / length / grammar picker, "Generate", and a "Recent stories" section listing the most recently generated stories **across all users** (public feed, visible whether signed in or not).
- `#/story/:id` → `StoryReviewPage.jsx` — the reading + comprehension-question view for one generated story. Breadcrumb is `Japanese Study / Story generator / Review story`.

**Generation requires sign-in** — the Generate button is disabled (with an inline "Sign in to generate stories" hint) until `useAuth()` returns a `user`; everything else on the page (source/format pickers, context preview, browsing recent stories) works signed out. On generate, `StoryModule` inserts the result directly into the `stories` table (see below) with `user_id: user.id` and a client-generated `crypto.randomUUID()`, then navigates to `#/story/<id>` (`window.location.hash = ...`, the same cross-page navigation pattern used by breadcrumb links — `App.jsx`'s `hashchange` listener picks it up). `StoryReviewPage` fetches the story by id directly from `stories` (`supabase.from('stories').select(...).eq('id', storyId).maybeSingle()`) — it does not refetch or regenerate anything, and works for any visitor regardless of who generated the story. "New content" on the review page navigates back to `#/story`.

### Formats

`FORMATS` in `StoryModule.jsx` and `FORMAT_HINTS` in `supabase/functions/story-generate/index.ts` must stay in sync (one entry per format id). Current formats: `story`, `news`, `dialogue`, `diary`, `interview`, `letter`, `postcard`. Every format still returns the same `{ title, story, questions, tokens }` shape — new formats are just a different `FORMAT_HINTS` prompt (register/genre/structural convention) plus, optionally, a dedicated layout component. No new format should require a second LLM call or a schema change; if one seems to, that's a sign to lean on a prompt convention + client-side parsing instead (as `dialogue`/`interview` do with 名前「セリフ」 and `diary` does with the date-line header).

`StoryReviewPage.jsx` dispatches on `story.format` via a `FORMAT_LAYOUTS` lookup object (`{ news: NewspaperLayout, dialogue: ChatLayout, diary: DiaryLayout, interview: InterviewLayout, letter: LetterLayout, postcard: PostcardLayout }`); formats not in the map (`story`) fall back to a plain `TokenizedBody` block. A format with a mapped layout is expected to render its own title internally — the page only renders the generic `<h2>` title when there's no matching layout.

- **`diary`** — the prompt requires the very first line to be only the date (e.g. `6月3日（火）`) followed by a single `\n`, then the entry body with no blank line in between. `DiaryLayout` finds the first token with `t === '\n'` (exact single newline, distinct from the `'\n\n'` paragraph-break token) to split header tokens from body tokens, preserving global token indices for popup/highlight correctness (same offset-tracking pattern as `ChatLayout`). If the model doesn't follow the convention, `breakIdx` comes back `-1` and the whole thing renders as body with no header — safe degradation, no crash.
- **`interview`** — reuses the exact `dialogue` convention and `parseDialogue()`, just a different register prompt (two named speakers, interviewer/subject) and a different layout: a printed Q&A column (colored left-border per speaker) instead of chat bubbles. First speaker encountered is treated as the interviewer for accent-color purposes.
- **`letter`** — no structural parsing at all; the whole `story` field renders as continuous prose in an envelope-styled card (mincho serif). No stamp — that visual belongs to `postcard` now; `letter` is just a plain paper letter, horizontal writing.
- **`postcard`** — the one format using vertical writing (`writing-mode: vertical-rl` + `text-orientation: mixed` on the message container). `PostcardLayout` is a fixed-portrait card (~380px wide) with a horizontal header row (7-box postal code grid, 3+4 split, plus a CSS-only perforated stamp — see below) and the message below in vertical columns flowing right-to-left. The prompt tells the model to keep postcard content brief regardless of the selected length, specifically so the fixed-height message area (`height: 300–340px`, `overflowX: auto`) rarely needs to scroll. Vertical writing needed **no changes** to `TokenizedBody`, `WordPopup`, click handling, or furigana rendering — `getBoundingClientRect()`-based popup positioning and ruby annotations both honor the ancestor's `writing-mode` automatically; furigana actually reads more authentically here (it lands to the right of each character column, matching real vertical typesetting) than it does in the horizontal layouts. The only real constraint vertical writing imposes: a bounded-height container with horizontal scroll instead of the page's usual vertical scroll — scoped entirely to this one component, not a page-wide change.
  - **Stamp**: `Stamp()` in `StoryLayouts.jsx` draws a perforated edge with four absolutely-positioned strips, each a repeating `radial-gradient` of the card's own background color, straddling the face's true boundary (half outside the box, half overlapping the colored face) so the visible "bite" is whichever half overlaps. Deliberately abstract/non-representational — no resemblance to any real, copyrighted Japan Post stamp design, consistent with how we've treated other "real-world asset" requests (see the LINE-sticker discussion — same reasoning, not implemented, but the precedent holds here too).

### Supabase `stories` table

Stories are **not** stored via `useProgress` — they're a shared, public resource (any visitor can read any story), unlike every other module's private per-user `progress` payload. Only the owner (`user_id`) can insert; there is no update/delete policy (no edit/delete UI).

```sql
create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  story text not null,
  tokens jsonb,
  questions jsonb not null,
  format text not null,
  created_at timestamptz not null default now()
);

alter table stories enable row level security;

create policy "select all stories" on stories for select
  using (true);

create policy "insert own stories" on stories for insert
  with check (auth.uid() = user_id);

grant select on stories to anon, authenticated;
grant insert on stories to authenticated;

create index if not exists stories_created_at_idx on stories (created_at desc);
```

`StoryModule.jsx` fetches the newest `MAX_RECENT_STORIES` (20) rows (`id, title, format, created_at` only — full content is fetched lazily per-story by `StoryReviewPage`) ordered by `created_at desc`, mirroring the `articles` list-fetch pattern in `ImmersionModule.jsx`. Older stories are simply excluded from the feed, not deleted — there is no cleanup job (same reasoning as `articles`, see Immersion section).

### Key files

| File | Purpose |
|---|---|
| `src/lib/learnerContext.js` | **Shared, not story-specific** — `buildLearnerContext(sourceType, sourceId, options)` → `{ text, wordCount, words }`. Pure data retrieval + formatting; no LLM calls, no UI coupling. Other modules (chat, news simplification) should call this same function. |
| `src/lib/learnerContext.test.js` | Vitest unit tests for learnerContext |
| `src/data/wordData.js` | Shared `WORD_DATA` aggregation (extracted from VocabPage) — used by VocabPage and learnerContext |
| `src/modules/story/StoryModule.jsx` | Overview page — source picker, options, context preview, generate, recent-stories list |
| `src/modules/story/StoryReviewPage.jsx` | Review page — tokenized reader, format-specific layout, inline Q&A with grading, for one saved story looked up by id |
| `src/modules/story/storyUI.jsx` | Shared visual primitives between the two pages — `Button`, `KANJI_FONT`, `ACCENT`, `BG`, `SURFACE` |
| `src/modules/story/storyFieldStyles.js` | Shared `labelStyle` / `fieldStyle` / `selectFieldStyle` for form fields — matches the source-selector pattern established in `VocabPage.jsx` (custom appearance, chevron background-image). Kept out of `storyUI.jsx` (a `.jsx` file) to satisfy react-refresh lint, same reasoning as `vocabMap.js` below. |
| `src/modules/story/api.js` | `generateStory()` / `gradeAnswer()` — wrappers over `supabase.functions.invoke` |
| `src/modules/story/lookupVocabulary.js` | Client-side JMdict lookup for clicked words — two-stage `dictionary` table query (primary_form, then kana_forms overlap), returns `vocabulary_ja`-shaped entries keyed by surface form |
| `src/components/JapaneseReader.jsx` | **Shared** `TokenizedBody` + `WordPopup` — extracted from ImmersionReader; both Immersion and Story use them (furigana toggle, clickable words, dictionary popup, Add to SRS) |
| `src/utils/vocabMap.js` | Shared `buildVocabMap(vocabulary)` (kept out of the .jsx to satisfy react-refresh lint) |
| `src/modules/story/StoryLayouts.jsx` | Format-specific reading layouts — `NewspaperLayout` (paper card, mincho serif, 2-column desktop / 1-column mobile; promoted to `src/components/NewspaperLayout.jsx` — see the Style Guide's component list and the Immersion module, which reuses it for real news articles — this file re-exports it so `StoryReviewPage`'s import is unchanged), `ChatLayout` (LINE-style bubbles with avatars; narration lines render as centered pills; body text uses a system sans-serif stack, not the app's pixel font — see below), `DiaryLayout` (notebook-lined page; splits the date-line header from the entry body), `InterviewLayout` (printed Q&A column reusing `parseDialogue`, colored left-border per speaker instead of bubbles), `LetterLayout` (cream card, mincho serif, no stamp), `PostcardLayout` (portrait card, CSS-perforated stamp, 7-box postal code grid, vertical `writing-mode: vertical-rl` message area — see below) |
| `src/modules/story/parseDialogue.js` | Splits the flat token stream into 名前「セリフ」 speaker lines, preserving global token indices so popup/highlight indexing stays correct across bubbles |
| `src/modules/story/parseDialogue.test.js` | Vitest unit tests for the dialogue parser |
| `supabase/functions/story-generate/index.ts` | Edge function — story generation (default model `claude-sonnet-5`, override via `STORY_MODEL` secret or request `model`) |
| `supabase/functions/story-grade/index.ts` | Edge function — lenient answer grading (default model `claude-haiku-4-5`, override via `GRADE_MODEL` secret) |

### learnerContext contract

- `sourceType: 'vocab-list'` — `sourceId` is a `WORD_SOURCES` source id (expands to all sublists) or a single listKey. Reads bundled word JSON.
- `sourceType: 'srs-deck'` — `sourceId` is a deckId. Caller must pass `options.cards` as **resolved** cards (run bundled cards through `resolveCard` first — scheduling-only state has no front/back). Options: `maturity: 'all' | 'seen' | 'graduated'`, `minStabilityDays`.
- `options.grammarLevel` ('N5'–'N1', default 'N3') appends a grammar directive line; `null` omits it.
- Output is dense one-word-per-line text (`魚 (さかな) — fish`) to control prompt token cost. Core 2000 / Keigo bundled decks have no kana field, so SRS-sourced lines are `front — back`.

### Edge functions

The Anthropic API key never reaches the client — all calls go through Supabase Edge Functions. The learner-context system block carries `cache_control: {type: 'ephemeral'}` so repeated generations in a session reuse the prompt cache (very small word lists may fall below the minimum cacheable prefix and silently not cache — harmless). Structured output via `output_config.format` json_schema — responses are parsed JSON, never prose.

Deploy (one-time setup):

```
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <project-ref>   # ref is in the Supabase dashboard URL
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy story-generate story-grade
```

Generation response shape: `{ title, story, tokens, questions: [{ id, question, correct_answer, acceptable_variations }] }`. Grading: `{ pass, feedback }` — questions and answers are in Japanese; feedback is English.

Generation is **streamed** server-side (`client.messages.stream` + `finalMessage`) with `max_tokens: 16000` and `output_config.effort: 'medium'`. The model outputs only `{ title, story, questions }` (~900 output tokens, ~20s wall clock); the tokens array is built server-side with Kuromoji, NOT by the model — an earlier version had the model emit it, which ballooned output to ~16k tokens and ~130s per generation. Do not add `tokens` back to STORY_SCHEMA.

**Kuromoji in the edge function:** `npm:@patdx/kuromoji` (ESM fork with a fetch-based custom loader) reading uncompressed dictionary files from jsDelivr (`@aiktb/kuromoji@1.0.2/dict/`, ~18 MB) at cold start, cached per warm instance. The tokenizer build starts before the Claude call, so the dictionary download overlaps generation and adds no latency. The token mapping mirrors `tokenizeTextRich` in `scripts/fetch-nhk.mjs`, except `r` is set only for tokens containing kanji (no redundant furigana over kana-only words) and `b` is null for w:false tokens. Tokenization failure is non-fatal: `tokens` comes back null and the reader falls back to a plain text block.

**story-generate response is a heartbeat stream, not plain JSON.** The edge gateway kills any request that sends no bytes for 150s (IDLE_TIMEOUT), so the function returns `text/plain` and streams a space every 10s while Claude works, then the JSON payload as the final line. Typical generations now finish in ~20-40s, but the heartbeat stays as insurance. Consequences: HTTP status is 200 even for post-header failures (errors arrive as `{ error }` in the payload), and `generateStory()` in `api.js` trims the heartbeats and parses the text — keep both sides in sync if the wire format changes. story-grade is fast and stays plain JSON.

`tokens` is Kuromoji segmentation: `[{ t, r, w, b }]` — surface, hiragana reading (kanji tokens only, else null), content-word flag, and dictionary base form (e.g. 向かいました → 向かう; null for w:false). Newlines are their own tokens (required by `parseDialogue`). Concatenated `t` values reproduce `story` exactly. The reader renders tokens through the shared `TokenizedBody` (now themeable: `vocabHighlight`, `hoverBg`, `rtColor` props — needed for the light newspaper background); clicking a word looks up its base form via `lookupVocabulary` and shows the JMdict gloss in `WordPopup`. The reading layout switches on the generation format: `news` → NewspaperLayout, `dialogue` → ChatLayout, anything else (or missing tokens) → plain text block. Hover/focus styles for Story buttons, fields, and recent-story cards live in `global.css` (`.story-btn`, `.story-field`, `.story-recent-card`) per the no-useState-hover rule. "Add to SRS" writes to a `story-words` imported deck in the vocab-srs namespace (second cross-module write, same pattern as immersion-words).

### Story settings (localStorage)

`story-source`, `story-maturity`, `story-grammar`, `story-format` — note `safeLocalStorageGet(key)` takes no fallback argument; use `?? default`.
