# Lantern - Drill and memorize Japanese vocabulary


<img width="1123" height="758" alt="Screenshot 2026-09-10 at 10 07 10 PM" src="https://github.com/user-attachments/assets/309ef299-6b03-4c6b-99f1-04fcf0dc93d1" />

Lantern helps you memorize vocabulary alongside your Japanese studies. Drill words from your study material of choice until you can recall them – then move to a review deck for long term retention.

Explore supporting tools to find new vocabulary from anime or the news, or generate stories using a set of words to see them in context.

🏮 Live at [lantern.study](https://lantern.study) 

## Features

### Core 

| Feature | Route | What it does |
|---|---|---|
| Practice | `#/vocab` | Flashcard drill for fixed word lists (textbook vocab, JLPT lists) |
| Review | `#/vocab-srs` | Long-term spaced repetition (FSRS) — the shared review queue every other feature feeds into. Requires an account. |

### Tools

| Feature | Route | What it does |
|---|---|---|
| Anime vocabulary | `#/anime-vocab` | Look up a show, browse per-episode vocabulary (via Jiten.moe), drill it with JLPT difficulty filtering, track what you're watching |
| Story generator | `#/story` | Generates original stories, dialogues, and other formats constrained to vocabulary you actually know, with comprehension questions |
| News reader | `#/immersion` | Daily Japanese news, rewritten to a lower reading level, with clickable word definitions and one-click "add to SRS" |
| Dictionary | `#/dictionary` | JMdict + KANJIDIC2-backed word and kanji lookup — the definition source every other feature reads from |
| Conjugation Drill | external | Verb/adjective conjugation drilling, via [Katsuyou Drill](https://scallsen.github.io/katsuyou-drill/) |

## How it fits together

- **The dictionary is authoritative.** Any word or card with a `jmdictId` shows its definition, readings, and (via KANJIDIC2) per-kanji meanings live from the `dictionary`/`kanji` tables — never a static copy. Static JSON text is only a fallback for entries that predate or fail dictionary matching.
- **Everything feeds the SRS.** Anime vocabulary, Story generator, and News reader all write into the same Vocab SRS progress — click a word while reading, drill it later. Each source gets its own deck, so you can tell where a card came from without losing the shared review schedule.
- **Real example sentences, not made-up ones.** Cards can surface Tanaka Corpus sentences matched to the word instead of (or alongside) a hand-written one.
- **Audio is pre-generated, not synthesized on the fly.** Vocab and SRS decks use neural TTS (Voicevox) generated ahead of time, rather than leaning on inconsistent browser Speech Synthesis.

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) — no TypeScript, no CSS framework (inline styles throughout)
- [Supabase](https://supabase.com/) — auth (GitHub OAuth), Postgres (progress, dictionary, kanji, articles, stories), Storage (audio), and Edge Functions (story generation/grading, word import)
- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) — spaced repetition scheduling
- [Voicevox](https://voicevox.hiroshiba.jp/) — pre-generated Japanese TTS audio for vocab/SRS decks
- Claude (via Supabase Edge Functions) — news rewriting, story generation/grading, OCR-based word import
- Hash-based routing, no router library

## Data sources & attribution

- [JMdict/EDICT](https://www.edrdg.org/jmdict/j_jmdict.html) and [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) — dictionary and kanji data (EDRDG, CC BY-SA)
- [Tanaka Corpus](https://edrdg.org/wiki/index.php/Tanaka_Corpus) — example sentences (EDRDG, CC BY)
- [yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab) — community-estimated JLPT level tagging (CC BY-SA 4.0)
- [Voicevox](https://voicevox.hiroshiba.jp/) — text-to-speech voices (四国めたん, 玄野武宏)

In-app attribution is shown on every screen that renders text or audio from these sources.
