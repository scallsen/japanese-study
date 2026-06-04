# Codebase guide

Japanese study dashboard. Vite + React, no TypeScript. Houses multiple learning modules behind a single landing page.

## Conventions
- **Inline styles only** — no CSS modules, no Tailwind. CSS files only for things that can't be expressed inline (e.g. keyframe animations, scrollbar styles).
- **No comments** unless the WHY is non-obvious (a hidden constraint, a workaround, a subtle invariant).
- **No TypeScript** — plain JS throughout.
- **No i18n** — all strings hardcoded in English.
- Hash-based routing — `window.location.hash` read in `App.jsx`. No third-party router.

## Routing

`App.jsx` reads `window.location.hash` and renders the matching page component. Current routes:

| Hash | Page |
|---|---|
| `#/` (or empty) | `DashboardPage` |
| `#/vocab` | `VocabPage` — vocabulary flashcard drill |

To add a route: add a branch in `App.jsx` and create the page under `src/pages/`.

## Module config shape

Each entry in `src/data/modules.js`:

```js
{
  id: string,        // unique stable key
  label: string,     // display name shown on card
  sublabel: string,  // subtitle shown below label
  stats: null,       // reserved, currently unused
  href: string,      // hash path ('#/vocab') or full URL for external modules
  external: boolean, // true → opens in new tab; false → hash navigation
  accent: string,    // CSS color string (currently unused in card design)
}
```

## Adding a module
1. Add an entry to `src/data/modules.js`.
2. If the module is a new internal page, add the route to `App.jsx` and create `src/pages/YourPage.jsx`.

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
| `src/components/VocabCard.jsx` | Flip card — front (kanji) / back (kanji + furigana + English + optional sentence) |
| `src/FlipCard.jsx` + `src/FlipCard.css` | 3D flip animation (ported from katsuyou-drill) |
| `src/components/DrillHUD.jsx` | Streak display + undo + score |
| `src/components/SpeedModeControls.jsx` | Incorrect [Z] / Correct [X] verdict buttons |
| `src/components/SelectButton.jsx` | Toggle button used in settings (word list selection) |
| `src/components/DrawerSectionHeader.jsx` | Section label in settings panel |
| `src/components/DrawerCheckbox.jsx` | Checkbox setting row |
| `src/components/DrawerSelect.jsx` | Dropdown setting row (TTS voice) |
| `src/hooks/useDrill.js` | Drill state machine hook |
| `src/hooks/useTTS.js` | Browser Speech Synthesis TTS |
| `src/hooks/useSFX.js` | Web Audio API sound effects (no asset files) |
| `src/engines/simpleQueue.js` | Card queue engine — wrong cards reinsert after 3 |
| `src/utils/furigana.js` | `buildFurigana(kanji, kana)` → decomposed furigana parts |
| `src/utils/storage.js` | Safe localStorage get/set wrappers |
| `src/data/wordLists.js` | Word source/list metadata: `WORD_SOURCES` array |
| `src/data/words/sample.json` | Placeholder word data |
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

**UI behavior:** Flat sources render as a single SelectButton toggle. Hierarchical sources render as a collapsible accordion — click to expand and select individual sublists. A "N/M selected" count badge shows when the source is collapsed.

### Word data format

Each word object in a `src/data/words/*.json` file:

```js
{
  "id": "nsm-n3-w1d1-001",  // unique stable key — suggest "{listKey}-{index}"
  "kanji": "魚",              // display form (front of card); use kana if no kanji form
  "kana": "さかな",           // full hiragana/katakana reading — spoken by TTS on flip
  "english": "fish",          // meaning — shown on back of card (concise, 1–5 words)
  "sentence": "...",          // optional example sentence — shown on back when "Show sentence" is on
  "listKey": "nsm-n3-w1d1"   // must match a source id (flat) or sublist id (hierarchical)
}
```

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
All VocabPage settings are stored in localStorage with `vocab-` prefix (e.g. `vocab-show-furigana`) to avoid colliding with katsuyou-drill's keys.

## Auth

GitHub OAuth via Supabase. The auth layer is intentionally thin — no login page, no modal. The sign-in button in the dashboard header triggers the OAuth redirect directly.

| File | Purpose |
|---|---|
| `src/lib/supabase.js` | Supabase client (reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) |
| `src/context/AuthContext.jsx` | `AuthProvider` + `useAuth()` — exposes `{ user, signIn, signOut, loading }` |
| `src/hooks/useProgress.js` | `useProgress(namespace)` — storage-agnostic progress hook (see below) |

`AuthProvider` wraps the entire app in `main.jsx`. `loading` is true until the initial session resolves; the header auth slot renders nothing during this window to avoid a flash.

### useProgress hook

```js
const { data, save, loading } = useProgress('my-module-namespace')
```

- **Logged in**: reads and writes to the Supabase `progress` table, one row per `(user_id, namespace)`.
- **Logged out**: reads and writes to `localStorage` under the key `progress-{namespace}`.
- `data` is the stored payload (any JSON-serialisable value), or `null` if nothing saved yet.
- `save(payload)` upserts the full payload and optimistically updates local state.

Supabase table: `progress(id uuid pk, user_id uuid → auth.users, namespace text, payload jsonb, updated_at timestamp)` with a unique constraint on `(user_id, namespace)` and RLS limiting each user to their own rows.

### Layout
Identical to katsuyou-drill DrillPage:
- Desktop: main content area + chevron toggle + collapsible sidebar (420px wide)
- Mobile: full-screen overlay triggered by "Show options" button in header
- `useIsMobile(768)` and `useIsShort(680)` hooks for responsive breakpoints
