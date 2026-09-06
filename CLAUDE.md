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
- **No Japanese text in the UI** — labels, buttons, headings, and all other UI strings must be in English. Japanese text belongs only in word/card data (e.g. `kanji`, `kana`, `front` fields). `public/favicon.svg` (a rendered 文 glyph) is a deliberate exception — it's a logomark, not a string a learner has to read to use the app, the same distinction that already carves out Voicevox's Japanese voice-name credit.
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
| `#/account` | `AccountPage` | `src/pages/AccountPage.jsx` |
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

**Key files:** `src/pages/StyleGuideLabPage.jsx` (the whole page — nav, `ComponentPage`/`FoundationPage` wrappers, per-component demo + controls). Design-system components live in `src/components/`: `Button.jsx`, `Badge.jsx`, `Card.jsx`, `TextInput.jsx`, `NumberField.jsx`, `Select.jsx`, `Checkbox.jsx`, `FileButton.jsx`, `SectionHeader.jsx`, `SignInGate.jsx`, `ActionBar.jsx`, `FilterCard.jsx` (+ `FilterRow`), `Disclosure.jsx`, `Chip.jsx`, `DataList.jsx`, `Modal.jsx`, `ConfirmDialog.jsx`, `Toast.jsx`, `FeedCard.jsx`, `ToggleButton.jsx`, `DistributionBar.jsx`, `Popover.jsx`, `OptionPicker.jsx`, `DeckComboBox.jsx`, `DrillButton.jsx`, `SpeedModeControls.jsx` (a named composition of DrillButton), `DrillHUD.jsx`, `SettingsSidebar.jsx` (+ its `SidebarHeaderToggle` export), `NewspaperLayout.jsx` (promoted from Story, shared with Immersion). Module accent context: `src/context/ModuleThemeContext.jsx`. Shared hook: `src/hooks/useIsMobile.js`. Semantic colour tokens `SUCCESS`/`WARNING`/`DANGER` and `KANJI_FONT` live in `theme.js`.

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
| Switch | Built | The per-row on/off control in `DrillSettingsPanel` |
| Drill Button | Built, migrated | `SpeedModeControls` (now composes it), `VocabSrsDrill`'s `RatingButton` (deleted) |
| Drill HUD | Built (pre-existing component, now in the guide) | — |
| Popover, Option Picker | Built | The duplicated anchored-popover math in `DeckComboBox` + `WordPopup`; the search/list/create surface in `DeckComboBox` |
| Deck Picker | Built — `DeckComboBox`, now a thin wrapper over Popover + OptionPicker | `DeckPickerSheet.jsx`, `SegmentedDeckAdd.jsx`, `DeckPickerLabPage.jsx` (all deleted; `VocabSrsBrowsePage`'s "Move to deck" was the last caller) |
| Select | Built — `size` sm/md, `variant` default/inline, grouped options → `<optgroup>` | `VocabPage`'s word-list picker, every settings drawer (`size`); Story's generator form's Vocabulary/Format rows (`variant="inline"`, living inside a `FilterCard` next to chip rows) |
| File Button | Built | `VocabSrsModule`'s `FileInput`, `WordImportPanel`'s `FileTrigger` |
| Section Header | Built — the **one** section heading. `action` slot (done screens), `marginTop` for stacked in-page groups, the older `hasSelections`/`onClearAll` pair for settings drawers | Settings drawers, done screens, Dictionary's Kanji/Words + entry-page groups, Vocab Drill's preview groups, the home page's stats rail. `SectionLabel` is **deleted** — see settled decision #19 |
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
16. **Comprehension checks are gone for good** from both the News reader and Story review — UI, generation, storage, and the `story-grade` function. Stories no longer ask Claude for questions at all. Don't reinstate the data without a reader to display it: it was generated and stored for a long time after nothing rendered it, paying output tokens and latency on every generation for something no one saw.
17. **A screen's `ActionBar` buttons are `size="xl"`**, one step up from the `lg` a bare primary CTA elsewhere in the app uses — the sticky bar is meant to read as *the* action for the whole screen, not one button among several. Every `ActionBar` consumer (Story's Generate, Vocab Drill's Start review, Anime Vocab's Start Drill) was moved up when `xl` was added; a future `ActionBar` consumer should default to it too.
18. **`Select`'s `inline` variant is for a Select living inside a `FilterCard`/`FilterRow`** next to chip rows — no background/border, same height as a `sm` Chip, so it doesn't read as a different kind of control from its neighbours. The bordered `default` variant stays for settings drawers and any Select that's the only control in its row. `EpisodeVocabBrowser`'s filter block and its lookup/bulk-select header are the template for absorbing a module's remaining hand-rolled filter UI into `FilterCard` + `DataList`'s `search`/`bulkHeader` — look here first before hand-rolling either again.
19. **One section heading, not two — `SectionLabel` is deleted.** The review log's open question ("two heading components, or one with a `divider` flag?") is settled: `SectionHeader` absorbed every `SectionLabel` call site and the file is gone. What actually separated them was one hairline rule and 3px of type size, which is not a component's worth of difference; the hairline goes away rather than becoming a flag, because in practice the heading's own uppercase-and-dimmed treatment already reads as a divider. `SectionHeader` gained `marginTop` (default 0) for the stacked-groups spacing the old callers passed as `marginTop={28}`. Don't reintroduce a lighter heading variant — if a group needs less weight, it probably doesn't need a heading.

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
| `Switch.jsx` | On/off control for a settings row — accent-aware, `role="switch"`, hover lit from the row |
| `DrillSettingsPanel.jsx` | The drill settings drawer shared by Vocab Drill, Anime Vocab and SRS — see Drill settings section |
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

## Home page (`#/`) — textbook-led redesign (in progress, `design-system/home-redesign`)

The dashboard is organised around two primary actions, **New** (work through one textbook's chapters in the Vocab Drill) and **Review** (the SRS), with the other modules as secondary cards below and a global stats sidebar on the right. Rough pass only — the chapters page (`#/vocab`'s home screen rebuilt as "this book, featured, with its chapter list") and the end-of-lesson "send to SRS" prompt are not built yet.

**Model:** one textbook has chapters, nothing else. `src/data/textbooks.js` (`TEXTBOOKS`) is the config: `{ id, title, subtitle, icon, chapters: [{ id, label }] }`. A chapter's `id` is the `listKey` its words carry in `src/data/words/*.json`; chapter labels follow the book's own naming (Genki "Lesson 1", So-Matome "Week 1, Day 1"), never "Chapter N". Books with no word data yet still list their chapters (the picker shows "no words yet"). Only the two So-Matome entries have words today. Pixel-art covers live in `public/placeholder-svg/` (32×32, rendered with `image-rendering: pixelated`); a book with `icon: null` gets a plain spine placeholder. Every cover's artwork occupies x 5–27 of its 32-wide canvas, so 5/32 of each side is transparent gutter — `COVER_GUTTER_FRACTION` in `textbooks.js`, the one place that number lives; recheck it if a new cover is drawn to different bounds. Anything laying a cover out pulls that gutter off the margin so the *artwork's* edge lands where the box's edge would, not 5/32 inside it: `homeCards.jsx`'s `COVER_GUTTER` takes it off the right (cover sits at the card's right edge), and `TextbookPicker`'s `Cover` takes it off both sides (cover sits left of text, so the left edge must go flush and the right must not double up on the row's own flex gap). The spine placeholder for a book with `icon: null` is drawn to fill its box and takes no correction, which is what keeps the two kinds of cover aligned with each other.

**Progress:** stored in the existing `vocab-flashcard` progress namespace — `textbook: { id, currentChapterId }` plus the pre-existing per-list `sublists` drill records. `src/lib/textbookProgress.js` (`resolveTextbookState(progress, wordCountFor)`) derives everything the UI needs: chapters with `drilled`/`wordCount`, `current` (the pointer if it belongs to the book, else the first undrilled chapter), `next`, `doneCount`. A drilled current chapter renders as **[Start next] [Continue current]**; an undrilled one as **[Start current]**; a finished book replaces the chapter count with "Book completed" and the CTA with **[Pick new textbook]**. With no textbook chosen the card drifts a marquee of the available covers (`.textbook-marquee__track` in `global.css`). Changing textbook is the cover itself — hovering it reveals a link over the artwork (`.textbook-cover`), which is why there's no separate "Change textbook" link in the row. The dashboard's Start sets the pointer and deep-links to `#/vocab?chapter=<id>&start=1`; `VocabPage` seeds its source/sublist selection from that query, jumps straight into the drill, and strips the query. Drill results now save signed-out too (localStorage via `useProgress`), so the chapter pointer works without an account.

**Review card:** signed-out → sign-in CTA; signed-in → due / new-today counts computed with the same `getTodaysQueue` maths as the SRS home (`summariseSrs` in `DashboardPage.jsx`), "Start reviews" deep-links to `#/vocab-srs?start=1` which `VocabSrsModule` honours once progress has loaded (then strips the query). "Manage decks" is the full SRS home.

**Stats sidebar:** Textbook (chapters done, words drilled, up next), Reviews (`DistributionBar` over active-deck card states + cards/learned/lifetime reviews), Reading (articles read from `immersion`, series tracked from `anime-vocab-tracking`). There is no per-day review log, so streaks/heatmaps would need new logging first.

**Responsive layout** — three bands, both driven by `useIsMobile`: above `SIDEBAR_BREAKPOINT` (1100) the stats are a 280px right-hand rail and the two primary cards sit beside it; between 769 and 1100 the rail moves *below* the cards as a full-width three-column strip (`StatsPanel columns={3}`) so the cards get their squarish proportions back instead of being squeezed into slivers; at 768 and under everything is one column and `PrimaryCard` drops its 250px min-height (with no neighbour to line up with it would only add dead air).

**Module config:** `tier: 'primary'` on `school-vocab` and `vocab-srs` marks the two big cards; everything else renders as a secondary `ModuleCard` (Conjugation Drill stays, marked external). Grammar Map was removed from the config (module slated for removal; its route still exists).

| File | Purpose |
|---|---|
| `src/pages/DashboardPage.jsx` | Home layout — card/stats/module composition, data loading, textbook picker wiring |
| `src/pages/homeCards.jsx` | `NewCard` / `ReviewCard` themselves (+ `PrimaryCard`) — kept out of the page so the lab below renders the real components |
| `src/pages/HomeCardsLabPage.jsx` | Dev-only harness at `#/dev/home-cards` — every card state side by side, plus realistic New+Review pairs and a column-width picker. Not linked from the dashboard (same convention as `ToastLabPage`). New-card states are built by feeding fabricated progress through the real `resolveTextbookState`; review-card summaries are hand-written objects |
| `src/data/textbooks.js` | Textbook + chapter config — also `publisher`, `description` and `purchase` links (retailer *search* URLs, not product ids, so they don't rot) |
| `src/lib/textbookProgress.js` (+ `.test.js`) | Pure current/next-chapter resolver |
| `src/components/TextbookPicker.jsx` | "Change textbook" — `Modal` + the split browser (`TextbookBrowser`, also exported for the lab): book list beside the selected book's cover, description and buy links. On mobile the confirm button is Modal's own `footer` (outside the body scroll, so it never moves) — which is why selection state lives in `TextbookPicker`, not the browser. On mobile (`stacked`) the detail becomes a `position: sticky` block above the list — **not** a nested scroller: the sheet is max-height-driven, so a percentage-height child silently falls back to auto and pushes the confirm button below the fold. Measured budget on a 375×667 phone: 532px sheet, 261px pinned detail, ~210px (≈5 rows) of list visible; 393×852 gives ~8 rows |
| `src/pages/TextbookPickerLabPage.jsx` | Dev-only bench at `#/dev/textbook-picker` — four candidate picker layouts (Rows, Gallery, Split, Spotlight) with cover/description/buy links, a panel-width picker and a mock-panel preview plus a real-Modal mount. Nothing here is wired into the app yet |
| `src/data/modules.js` | Module config array — accents, hrefs, `tier` |
| `src/components/ModuleCard.jsx` | Secondary module card (hover via `.module-card` in `global.css`) |
| `src/App.jsx` | Hash router |

## Vocabulary Drill (`#/vocab`)

Mirrors katsuyou-drill's UI exactly. Speed-mode only (no text input). Card front: kanji, with furigana only if the Furigana setting is on. Card back: kanji + furigana (via `<ruby>/<rt>`, in-flow for correct vertical centering) + English meaning + optional example sentence.

**Furigana on the back is not a setting** — the back is the answer, so it always carries the reading; the setting only decides whether the *front* gives it away. `SrsCardFace` has always worked this way (`isBack || showFurigana`), but `VocabCard` gated both faces on the one flag and never annotated its front at all, so turning the setting off silently stripped the answer's reading. Pinned by `VocabCard.test.jsx`.

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

**New word lists carry `{ id, listKey, jmdictId }`, plus an optional `kanji`** —
no gloss, reading or sentence. The `dictionary` table is already the source of truth
for all of those (see the Dictionary linkage section), so storing them again
duplicates data that would then drift, and the raw textbook lists they come from
are the publisher's content while this repo is public. `src/data/words/genki_1_vocab.json`
and `genki_2_vocab.json` are the reference examples; the older So-Matome files
still carry the fuller shape below and are read the same way, since every field
is an override with a dictionary fallback rather than a required value.

An override in `scripts/textbook-vocab-overrides.json` may also carry `form`
(and `reading`), which is the **only** way a form JMdict does not list reaches a
card, and is deliberately human-only. JMdict files lexemes, so a textbook's
歩いて or いらっしゃいます has no entry and never will — it does carry
いらっしゃいませ and いらっしゃい, which have lexicalised, which is the line it
draws. Supplementing `dictionary` instead was rejected twice over: a new row
needs an invented id that leaks through `jmdictId` into SRS cards and
`#/dictionary/entry/:id`, while widening `kana_forms` would redefine the column
that `backfill-vocab-jmdict.mjs`, `resolveJmdictIds.js` and the story lookup all
reading-verify against — and `import-jmdict.mjs` is a destructive full refresh,
so either would vanish on the next import. Five cards use it.

`sense` names which of the entry's senses the textbook teaches. JMdict orders
senses by general prominence rather than by what a beginner course wants —
あげる's "to give" is sense 5 of 上げる, behind "to raise; to elevate" — so the
leading glosses often answer a question the book never asked. 85 cards carry
one; `cardGloss(word, entry)` in `dictionaryEntryLookup.js` renders it, falling
back to `briefGloss` when no sense is named.

`mark` carries the decoration a textbook puts around a word to show how it is
used — 〜枚 for a counter, そんな〜 for a prenominal, きれい（な） for a
na-adjective. Matching has to strip that to find the word, so it is stored as a
template (`〜{}`, `{}（な）`) and re-applied at render time: whatever was
stripped, back where the book had it. A template rather than per-shape flags
because the decoration leads, trails or wraps depending on the word.

`suru` marks a word the book teaches as a する-verb. JMdict files those under
the bare noun (勉強 covers 勉強する), so the entry is right but the stored form is
a stem; the card appends する to both form and reading, which is what stops
勉強する being drilled as the noun 勉強. `src/lib/displayForm.js`'s
`cardFormOf(word, entry)` is the one place that resolves a card's form and
reading — use it rather than reading `kanji`/`kana` directly.

`kanji` is present only when the textbook writes the word as one of the
*several forms JMdict already lists for that entry* — のぼる is 上る/登る/昇る and
Genki teaches 登る; 五日 and ５日 are one entry. Keeping the book's spelling makes
the card match the book while still pointing at the same entry for reading and
meaning, so it selects among JMdict's forms rather than storing textbook text,
and the resolver revalidates it on every run. A card therefore has three
possible renderings from one id — the book's spelling, JMdict's canonical form
(`displayFormOf`), and the plain reading — which is the plumbing a display
setting needs. `modified: true` marks the opposite case: nothing the entry lists
is written the way the book writes it (勉強する against 勉強), and the card shows
an M so the difference is stated rather than hidden.

Two consequences worth knowing before adding a list this way: an entry with no
`jmdictId` cannot render at all (there is nothing to fall back to), and a
する-verb resolves to its noun entry, so 勉強する is stored — and displayed — as
勉強. See `scripts/resolve-textbook-vocab.mjs` for the import pipeline and
`scripts/textbook-vocab-overrides.json` for the human decisions it defers to.

Each word object in an older `src/data/words/*.json` file:

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
-- RLS is enabled on every new table automatically — without a policy,
-- anon/authenticated reads silently return zero rows (no error):
alter table sentences enable row level security;
create policy "public read" on sentences for select using (true);
```
`src/utils/sentenceLookup.js` (`fetchSentencesFor`) + `src/hooks/useSentenceForWord.js` (`useSentenceForWord`, `useSentencesForWords`) resolve the best sentence per `jmdictId` (quality-flagged first, then shortest), same cached-batch pattern as above.

**Sentence resolution has the opposite priority rule from definitions** — a word/card's own curated `sentence` wins by default; a Tanaka sentence only fills the gap when there isn't one. That rule is now **fixed behaviour, not a setting** — the "Sentence source" picker was removed from the drill settings drawer (it asked the learner to have an opinion about provenance mid-drill). The `sentenceSource` prop survives on `VocabCard`/`SrsCardFace`/`GlanceScreen`, defaulting to `'custom'`, so the Tanaka-wins path is still reachable if a caller ever wants it. Attribution for Tanaka-sourced sentences is handled at the page level, not per-card — see Attribution system below.

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
| `scripts/backfill-vocab-jmdict.mjs` | One-off — matches every Vocab Drill word (`src/data/words/*.json`) and bundled SRS deck entry (`keigo.json`) against `dictionary`, writing `jmdictId` back into the JSON. Reading-verified (rejects a match if the candidate's `kana_forms` don't include the word's own reading) to avoid linking the wrong homograph — e.g. it deliberately leaves `する`/`ある` unmatched rather than guessing among 為る/刷る/剃る/擦る/掏る. Writes unmatched entries to `backfill-vocab-jmdict-report.json` for manual review; not all entries will ever auto-match (compound/decorated forms like `〇〇向き`, `正確（な）`). |
| `scripts/import-tanaka.mjs` | Downloads/parses the Tanaka Corpus (`examples.utf.gz` from `https://www.edrdg.org/pub/Nihongo/examples.utf.gz` — the `ftp://` URL EDRDG's own docs reference isn't reachable from every network), resolves each sentence's per-word index tags to `dictionary.id`, populates `sentences`. Destructive full-refresh like `import-jmdict.mjs`. |

`jmdictId` write sites for SRS cards (all pass it through `createCard`'s `extras`): `VocabPage.jsx`'s `handleAddToSrs`, `WordImportPanel.jsx`, `ImmersionReader.jsx`, `StoryReviewPage.jsx`. `IMPORTED_CONTENT_FIELDS` in `srs.js` includes `jmdictId` so it survives `resetCardProgress`.

### Personal word lists (`custom_words`)

A learner's own course material — one class's re-chunking of a book, with its
own example sentences and review markers — belongs to an account, not to the
bundle. It lives in `custom_words` (one row per word, `payload` holding the word
itself) rather than in `src/data/words/`, so it is not downloaded by every
visitor: moving 5,277 of these words out took 1.1 MB of JSON off the bundle.

| File | Purpose |
|---|---|
| `supabase/migrations/*_add_custom_words.sql` | Table + RLS. `user_id` cascades from `auth.users`, so `delete-account` needs no change |
| `supabase/migrations/*_custom_word_counts.sql` | `custom_word_counts()` — per-chapter counts for the picker, so drawing 36 tiles doesn't fetch 5,277 rows |
| `scripts/upload-custom-words.mjs` | Moves lists from the repo into an account. Idempotent; keyed `(user_id, id)` |
| `src/hooks/useCustomWords.js` | `useCustomWordCounts()` for the picker, `useCustomWords(listKeys)` for the chapters actually selected |

A source in `WORD_SOURCES` marked `personal: true` has no words in the bundle.
`visibleSources(customCounts)` decides whether to offer it, and ownership
answers itself — the source appears when the viewer has words in it, so there is
no identity to configure. `VocabPage` loads the whole selected personal source
(a few hundred words) so counts, the review toggles and the drill all read one
pool; `DashboardPage` uses the counts RPC alone.

**`scripts/audio-keep.json` is what stops this deleting audio.**
`generate-audio.mjs` reconciles storage by *absence* — any file without a
matching word in `src/data/words/*.json` is pruned — and these words are no
longer there. That file names their ids (ids only, no content) and
reconciliation unions them in. Without it the next push to `main` deletes
~10,000 generated files. Any future list that leaves the repo needs the same
treatment **before** it goes.

Note the maintenance scripts that hard-code word-file paths
(`backfill-vocab-jmdict`, `validate-word-lists`, `strip-redundant-vocab-english`,
`extract-sentence-vocab`) now skip paths that no longer exist rather than
failing to start.

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

### Drill settings — one panel, one hook

Vocab Drill, Anime Vocab and Vocab SRS render **the same settings drawer**: `src/components/DrillSettingsPanel.jsx`, fed by `useDrillSettings(prefix)` from `src/hooks/useDrillSettings.js`. They previously kept three hand-maintained copies of a checkbox list, and the labels had already drifted ("Show furigana" vs "Show furigana on front"). Don't add a fourth — a new drill calls the same hook and renders the same panel.

**Grouped by the part of the card each setting changes**, which is the question being asked when the drawer opens:

| Group | Rows |
|---|---|
| Card front | Furigana, Audio |
| Card back | Meaning, Kanji breakdown, Sentence, Audio |
| Audio | Voice (Male / Female), Backup voice |
| Interface | Sound effects, Visual effects, Pixel font, Streak counter |

Audio is **not** a group of its own: playing the word is one of the things a face does, so `frontAudio` (plays as the card arrives) and `backAudio` (plays on flip) are rows in the two faces, and the audio group keeps only the global decision of which voice speaks. That replaced a master `audio-enabled` switch plus SRS's `autoplay-audio` / `-front` / `-back` trio.

**Voice vs backup voice.** `voice` (`'male'` | `'female'`) picks between the two recorded Voicevox voices — `audioSourceForVoice()` maps it onto the `voicevox-11` / `voicevox-2` speaker strings the rest of the audio code still speaks. `backupVoice` is a browser speech-synthesis voice name, and it reads **any word with no recording** — the drills now fall through to it unconditionally, where they used to only speak when the user had explicitly picked the retired "Browser TTS" source. Consequences: there is no longer a way to force browser TTS over an existing recording, and a card that used to be silent now gets spoken.

Since clips are keyed by what is spoken rather than recorded per word, neither drill can tell in advance whether one exists, so **the fallback fires on playback failure, not on a missing URL**. `useVoicevoxPlayer`'s `play()` resolves false when a clip 404s (Vocab Drill); `VocabSrsDrill` has its own `HTMLAudioElement` path, where `started()` resolves false on the element's `error` event and `speakCard()` is the single place that decides clip-then-backup-voice. A new audio call site should go through one of those two rather than calling `play()` and ignoring the result — that is exactly how a missing clip becomes silence.

**Rows that don't apply are not rendered** — never disabled-with-an-explanation. `hasRecordedVoices={false}` drops the Voice row (Anime Vocab pulls its words from subtitles, so no recordings exist for any of them); an empty `backupVoices` drops the Backup voice row (a device with no speech voices has nothing to choose between). There is no help text under any row, and no indenting: a sub-setting is sequenced by position and by appearing at all.

Storage keys keep their `vocab-` / `srs-` prefixes and are listed in the SRS settings table below (the same suffixes apply to `vocab-`). **Vocab Drill and Anime Vocab deliberately share the `vocab-` namespace** — they always have; they are the same drill over different words. `initialDrillSettings(prefix)` migrates the old keys on first read (see `useDrillSettings.test.js` for the exact mapping) and the new keys are written from then on; the retired keys are left in place rather than deleted.

### Vocab audio (Voicevox)

Word audio is pre-generated via [Voicevox](https://voicevox.hiroshiba.jp/) (neural Japanese TTS) rather than relying solely on the browser's Speech Synthesis API, which varies wildly in quality by OS/browser. This applies to the Vocab drill word lists and the `keigo` bundled SRS deck (see Vocab SRS section) — not to Immersion, Story, or Dictionary (all dynamic/on-demand content a local Voicevox instance can't serve live).

**Voices** (`VOICEVOX_VOICES` in `src/utils/voicevoxAudio.js`, kept in sync with `VOICES` in `scripts/generate-audio.mjs`):
- Speaker id `2` — 四国めたん (Shikoku Metan), Normal style
- Speaker id `11` — 玄野武宏 (Kurono Takehiro), Normal style

**Storage layout**: `audio/voicevox/<speakerId>/<key>.mp3`, where the key is a hash of **the text spoken** (`audioKeyFor` in `src/lib/displayForm.js`), not of the word that wanted it. One reading is stored once however many lists teach it — 7,138 words reduce to 2,272 clips — while two cards of one dictionary entry that say different things (勉強, 勉強する) keep separate clips. A hash because Supabase Storage rejects a non-ASCII object key and decodes percent-escapes before validating; non-cryptographic because a card needs the URL synchronously while rendering. The generator asserts no two readings share a key rather than trusting the hash. Words carry **no** record of their own audio: a card derives the URL from its reading and falls back to browser TTS when the clip 404s, which is also why a word list leaving the repo can no longer orphan audio another list still speaks. `scripts/rekey-audio.mjs` performed the one-off move from the old per-word layout. Formerly `audio/voicevox/<speakerId>/<entryId>.mp3` in the same public Supabase Storage `audio` bucket used by Vocab SRS's `audio/imported/` (Anki-uploaded audio) — kept in a separate prefix so the two can never collide or interfere with each other's cleanup.

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

**Playback priority** (both Vocab drill and Vocab SRS): recorded file audio (an imported Anki deck's own recordings, SRS-only) → Voicevox audio for the selected voice, if generated → browser TTS. The audio-source picker (`AUDIO_SOURCE_OPTIONS` in `src/utils/voicevoxAudio.js`, labeled "Text to speech" in both settings drawers) offers "Female (Shikoku Metan)", "Male (Kurono Takehiro)" (`DEFAULT_AUDIO_SOURCE`, `'voicevox-11'`), and "Browser TTS"; picking a Voicevox voice still silently falls back to browser TTS for any entry that voice hasn't been generated for yet.

**Audio preload** (Vocab drill only): a `useEffect` in `VocabPage.jsx` preloads the current card's Voicevox audio plus the next few upcoming cards (`AUDIO_PRELOAD_COUNT`) into an `Audio` object cache keyed by URL, so flipping to a card doesn't wait on a network fetch. The cache is trimmed to the current window (current + upcoming) on every card change/audio-source change.

### Layout
- Desktop: main content area + chevron toggle + collapsible sidebar (420px wide)
- Mobile: full-screen overlay triggered by "Show options" button in header
- `useIsMobile(768)` and `useIsShort(680)` hooks defined inline in `VocabPage.jsx`

## Database safety net: `rls_auto_enable`

An **event trigger** in the database enables row-level security on every table created in `public`, automatically. It exists only in the database — not in this repo, and not in any migration — so it is easy to be surprised by. It is why a freshly created table already has RLS on, and therefore why a new table returns **zero rows with no error** until you add a policy (the trap called out in the `sentences` schema above).

Safe to leave alone: it `RETURNS event_trigger`, so it cannot be invoked directly even though `PUBLIC` holds EXECUTE on it; it is `SECURITY DEFINER` with `search_path` pinned to `pg_catalog`, which closes the usual escalation vector; and the most it can do is *enable* RLS, swallowing errors so it can never break a migration.

An audit of `anon`/`authenticated` grants (2026-09-05) was otherwise clean: no write access to any reference table, RLS on across the board, and no EXECUTE on the quota functions. The only expected write grants are `progress` (INSERT/UPDATE) and `stories` (INSERT) for `authenticated`, both confined to the caller's own rows by RLS.

## Auth

Multi-provider auth via Supabase: GitHub and Google OAuth, plus passwordless email magic link. There is deliberately **no password anywhere** — magic link instead, which avoids owning a password-reset flow.

`signIn()` stays **parameterless** and opens `SignInDialog` rather than redirecting. With more than one provider available "Sign in" can no longer mean "go to GitHub", and keeping the signature meant the six existing call sites (`AuthSlot`, `VocabSrsModule`, `StoryModule`, `EpisodeDrill`, …) needed no change to gain the chooser. `signInWithProvider(id)` is the actual redirect.

| File | Purpose |
|---|---|
| `src/lib/supabase.js` | Supabase client (reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) |
| `src/context/AuthContext.jsx` | `AuthProvider` + `useAuth()` — exposes `{ user, loading, signIn, signInWithProvider, signInWithEmail, signOut, linkProvider, unlinkProvider, refreshUser }`; also renders `SignInDialog` |
| `src/components/SignInDialog.jsx` | Provider chooser + magic-link field — composes `Modal`, opened by `signIn()` |
| `src/data/authProviders.js` | `AUTH_PROVIDERS` — the one provider list shared by the dialog and the account page's linking UI |
| `src/pages/AccountPage.jsx` | `#/account` — profile, linked accounts (link/unlink), sign out, delete account |
| `supabase/functions/delete-account/index.ts` | Deletes the caller's rows then their auth user — see below |
| `src/components/AuthSlot.jsx` | Sign in / sign out control; the initials link to `#/account` |
| `src/hooks/useProgress.js` | `useProgress(namespace)` — Supabase-backed progress hook (see below) |

**`refreshUser()` exists because `onAuthStateChange` deliberately keeps the previous user object when the id is unchanged** (to avoid a `useProgress` reload flash on every token refresh). Linking or unlinking an identity changes `user.identities` but *not* the id, so without an explicit refresh the account page would never re-render. Any future change to something inside the user object rather than the user itself needs the same call.

**`Avatar` is a deliberate exception to settled decision #2** (module accents come from context). It used `useAccent()`, which recoloured the header badge on every navigation — teal on the dashboard, pink in anime vocab, red in the news reader. It now uses a fixed `AVATAR_COLOR`; the badge stands for the *user*, and that doesn't change with the route. Its `accent` prop survives as an explicit per-instance override. Don't "fix" it back to `useAccent` on the grounds that every other colour-bearing component reads the ambient accent.

**The account page is one centred column of `DataList`s**, not bespoke rows: profile details and linked accounts are both lists. The linked-accounts list has a row for *every* provider whether connected or not — a connected row offers `Unlink` (`ghost-muted`, the documented remove affordance: quiet until hovered, then red), an unconnected one `Link` (`neutral`). That way the list is also where you add a provider, instead of a separate button cluster below it. A magic-link `email` identity only appears once it exists, since it has no OAuth button to offer.

**Account deletion goes through the `delete-account` edge function**, because `auth.admin.deleteUser` needs the service role and must never reach the browser. The function takes **no user id** — it resolves the caller from their own token via `requireUser`, so a caller can only ever delete themselves. `progress.user_id` and `stories.user_id` both reference `auth.users` with no cascade, so those rows are deleted first or the foreign key rejects the user delete; consequently **deleting an account also removes that user's public stories from everyone's feed**. Adding another user-scoped table means adding it to that function.

**Data export** (`src/utils/exportData.js`, tested in `exportData.test.js`) offers two files from the account page's "Your data" section:

- **`buildBackupJson`** — every `progress` row plus the user's `stories`, scheduling included. This is the lossless one, and the only one that can restore a user's state.
- **`buildAnkiTsv`** — card content only, with the deck name as an Anki tag. **Scheduling is deliberately absent and cannot be added:** Anki's text importer only ever writes note fields and tags — never due dates, intervals, ease, or FSRS memory state — and a review card's due date is a day offset from the collection's creation day, which a browser cannot know. A real `.apkg` would need zip + a full SQLite collection in the browser and *still* wouldn't solve the creation-day problem. Don't accept a bug report asking for "full" Anki export without re-reading this. Audio is omitted too: an imported deck's recordings are third-party files, and Anki won't fetch a URL from a field.

Both go through `downloadFile`, which revokes its blob URL on a later tick — revoking in the same tick cancels the download in some browsers. Fields are flattened with `cell()` before joining, since a tab or newline inside a field would silently shift every column after it and produce a file that imports without error and is quietly wrong.

Adding a provider is: one entry in `AUTH_PROVIDERS` **and** enabling it in the Supabase dashboard. The code ships ahead of the dashboard toggle by design — an unconfigured provider's button simply errors, which is also the real launch gate for opening signups. Account linking additionally requires **Manual linking** to be enabled for the project.

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
-- delete is for the delete-account edge function only; without it that
-- function fails with 42501 and account deletion silently can't work.
grant select, update, delete on progress to service_role;
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
| `src/modules/vocab-srs/decks/keigo.json` | Bundled deck — 30 keigo/formal-register words; audio generated via Voicevox (see Vocab audio section under Vocabulary Drill), no Anki recordings. **The only bundled deck.** |
| `src/modules/vocab-srs/srs.test.js` | Vitest unit tests for srs.js |
| `src/modules/vocab-srs/session.test.js` | Vitest unit tests for session.js |
| `src/modules/vocab-srs/import.test.js` | Vitest unit tests for import.js |
| `src/modules/vocab-srs/migrate.test.js` | Vitest unit tests for migrate.js — chiefly the retired-deck filter |
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

### Bundled deck content format

Each entry in a `decks/*.json` file (also the shape `resolveCard` returns for a bundled card). Only `id`, `front` and `back` are required; the rest are optional and `keigo.json` carries none of them:

```js
{
  "id": "keigo-001",
  "front": "いただく",
  "back": "to receive (humble)",
  "kana": "いただく",                     // optional
  "wordAudio": "8b0ee07c....mp3",        // optional — Supabase Storage filename
  "sentenceAudio": "c951babc....mp3",    // optional — Supabase Storage filename
  "sentence": "コーヒーをいただきます。",   // optional
  "sentenceEnglish": "I'll have a coffee." // optional
}
```

`sentenceEnglish` is shown below the Japanese sentence on the card back (smaller font).

**Retiring a bundled deck** — add its id to `RETIRED_DECKS` in `migrate.js` *and* delete its JSON, import, and `DECK_FILES`/`DECK_WORDS` entries. The `RETIRED_DECKS` filter is not optional tidying: a retired deck's cards keep their scheduling state in stored progress but can no longer resolve content, so without it they render as blank cards in the drill. `core3k` and `core2000` were both retired this way (the latter in favour of using Core 2000 in the real Anki app), and `migrate.test.js` covers the behaviour.

### Audio playback

Recorded audio files live in Supabase Storage under `audio/imported/`. URL pattern:

```
${VITE_SUPABASE_URL}/storage/v1/object/public/audio/imported/${filename}
```

**That prefix is currently empty.** Its only occupant was Core 2000's 3,970 recordings, deleted when that deck was retired — checked first against every still-live reference, which found zero overlap because no surviving deck uses recorded audio at all (imported cards get Voicevox, under `audio/voicevox/`). The path and `AUDIO_BASE` stay because an imported Anki deck carrying its own `[sound:…]` media would land here again; a card simply falls through to Voicevox or browser TTS when it has no `wordAudio`/`sentenceAudio`.

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
| `srs-front-audio` | `false` | Speak the word as the card arrives |
| `srs-back-audio` | `true` | Speak the word (then sentence) on flip |
| `srs-voice` | `'male'` | Recorded voice — `'male'` \| `'female'`, mapped to a Voicevox speaker by `audioSourceForVoice()` |
| `srs-backup-voice` | `''` | Browser speech voice name that reads words with no recording (`''` = device default) |
| `srs-sfx-enabled` | `true` | Sound effects (correct/wrong beeps) |
| `srs-show-furigana` | `false` | Show the reading on the card **front**. The back always shows it — see Furigana on the back, under Vocabulary Drill |
| `srs-show-translation` | `true` | Show English translation on card back |
| `srs-show-sentence` | `true` | Show example sentence on card back |
| `srs-show-kanji-meaning` | `true` | Show per-kanji meaning bar on card back (see Per-kanji meanings under Vocabulary Drill) |
| `srs-pixel-font` | `false` | Use DotGothic16 pixel font on cards |
| `srs-visual-effects` | `true` | Enable card visual effects |
| `srs-show-streak` | `false` | Show the streak counter |

The same suffixes and the same defaults exist under the `vocab-` prefix for Vocab Drill and Anime Vocab — `DRILL_SETTINGS_DEFAULTS` is one object, not one per drill.

**The defaults are a deliberate opening position, not an accumulation.** The front gives nothing away (no reading, no audio) so a card actually tests recall; the back gives everything (meaning, kanji breakdown, sentence, audio) so it explains itself once you've answered. Interface keeps the feedback that responds to an answer (sound effects, visual effects) and drops the two decorations (pixel font, streak counter). Changing a default only affects an install with no stored value for that key — everyone else keeps what they had, or what their old keys migrate to. **Retired:** `*-audio-enabled`, `*-autoplay-audio`, `*-autoplay-front`, `*-autoplay-back`, `*-audio-source`, `*-tts-voice`, `*-sentence-source` — all migrated on first read by `initialDrillSettings()`, then unused.

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

**Self-contained module** — `src/modules/story/`. Generates original Japanese written content (stories, fake news articles, dialogue transcripts) constrained to vocabulary the learner already knows.

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

Stories are **not** stored via `useProgress` — they live in their own table, unlike every other module's private per-user `progress` payload. Only the owner (`user_id`) can insert; there is no update/delete policy (no edit/delete UI).

**A story is private to its author unless `shared` is set.** This was not always so — the table originally had a `using (true)` select policy and the module showed one "Recent stories" feed of *everyone's* stories, which is wrong once the app has more than one user. `shared` is a curation flag, flipped by hand in the SQL editor on the handful of stories meant as public examples; there is deliberately no UI for it, since users are not publishing to each other. `StoryModule` renders the two groups separately ("Your stories" / "Examples") using two queries rather than one filtered client-side, so a long example list can't crowd out the user's own work. Signed-out visitors see only the examples, which RLS enforces on its own — the client does no filtering of its own for access.

```sql
create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  story text not null,
  tokens jsonb,
  questions jsonb not null,
  format text not null,
  created_at timestamptz not null default now(),
  shared boolean not null default false  -- curated public examples only
);

alter table stories enable row level security;

create policy "select own or shared stories" on stories for select
  using (shared or auth.uid() = user_id);

create index if not exists stories_shared_idx on stories (shared) where shared;

create policy "insert own stories" on stories for insert
  with check (auth.uid() = user_id);

grant select on stories to anon, authenticated;
grant insert on stories to authenticated;
-- same reason as progress: the delete-account edge function needs both.
grant select, delete on stories to service_role;

create index if not exists stories_created_at_idx on stories (created_at desc);
```

`StoryModule.jsx` runs two queries, each for the newest `MAX_RECENT_STORIES` (20) rows (`id, title, format, created_at` only — full content is fetched lazily per-story by `StoryReviewPage`) ordered by `created_at desc`: one filtered to `user_id`, one to `shared`. Older stories are simply excluded from the list, not deleted — there is no cleanup job (same reasoning as `articles`, see Immersion section).

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
| `src/modules/story/api.js` | `generateStory()` — wrapper over `supabase.functions.invoke` |
| `src/modules/story/lookupVocabulary.js` | Client-side JMdict lookup for clicked words — two-stage `dictionary` table query (primary_form, then kana_forms overlap), returns `vocabulary_ja`-shaped entries keyed by surface form |
| `src/components/JapaneseReader.jsx` | **Shared** `TokenizedBody` + `WordPopup` — extracted from ImmersionReader; both Immersion and Story use them (furigana toggle, clickable words, dictionary popup, Add to SRS) |
| `src/utils/vocabMap.js` | Shared `buildVocabMap(vocabulary)` (kept out of the .jsx to satisfy react-refresh lint) |
| `src/modules/story/StoryLayouts.jsx` | Format-specific reading layouts — `NewspaperLayout` (paper card, mincho serif, 2-column desktop / 1-column mobile; promoted to `src/components/NewspaperLayout.jsx` — see the Style Guide's component list and the Immersion module, which reuses it for real news articles — this file re-exports it so `StoryReviewPage`'s import is unchanged), `ChatLayout` (LINE-style bubbles with avatars; narration lines render as centered pills; body text uses a system sans-serif stack, not the app's pixel font — see below), `DiaryLayout` (notebook-lined page; splits the date-line header from the entry body), `InterviewLayout` (printed Q&A column reusing `parseDialogue`, colored left-border per speaker instead of bubbles), `LetterLayout` (cream card, mincho serif, no stamp), `PostcardLayout` (portrait card, CSS-perforated stamp, 7-box postal code grid, vertical `writing-mode: vertical-rl` message area — see below) |
| `src/modules/story/parseDialogue.js` | Splits the flat token stream into 名前「セリフ」 speaker lines, preserving global token indices so popup/highlight indexing stays correct across bubbles |
| `src/modules/story/parseDialogue.test.js` | Vitest unit tests for the dialogue parser |
| `supabase/functions/story-generate/index.ts` | Edge function — story generation (default model `claude-sonnet-5`, override via `STORY_MODEL` secret or request `model`) |

### learnerContext contract

- `sourceType: 'vocab-list'` — `sourceId` is a `WORD_SOURCES` source id (expands to all sublists) or a single listKey. Reads bundled word JSON.
- `sourceType: 'srs-deck'` — `sourceId` is a deckId. Caller must pass `options.cards` as **resolved** cards (run bundled cards through `resolveCard` first — scheduling-only state has no front/back). Options: `maturity: 'all' | 'seen' | 'graduated'`, `minStabilityDays`.
- `options.grammarLevel` ('N5'–'N1', default 'N3') appends a grammar directive line; `null` omits it.
- Output is dense one-word-per-line text (`魚 (さかな) — fish`) to control prompt token cost. The Keigo bundled deck has no kana field, so SRS-sourced lines are `front — back`.

### Edge functions

The Anthropic API key never reaches the client — all calls go through Supabase Edge Functions. The learner-context system block carries `cache_control: {type: 'ephemeral'}` so repeated generations in a session reuse the prompt cache (very small word lists may fall below the minimum cacheable prefix and silently not cache — harmless). Structured output via `output_config.format` json_schema — responses are parsed JSON, never prose.

**Every function that spends money must call `requireUser(req)` first** (`supabase/functions/_shared/auth.ts`). The platform's `verify_jwt` is *not* an identity check: the anon key is itself a valid project JWT and ships in every browser bundle, so it clears the gateway and reaches the function body. `requireUser` resolves the bearer token to a real user via `auth.getUser()` and throws an `AuthError` otherwise; pair it with `authErrorResponse(err, jsonResponse)` in the function's `catch` so the rejection keeps that function's own error contract. In `story-generate` the call must stay **ahead of the ReadableStream** — once the stream opens the response is committed to `200 text/plain` and a real status code is no longer possible. This helper is deliberately shared rather than duplicated per function (the norm for the tokenizer setup below): an auth check that drifts between copies is worse than no check at all. Applied to `story-generate`, `word-import`, `user-api-key`, `delete-account`. The four `anime-*` functions work signed out by design and are rate-limited instead — see below.

### AI usage quotas

Requiring an account is **not** a cost control — once signups are open, an account is free and instant. `supabase/functions/_shared/quota.ts` is what actually caps the Anthropic bill: `consumeQuota(userId, feature)` before the model call, `refundQuota` if the work then fails, `quotaErrorResponse` in the `catch` (chain it after `authErrorResponse` with `??`). In `story-generate` the consume call has the same constraint as `requireUser` — it must precede the `ReadableStream`, or a 429 can't be expressed.

`DAILY_LIMITS` is keyed by **unit of cost, not function name**: `story-generate` (5/day), `word-import-image` (10/day), plus a server-only `key-validation` (10/day) bucket. Per-feature rather than one shared pool because features differ in cost by more than an order of magnitude, and a single counter would let the expensive one silently eat the cheap one's budget. `word-import`'s **text** mode makes no Anthropic call and is deliberately absent from the table, so it is free.

`story-generate` and `word-import`'s OCR refund on failure, because losing one of five daily generations to a server error is the difference between a limit and a punishment.

```sql
create table if not exists ai_usage (
  user_id uuid references auth.users on delete cascade not null,
  feature text not null,   -- a key of DAILY_LIMITS
  day date not null,       -- UTC
  count integer not null default 0,
  primary key (user_id, feature, day)
);

alter table ai_usage enable row level security;
create policy "read own usage" on ai_usage for select using (auth.uid() = user_id);
grant select on ai_usage to authenticated;
grant all on ai_usage to service_role;

-- Increment and check in ONE statement. A read-then-write pair would let two
-- concurrent requests both observe "under the limit" and both proceed.
-- Returns the new count, or NULL when the user is already at the limit.
create or replace function consume_ai_quota(p_user uuid, p_feature text, p_limit int)
returns int language sql as $$
  insert into ai_usage (user_id, feature, day, count)
  values (p_user, p_feature, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, feature, day) do update
    set count = ai_usage.count + 1
    where ai_usage.count < p_limit
  returning count;
$$;

-- Counts without capping: the path for a user on their own key. They aren't
-- metered, but their usage is still shown back to them, and recording it here
-- means "today" and "lifetime" come from one table for everyone.
create or replace function record_ai_usage(p_user uuid, p_feature text)
returns int language sql as $$
  insert into ai_usage (user_id, feature, day, count)
  values (p_user, p_feature, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, feature, day) do update
    set count = ai_usage.count + 1
  returning count;
$$;

create or replace function refund_ai_quota(p_user uuid, p_feature text)
returns void language sql as $$
  update ai_usage set count = greatest(count - 1, 0)
  where user_id = p_user and feature = p_feature
    and day = (now() at time zone 'utc')::date;
$$;

-- REQUIRED, not tidiness: Postgres grants EXECUTE on new functions to PUBLIC
-- by default. Without this, any signed-in user could call refund_ai_quota over
-- PostgREST's /rpc/ endpoint and hand themselves unlimited usage.
revoke execute on function consume_ai_quota(uuid, text, int) from public, anon, authenticated;
revoke execute on function refund_ai_quota(uuid, text) from public, anon, authenticated;
revoke execute on function record_ai_usage(uuid, text) from public, anon, authenticated;
grant execute on function consume_ai_quota(uuid, text, int) to service_role;
grant execute on function refund_ai_quota(uuid, text) to service_role;
grant execute on function record_ai_usage(uuid, text) to service_role;
```

`ai_usage.user_id` cascades on delete, so account deletion needs no change to `delete-account` — unlike `progress` and `stories`, which don't cascade and must be deleted explicitly there. Prefer the cascade for any new user-scoped table.

### Bring your own API key

A user can supply their own Anthropic key, in which case they are **not metered**: `getUserApiKey(user.id)` (`supabase/functions/_shared/userKey.ts`) runs before `consumeQuota`, and a key present means the quota call — and its refund — are skipped entirely, with the key passed to `new Anthropic({ apiKey })` instead of the app's own. That branch is the whole integration; it is deliberately one `if` at each of the three call sites rather than a wrapper.

**The key is never readable by the client — including by its owner.** That is structural, not a promise: `user_api_keys` has RLS enabled and **no policy and no grant for `anon`/`authenticated` at all**, so PostgREST cannot return it to anybody. Every access goes through an edge function on the service role, and the only thing any response ever carries is `key_hint`, the last four characters. Don't add a select policy "for convenience" — there is no client-side use for the key.

It's also encrypted at rest on top of the platform's own encryption (AES-GCM, fresh IV per write, secret in `API_KEY_ENCRYPTION_SECRET`), so a leaked database dump alone doesn't yield working keys. A row that fails to decrypt — rotated secret, corruption — falls back to the app key and quota rather than failing the request. On save the key is checked against Anthropic's `/v1/models` (which costs no tokens) so a typo fails at the point of entry rather than silently breaking the next generation.

```sql
create table if not exists user_api_keys (
  user_id uuid primary key references auth.users on delete cascade,
  encrypted_key text not null,
  key_hint text not null,   -- last 4 chars; the only part ever returned
  created_at timestamptz not null default now()
);

alter table user_api_keys enable row level security;
-- No policy and no grant for anon/authenticated, deliberately: see above.
grant all on user_api_keys to service_role;
```

Needs `supabase secrets set API_KEY_ENCRYPTION_SECRET=...` (generate with `openssl rand -base64 32`). **Rotating that secret orphans every stored key** — users would silently fall back to the shared quota and have to re-enter theirs.

Client side, `useAiUsage()` (`src/hooks/useAiUsage.js`) returns today's counts keyed by feature, plus a `refresh` for callers that just spent quota. `AccountPage` lists every feature; `StoryModule` shows `QuotaPips` — one pip per daily generation, filled while unspent, coloured by the module accent — and **disables Generate at zero rather than letting the server 429**, so an exhausted quota reads as a visibly disabled button instead of a wasted round trip and a raw error. Both read `AI_DAILY_LIMITS` (`src/data/aiLimits.js`), the hand-synced mirror of the server's table; the server stays authoritative, so drift shows a wrong number rather than letting anyone past a limit.

### Rate limiting the anonymous anime endpoints

The four `anime-*` functions **work signed out on purpose** — only following a series and sending words to SRS need an account — so per-user quotas don't apply to them. What still needs bounding is that they proxy Jiten with *our* `JITEN_API_KEY`: unmetered, a scraper spends our private Jiten allowance (rate-limiting our own users, since an anonymous caller would otherwise only burn Jiten's shared pool) and our **Supabase invocation quota**, which is shared with every other function including the AI ones. That second one is the real reason this exists — sustained spam against an anime endpoint could degrade the whole app.

`enforceRateLimit(req, feature, { cost })` (`supabase/functions/_shared/rateLimit.ts`) applies **two windows, and neither substitutes for the other**: per-minute stops a burst or a runaway client loop; per-day stops the patient scraper who stays under the minute limit forever.

**Limits are denominated in Jiten requests, not in calls to us**, which is the only unit comparable to Jiten's own published numbers. One call fans out to a variable number of upstream requests, so counting invocations gave figures that looked safe and weren't — a cap of "10 syncs a minute" is really up to 100 upstream requests a minute against an endpoint Jiten caps at ~10/min anonymously. Each call declares its `cost`: `anime-lookup` charges `externalIds.length` (one upstream request per id, issued in parallel, and the array is capped at `MAX_LOOKUP_IDS` since otherwise one request becomes arbitrarily many), `anime-vocab-sync` charges `VOCAB_SYNC_COST` as a worst-case page count, and the rest charge 1.

**`anime-browse` gets the tightest limit, which is the opposite of what raw fan-out suggests.** It is a live, uncached search that fires as the user types, and the only one of the four whose load grows with the number of users. `anime-vocab-sync` looks alarming — 200-row pages, 10+ upstream calls — but is idempotent: it early-returns on `episode.synced_at`, so an episode is fetched from Jiten **exactly once ever, across all users**, and repeat requests cost nothing upstream. Caching, not rate limiting, is what keeps total Jiten traffic flat as the user base grows.

**Jiten's actual limits**, read from their source (`Jiten.Api/Program.cs`, [github.com/Sirush/Jiten](https://github.com/Sirush/Jiten)) rather than inferred: named ASP.NET policies, all 60-second windows. `fixed` = **300/min** and covers **every endpoint we call** (`get-media-decks`, `{id}/detail`, `{id}/vocabulary`). `download` = 10/min and covers deck downloads, frequency lists and the custom-deck parser — **none of which we call**. `heavy` = 20/min anonymous, 45 keyed, for search-by-description and example sentences — also not ours.

**Correcting a belief that was wrong here for a long time:** this codebase recorded "~10 req/min for the vocabulary endpoint". That was the `download` policy misattributed. Vocabulary inherits `fixed` at 300/min, so the real ceiling is 30× what was assumed.

**`JITEN_API_KEY` is not set**, and the functions only attach `X-Api-Key` when it is. That matters less for the *number* than for the *partition*: Jiten keys its buckets on `user:{userId}` when a key or JWT is present and `ip:{clientIp}` otherwise, and `fixed` is 300/min either way. So today **every one of our users shares one partition keyed on Supabase's egress IP** — possibly alongside unrelated Supabase tenants on the same address. A key buys an isolated partition, which for a server-side proxy is worth considerably more than a larger number would be.

**What the limiter achieves and what it doesn't.** It stops one caller monopolising the allowance, and the per-user numbers are a fraction of 300 so no single user can drain it. It does **not** bound the total, because Jiten meters our egress rather than our users. A global ceiling is the only mechanism that would. Mitigating that today: sync is idempotent (each episode fetched once ever), and a Jiten 429 surfaces as a clean error — note its body is `text/plain`, not JSON, and every call site checks the status before parsing. Small overshoots **queue rather than reject**, so the symptom is a request hanging for up to a minute rather than a visible error.

The bucket is `user:<id>` when signed in, otherwise `ip:<salted hash>`. **The hash is salted deliberately:** an unsalted hash of an IPv4 is trivially reversible, so it would still be personal data — salting with a secret the database never sees keeps the stored value non-identifying, which is also why PRIVACY.md doesn't have to claim we store IP addresses. The salt is derived from `API_KEY_ENCRYPTION_SECRET` with a purpose string rather than reusing it directly.

**It fails open.** If the limiter itself errors, the request proceeds — anime browsing staying up matters more than protecting a third-party rate limit. That also means deploying before the SQL below exists is safe; it simply doesn't limit yet.

```sql
create table if not exists rate_limit (
  bucket text not null,       -- 'user:<uuid>' or 'ip:<salted hash>'
  feature text not null,
  window_key text not null,   -- 'min:2026-09-05T18:32' | 'day:2026-09-05'
  count integer not null default 0,
  expires_at timestamptz not null,
  primary key (bucket, feature, window_key)
);
create index if not exists rate_limit_expires_idx on rate_limit (expires_at);

alter table rate_limit enable row level security;
-- No policy and no grant for anon/authenticated: only edge functions touch it.
grant all on rate_limit to service_role;

-- Increment and check in one statement, same reason as consume_ai_quota.
-- Returns the new count, or NULL when that window is already full.
create or replace function consume_rate_limit(
  p_bucket text, p_feature text, p_window_key text,
  p_limit int, p_cost int, p_expires timestamptz
) returns int language plpgsql as $$
declare v_count int;
begin
  -- A single call whose cost exceeds the whole window can never fit, and
  -- without this the first insert would let it through.
  if p_cost > p_limit then return null; end if;

  -- Opportunistic cleanup, scoped to this bucket so it stays cheap.
  delete from rate_limit where bucket = p_bucket and expires_at < now();

  insert into rate_limit (bucket, feature, window_key, count, expires_at)
  values (p_bucket, p_feature, p_window_key, p_cost, p_expires)
  on conflict (bucket, feature, window_key) do update
    set count = rate_limit.count + p_cost
    where rate_limit.count + p_cost <= p_limit
  returning count into v_count;

  return v_count;
end $$;

revoke execute on function consume_rate_limit(text, text, text, int, int, timestamptz) from public, anon, authenticated;
grant execute on function consume_rate_limit(text, text, text, int, int, timestamptz) to service_role;

-- Releases a reserved unit when the work that took it failed. Unconditional
-- arithmetic, so unlike consume_rate_limit it needs no atomicity guard; the
-- greatest() floor stops a double refund pushing the counter negative.
create or replace function refund_rate_limit(
  p_bucket text, p_feature text, p_window_key text, p_cost int
) returns void language sql as $$
  update rate_limit set count = greatest(0, count - p_cost)
  where bucket = p_bucket and feature = p_feature and window_key = p_window_key;
$$;

revoke execute on function refund_rate_limit(text, text, text, int) from public, anon, authenticated;
grant execute on function refund_rate_limit(text, text, text, int) to service_role;
```

### App-wide AI ceiling (`bucket = 'global'`)

Per-user quotas bound what one person can spend; nothing bounded the *sum*, so N users × 5 stories was unbounded in N. `GLOBAL_DAILY_LIMITS` in `_shared/quota.ts` adds a ceiling across all users combined, reusing the `rate_limit` table above with the bucket literal `'global'` rather than introducing a second mechanism. The spend limit set on the Anthropic key itself is the backstop *behind* this — the difference is that hitting the app's ceiling produces "AI generation is temporarily unavailable", whereas hitting Anthropic's produces a raw provider error.

`consumeAiBudget(userId, feature, ownKey)` is the single entry point and encodes the ordering, which is easy to get wrong in a way nothing surfaces: **charge the user first, then the global pool, refunding the user if the pool is full.** The other order charges the app for a request the user's own limit then rejects. A user on their own key skips the ceiling entirely — they aren't spending the app's budget — and only has their usage recorded. `refundAiBudget` is the matching release for a generation that fails after being charged.

**The banner.** `rate_limit` is service_role-only and must stay that way, so the client can't read the counters directly. `ai_availability()` is the one narrow read-only window: today's global counters plus whether the caller is on their own key. It deliberately returns **raw counts, not a ready-made boolean**, so the limits themselves stay out of SQL — there are two copies to keep in step (`GLOBAL_DAILY_LIMITS` server-side, `GLOBAL_AI_DAILY_LIMITS` in `src/data/aiLimits.js`) rather than three. `useAiAvailability(feature)` compares them and **fails open**, returning available on any error, missing function, or signed-out visitor, matching the edge function's own fail-open behaviour so the two can't disagree in the direction that blocks someone unnecessarily.

```sql
create or replace function ai_availability()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'usage', coalesce((
      select jsonb_object_agg(feature, count)
      from rate_limit
      where bucket = 'global'
        and window_key = 'day:' || to_char(timezone('utc', now())::date, 'YYYY-MM-DD')
    ), '{}'::jsonb),
    -- Only ever a boolean about the caller's own row, keyed on auth.uid().
    'ownKey', auth.uid() is not null
              and exists (select 1 from user_api_keys where user_id = auth.uid())
  );
$$;

-- EXECUTE defaults to PUBLIC, so this revoke is not redundant.
revoke execute on function ai_availability() from public;
grant execute on function ai_availability() to anon, authenticated;
```

Deploy (one-time setup):

```
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <project-ref>   # ref is in the Supabase dashboard URL
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy story-generate word-import
```

Generation response shape: `{ title, story, tokens, questions: [{ id, question, correct_answer, acceptable_variations }] }`. Grading: `{ pass, feedback }` — questions and answers are in Japanese; feedback is English.

Generation is **streamed** server-side (`client.messages.stream` + `finalMessage`) with `max_tokens: 16000` and `output_config.effort: 'medium'`. The model outputs only `{ title, story, questions }` (~900 output tokens, ~20s wall clock); the tokens array is built server-side with Kuromoji, NOT by the model — an earlier version had the model emit it, which ballooned output to ~16k tokens and ~130s per generation. Do not add `tokens` back to STORY_SCHEMA.

**Kuromoji in the edge function:** `npm:@patdx/kuromoji` (ESM fork with a fetch-based custom loader) reading uncompressed dictionary files from jsDelivr (`@aiktb/kuromoji@1.0.2/dict/`, ~18 MB) at cold start, cached per warm instance. The tokenizer build starts before the Claude call, so the dictionary download overlaps generation and adds no latency. The token mapping mirrors `tokenizeTextRich` in `scripts/fetch-nhk.mjs`, except `r` is set only for tokens containing kanji (no redundant furigana over kana-only words) and `b` is null for w:false tokens. Tokenization failure is non-fatal: `tokens` comes back null and the reader falls back to a plain text block.

**story-generate response is a heartbeat stream, not plain JSON.** The edge gateway kills any request that sends no bytes for 150s (IDLE_TIMEOUT), so the function returns `text/plain` and streams a space every 10s while Claude works, then the JSON payload as the final line. Typical generations now finish in ~20-40s, but the heartbeat stays as insurance. Consequences: HTTP status is 200 even for post-header failures (errors arrive as `{ error }` in the payload), and `generateStory()` in `api.js` trims the heartbeats and parses the text — keep both sides in sync if the wire format changes.

`tokens` is Kuromoji segmentation: `[{ t, r, w, b }]` — surface, hiragana reading (kanji tokens only, else null), content-word flag, and dictionary base form (e.g. 向かいました → 向かう; null for w:false). Newlines are their own tokens (required by `parseDialogue`). Concatenated `t` values reproduce `story` exactly. The reader renders tokens through the shared `TokenizedBody` (now themeable: `vocabHighlight`, `hoverBg`, `rtColor` props — needed for the light newspaper background); clicking a word looks up its base form via `lookupVocabulary` and shows the JMdict gloss in `WordPopup`. The reading layout switches on the generation format: `news` → NewspaperLayout, `dialogue` → ChatLayout, anything else (or missing tokens) → plain text block. Hover/focus styles for Story buttons, fields, and recent-story cards live in `global.css` (`.story-btn`, `.story-field`, `.story-recent-card`) per the no-useState-hover rule. "Add to SRS" writes to a `story-words` imported deck in the vocab-srs namespace (second cross-module write, same pattern as immersion-words).

### Story settings (localStorage)

`story-source`, `story-maturity`, `story-grammar`, `story-format` — note `safeLocalStorageGet(key)` takes no fallback argument; use `?? default`.
