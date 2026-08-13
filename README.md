# japanese-study

My personal collection of tools to support my Japanese studies. Each module is kept separate, with integrations when relevant.  

## Modules

| Module | Route | What it does |
|---|---|---|
| Vocabulary Training | `#/vocab` | Flashcard drill for set word lists – like those from a textbook |
| SRS | `#/vocab-srs` | Longer term SRS using FSRS algorithm. Supports various word lists. Requires account. |
| Immersion | `#/immersion` | Daily news from the internet re-written for lower reading levels using Claude Haiku |
| Story generator | `#/story` | Generate original content using vocabulary from Vocabulary Training sets |
| Dictionary | `#/dictionary` | Source of truth for dictionary definitions across all modules. JMdict + KANJIDIC2-backed word and kanji lookup |
| Anime Vocab | `#/anime-vocab` | Look up an anime, browse its per-episode vocabulary (via Jiten.moe), and drill selected words with JLPT difficulty filtering. Track shows you're currently watching for quick access |
| Conjugation Drill | external | Drill grammar forms using an externally hosted tool [Katsuyou Drill](https://scallsen.github.io/katsuyou-drill/) |

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) — no TypeScript, no CSS framework (inline styles throughout)
- [Supabase](https://supabase.com/) — auth (GitHub OAuth), Postgres (progress, dictionary, kanji, articles, stories), Storage (audio), and Edge Functions (story generation/grading)
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) — spaced repetition scheduling
- [Voicevox](https://voicevox.hiroshiba.jp/) — pre-generated Japanese TTS audio for vocab/SRS decks
- Hash-based routing, no router library
