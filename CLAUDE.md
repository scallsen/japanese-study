# Codebase guide

Japanese study dashboard. Vite + React, no TypeScript. Houses multiple learning modules behind a single landing page.

## Conventions
- **Inline styles only** — no CSS modules, no Tailwind. CSS files only for things that can't be expressed inline (e.g. keyframe animations, scrollbar styles).
- **No comments** unless the WHY is non-obvious (a hidden constraint, a workaround, a subtle invariant).
- **No TypeScript** — plain JS throughout.
- **No i18n** — all strings hardcoded in English.
- **No Japanese text in the UI** — labels, buttons, headings, and all other UI strings must be in English. Japanese text belongs only in word/card data (e.g. `kanji`, `kana`, `front` fields).
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
```

### Layout
Identical to katsuyou-drill DrillPage:
- Desktop: main content area + chevron toggle + collapsible sidebar (420px wide)
- Mobile: full-screen overlay triggered by "Show options" button in header
- `useIsMobile(768)` and `useIsShort(680)` hooks for responsive breakpoints

## Vocab SRS (`#/vocab-srs`)

Anki-style spaced repetition using [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs). **Sign-in required** — the module renders a sign-in gate when the user is logged out; progress is never written to localStorage for this module.

### Key files

| File | Purpose |
|---|---|
| `src/modules/vocab-srs/srs.js` | FSRS functions: `createCard`, `createBundledCardState`, `reviewCard`, `resolveCard`, `getTodaysQueue`, `getDeckStats`, `getGlobalStats` |
| `src/modules/vocab-srs/migrate.js` | `migrateProgress(raw)` — shape migration; `initializeDeckCards(progress, deckId)` — first-activation setup |
| `src/modules/vocab-srs/import.js` | `parseAnkiExport(tsvString, existingIds)` — Anki plain-text export parser |
| `src/modules/vocab-srs/session.js` | In-session queue: `initSession`, `answerCard`, `isComplete`, `getSessionStats` |
| `src/modules/vocab-srs/VocabSrsModule.jsx` | Home screen + sidebar: deck management, stats, import, Start Review |
| `src/modules/vocab-srs/VocabSrsDrill.jsx` | Drill UI — flip card, Again/Good buttons, session complete screen |
| `src/modules/vocab-srs/config.js` | Dashboard module config entry |
| `src/modules/vocab-srs/decks/core3k.json` | Bundled deck — 30 N5-N4 everyday words |
| `src/modules/vocab-srs/decks/keigo.json` | Bundled deck — 30 keigo/formal-register words |

### Deck architecture

Cards come from two sources:

**Bundled decks** — static JSON files in `decks/`. Content (front/back) lives in the JSON; only FSRS scheduling state is persisted to storage. New bundled decks start with no card entries in storage; entries are created on first activation via `initializeDeckCards`.

**Imported decks** — created from Anki TSV exports. Content (front/back) is stored inline on each card object in storage.

Both sources write to the same `cards{}` object, distinguished by `deckId`.

### Card content resolution (`resolveCard`)

Before a session starts, every card state is resolved to include `front` and `back`:

```js
resolveCard(cardState)
// → { ...cardState, front, back }
```

Bundled cards look up `front`/`back` from the static JSON via `DECK_FILES[deckId].get(cardId)`. Imported cards already carry `front`/`back` inline and are returned as-is.

The drill (VocabSrsDrill) always receives resolved cards — it never calls `resolveCard` itself.

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
      // imported decks only — bundled decks read content from static JSON:
      front?: string,
      back?: string,
      // FSRS scheduling fields (stability, difficulty, due, state, …):
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

`migrateProgress(raw)` transparently converts old-shape data (`cards` array) to this shape on first load. `initializeDeckCards(progress, deckId)` populates card entries for a bundled deck when it is first activated.

`newCardDay` is missing from old data — always access as `progress.newCardDay ?? { date: '', count: 0 }`.

### FSRS setup

- `fsrs(generatorParameters({ enable_fuzz: true }))` — only Again (1) and Good (3) ratings used.
- `f.next(card, new Date(), rating)` returns `{ card, log }` — spread `result.card` onto the original to preserve custom fields.

### Daily new card limit

`dailyNewCards` (localStorage key `srs-daily-new-cards`, default 10) caps how many new cards can be introduced per calendar day. The effective limit is computed in `VocabSrsModule`:

```js
const todayStr = new Date().toISOString().split('T')[0]  // YYYY-MM-DD UTC
const newCardsIntroducedToday = newCardDay.date === todayStr ? newCardDay.count : 0
const effectiveNewPerDay = Math.max(0, dailyNewCards - newCardsIntroducedToday)
```

When a session starts, `newCardDay` is updated immediately: `{ date: todayStr, count: prevCount + n.length }`. This deducts the session's new card count from today's budget before the drill begins.

On a new calendar day `newCardDay.date` won't match `todayStr`, so the full `dailyNewCards` allocation is available again.

If `dailyNewCards` changes mid-day: raising it makes more new cards available (up to the remaining backlog); lowering it below the already-introduced count sets `effectiveNewPerDay = 0` for the rest of the day.

### Session flow

1. Compute `effectiveNewPerDay = max(0, dailyNewCards - newCardsIntroducedToday)`.
2. `getTodaysQueue(cardsObj, decks, { newPerDay: effectiveNewPerDay })` returns `{ due, newCards, rescheduled }`:
   - `due` — cards with `dueDate <= now` and ≤ 7 days overdue
   - `newCards` — State.New cards, sliced to `effectiveNewPerDay`
   - `rescheduled` — cards > 7 days overdue, with `due` reset to now
3. `canStart = due.length > 0 || newCards.length > 0 || rescheduled.length > 0`. Rescheduled cards are included — without this, advancing many days (pushing cards > 7 days overdue) would incorrectly show "Nothing due".
4. On "Start review": `newCardDay` is saved with the updated count; rescheduled cards are merged into `due` for the session and their updated due dates saved; all cards resolved via `resolveCard`.
5. `initSession(resolvedDue, resolvedNewCards)` creates `{ queue, completed, startTime, initialCount, againCount, goodCount }`.
6. `answerCard(session, card, Rating.Again)` — re-inserts at `Math.min(queue.length, 3)`. `Rating.Good` — moves to `completed`.
7. Session ends when `queue.length === 0`.
8. On save, the drill returns an array of resolved session cards; the module strips `front`/`back` for bundled cards before merging back into `cards{}`.

### Dev advance feature (DEV only)

Visible in the settings sidebar when `import.meta.env.DEV` and cards exist. "Advance N days" shifts all card `due` dates back by N days (simulating time passing) **and** resets `newCardDay: { date: '', count: 0 }` to grant a fresh daily new card allocation. Each click is cumulative. Rescheduled-card inclusion in sessions means advancing arbitrarily many days still surfaces all due cards correctly.
