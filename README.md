# japanese-study

A personal Japanese study dashboard — a single-page app bundling several learning tools behind one landing page: vocabulary drills, spaced repetition, generated reading practice, a JMdict-backed dictionary, and a grammar dependency map.

## Modules

| Module | Route | What it does |
|---|---|---|
| Vocabulary Training | `#/vocab` | Speed-mode flashcard drill over configurable word lists, with Voicevox-generated Japanese audio |
| SRS | `#/vocab-srs` | Anki-style spaced repetition (FSRS algorithm) over a bundled Core 2000 deck, a Keigo deck, or your own imported Anki exports. Requires sign-in |
| Immersion | `#/immersion` | NHK-style news articles, regenerated nightly, with tap-to-define vocabulary and one-click "add to SRS" |
| Story generator | `#/story` | Generates original Japanese stories/dialogues/articles constrained to vocabulary you already know, with comprehension questions |
| Dictionary | `#/dictionary` | JMdict + KANJIDIC2-backed word and kanji lookup |
| Grammar Map (experimental) | `#/grammar-map` | Visualizes grammar point dependencies |
| Conjugation Drill | external | Links out to a separate hosted app |

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) — no TypeScript, no CSS framework (inline styles throughout)
- [Supabase](https://supabase.com/) — auth (GitHub OAuth), Postgres (progress, dictionary, kanji, articles, stories), Storage (audio), and Edge Functions (story generation/grading)
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) — spaced repetition scheduling
- [Voicevox](https://voicevox.hiroshiba.jp/) — pre-generated Japanese TTS audio for vocab/SRS decks
- Hash-based routing, no router library

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + anon key
npm run dev
```

Requires a Supabase project. See `CLAUDE.md` for the full database schema (tables: `progress`, `dictionary`, `kanji`, `articles`, `stories`, `audio_generation_status`) and setup notes for each module.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview a production build locally |
| `npm test` | Run the Vitest suite |
| `npm run lint` | ESLint |

Additional one-off/maintenance scripts live in `scripts/` (JMdict/KANJIDIC2 imports, nightly article fetching, Voicevox audio generation) — see `CLAUDE.md` for what each does and how to run it.

## Documentation

`CLAUDE.md` is the source of truth for architecture, conventions, module internals, and database schemas — read it before making non-trivial changes.
