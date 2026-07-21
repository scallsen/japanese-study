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

## Shared components (`src/components/`)

Used by multiple modules/pages:

| Component | Usage |
|---|---|
| `PageHeader.jsx` | Breadcrumb header — all pages |
| `AuthSlot.jsx` | Sign in / sign out control — dashboard header and module headers |
| `DrawerSectionHeader.jsx` | Section label in settings panels |
| `DrawerCheckbox.jsx` | Checkbox setting row |
| `DrawerSelect.jsx` | Dropdown setting row |
| `ModuleCard.jsx` | Dashboard module card |

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
| `src/components/SpeedModeControls.jsx` | Incorrect [Z] / Correct [X] verdict buttons (VocabPage-only) |
| `src/components/PageHeader.jsx` | Breadcrumb header |
| `src/components/SelectButton.jsx` | Toggle button used in settings (word list selection) |
| `src/components/DrawerSectionHeader.jsx` | Section label in settings panel |
| `src/components/DrawerCheckbox.jsx` | Checkbox setting row |
| `src/components/DrawerSelect.jsx` | Dropdown setting row (TTS voice) |
| `src/hooks/useDrill.js` | Drill state machine hook (VocabPage-only) |
| `src/hooks/useTTS.js` | Browser Speech Synthesis TTS — fallback when Voicevox audio isn't available |
| `src/hooks/useAudioGenerationStatus.js` | Polls the `audio_generation_status` row — drives the "Audio is being generated" note |
| `src/hooks/useSFX.js` | Web Audio API sound effects (no asset files) |
| `src/hooks/useGamepad.js` | Gamepad controller support (VocabPage-only) |
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
  "listKey": "nsm-n3-w1d1",  // must match a source id (flat) or sublist id (hierarchical)
  "voicevoxVoices": [2, 11]  // set by scripts/generate-audio.mjs — speaker ids with generated audio; absent/empty until generated
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

**Attribution**: Voicevox's license requires a discoverable text credit for each character voice used. Each voice's credit string (`VOICEVOX:四国めたん` / `VOICEVOX:玄野武宏`, in `VOICEVOX_VOICES` in `src/utils/voicevoxAudio.js`) is shown directly below the "Audio source" picker only while that voice is the selected option (`getVoicevoxCredit(audioSource)`) — hidden entirely when "Browser TTS" is selected.

**Playback priority** (both Vocab drill and Vocab SRS): recorded file audio (Core 2000's Anki audio, SRS-only) → Voicevox audio for the selected voice, if generated → browser TTS. The audio-source picker (`AUDIO_SOURCE_OPTIONS` in `src/utils/voicevoxAudio.js`) offers "Voicevox — Shikoku Metan (female)", "Voicevox — Kurono Takehiro (male)", and "Browser TTS"; picking a Voicevox voice still silently falls back to browser TTS for any entry that voice hasn't been generated for yet.

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
| `src/modules/vocab-srs/VocabSrsModule.jsx` | Home screen + sidebar: deck management, stats, settings, Start Review |
| `src/modules/vocab-srs/VocabSrsDrill.jsx` | Drill UI — FlipCard, rating buttons, audio, relearn countdown, session complete |
| `src/modules/vocab-srs/decks/core2000.json` | Bundled deck — 2007 Core 2000 cards with word + sentence audio |
| `src/modules/vocab-srs/decks/keigo.json` | Bundled deck — 30 keigo/formal-register words; audio generated via Voicevox (see Vocab audio section under Vocabulary Drill), no Anki recordings |
| `src/modules/vocab-srs/srs.test.js` | Vitest unit tests for srs.js |
| `src/modules/vocab-srs/session.test.js` | Vitest unit tests for session.js |
| `src/modules/vocab-srs/import.test.js` | Vitest unit tests for import.js |

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

**Imported decks** — created from Anki TSV exports. Content (front/back/audio/sentence fields) is stored inline on each card object in storage.

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

When a session starts, `newCardDay` is updated immediately before the drill renders.

### Session flow

1. Compute `effectiveNewPerDay = max(0, dailyNewCards - newCardsIntroducedToday)`.
2. `getTodaysQueue(cardsObj, decks, { newPerDay: effectiveNewPerDay })` returns `{ due, newCards, rescheduled }`.
3. `canStart = due.length > 0 || newCards.length > 0 || rescheduled.length > 0`. Rescheduled cards are included so advancing many days doesn't produce "Nothing due".
4. On "Start review": `newCardDay` saved with updated count; rescheduled cards merged into `due` (their updated due dates saved); all cards resolved via `resolveCard`.
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
| `srs-audio-source` | `'voicevox-2'` | Audio source picker — `'voicevox-2'` \| `'voicevox-11'` \| `'browser'`, see Vocab audio section |
| `srs-tts-voice` | `''` | Browser TTS voice name (used when audio source is `'browser'`) |
| `srs-sfx-enabled` | `true` | Sound effects (correct/wrong beeps) |
| `srs-show-furigana` | `true` | Show kana reading on card front; always shown on back |
| `srs-show-translation` | `true` | Show English translation on card back |
| `srs-show-sentence` | `true` | Show example sentence on card back |
| `srs-pixel-font` | `true` | Use DotGothic16 pixel font on cards |
| `srs-visual-effects` | `true` | Enable card visual effects |

### Dev advance feature (DEV only)

Visible in the settings sidebar when `import.meta.env.DEV` and cards exist. "Advance N days" shifts all card `due` dates back by N days and resets `newCardDay: { date: '', count: 0 }` to grant a fresh daily new card allocation. Each click is cumulative. Rescheduled-card inclusion in sessions means advancing arbitrarily many days still surfaces all due cards correctly.

## Immersion (`#/immersion`)

**Self-contained module** — all code under `src/modules/immersion/`. NHK-style Japanese reading articles generated nightly by a GitHub Actions pipeline.

### Key files

| File | Purpose |
|---|---|
| `src/modules/immersion/ImmersionModule.jsx` | Article list screen — fetches from Supabase, reading history |
| `src/modules/immersion/ImmersionReader.jsx` | Reader — tokenized body, word popup, furigana toggle, SRS bridge |
| `scripts/fetch-nhk.mjs` | Nightly pipeline — fetches Yahoo Japan RSS, generates articles via Claude Haiku, tokenizes with Kuromoji, looks up JMdict definitions |
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
  kana_forms   text[] not null default '{}',
  gloss_en     text,                   -- all English glosses joined with '; '
  pos          text[],                 -- partOfSpeech codes across all senses
  common       boolean not null default false
);
create index dictionary_primary_form_idx on dictionary (primary_form);
create index dictionary_kana_forms_gin   on dictionary using gin (kana_forms);
create index dictionary_common_idx       on dictionary (common);
grant select on dictionary to anon, authenticated;
grant all on dictionary to service_role;
```

Lookup in the pipeline uses a two-stage query: stage 1 matches `primary_form` against Kuromoji `basic_form`; stage 2 uses GIN array overlap on `kana_forms` for entries where the basic form is kana but the JMdict primary form is kanji (e.g. `ある` → `有る`).

### Word popup / definitions

Every content token (`w: true`) in `tokens_ja`/`tokens_simple` is clickable in the reader. Clicking shows a popup with the word, its reading, part of speech, and an English definition sourced from `vocabulary_ja`. Run `backfill-jmdict.mjs` to regenerate definitions for existing articles.

### Article retention

Articles accumulate indefinitely — there is no cleanup job. The reader fetches the 10 most recent (`limit(10)` ordered by `published_at desc`), so old articles are invisible to users but stay in the database. At ~5 articles/day × ~10 KB each (with JSONB tokens), growth is ~18 MB/year — well within Supabase free tier limits. If storage ever becomes a concern, add a post-upsert delete to `fetch-nhk.mjs` that removes rows beyond the newest N.

### `useProgress('immersion')` payload

```js
{ read: { [slug]: { readAt: ISO string, score: null } } }
```

### SRS bridge

`ImmersionReader` imports `createCard` from `../vocab-srs/srs.js` and writes directly to the `vocab-srs` progress namespace, appending words to an `immersion-words` imported deck (created on first add). This is the only cross-module write in the codebase.

## Dictionary (`#/dictionary`)

**Page-based** (`src/pages/DictionaryPage.jsx`). JMdict-backed dictionary with inline kanji lookup. Searches the Supabase `dictionary` table (JMdict) and the `kanji` table (KANJIDIC2).

### Key files

| File | Purpose |
|---|---|
| `src/pages/DictionaryPage.jsx` | Search UI, query logic, result rendering, kanji carousel |
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
| `src/modules/story/StoryLayouts.jsx` | Format-specific reading layouts — `NewspaperLayout` (paper card, mincho serif, 2-column desktop / 1-column mobile), `ChatLayout` (LINE-style bubbles with avatars; narration lines render as centered pills; body text uses a system sans-serif stack, not the app's pixel font — see below), `DiaryLayout` (notebook-lined page; splits the date-line header from the entry body), `InterviewLayout` (printed Q&A column reusing `parseDialogue`, colored left-border per speaker instead of bubbles), `LetterLayout` (cream card, mincho serif, no stamp), `PostcardLayout` (portrait card, CSS-perforated stamp, 7-box postal code grid, vertical `writing-mode: vertical-rl` message area — see below) |
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
