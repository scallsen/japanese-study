# Vocab audio generation

Pre-generates neural TTS audio for the vocab word lists and the `keigo` SRS deck via [Voicevox](https://voicevox.hiroshiba.jp/), replacing browser Speech Synthesis (variable quality, OS-dependent) as the primary audio source. Full documentation lives in `CLAUDE.md` under "Vocabulary Drill → Vocab audio (Voicevox)" — this file just covers running the script itself.

## Voices

- Speaker id `2` — 四国めたん (Shikoku Metan), Normal
- Speaker id `11` — 玄野武宏 (Kurono Takehiro), Normal

## Running locally

1. Install and launch [VOICEVOX](https://voicevox.hiroshiba.jp/) — it starts a REST API server on `localhost:50021`. Keep it running.
2. Ensure `ffmpeg` is installed (`brew install ffmpeg`).
3. Run:
   ```
   node --env-file=.env scripts/generate-audio.mjs
   ```

Env vars required: `SUPABASE_URL` (or `VITE_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`). `VOICEVOX_URL` defaults to `http://localhost:50021`.

## Running automatically

`.github/workflows/generate-vocab-audio.yml` runs this script on every push to `main` touching `src/data/words/**` or `src/modules/vocab-srs/decks/keigo.json`, or via manual `workflow_dispatch`. It spins up the official headless `voicevox/voicevox_engine` Docker image for the duration of the job — no persistent server needed. Generated audio filenames get committed straight back to `main`.

## What it does

1. Reads `src/data/words/*.json` and `keigo.json`.
2. For each entry missing a voice in its `voicevoxVoices` array, synthesizes audio (via `/audio_query` + `/synthesis`), converts WAV→MP3 with `ffmpeg`, and uploads to Supabase Storage at `audio/voicevox/<speakerId>/<entryId>.mp3`.
3. Writes the updated `voicevoxVoices` array back into the source JSON.
4. Reconciles each voice folder against current entries and deletes anything orphaned — removing a word/card from the JSON automatically prunes its stored audio on the next run.
5. Flips the single-row `audio_generation_status` Supabase table to `'processing'`/`'idle'` around the run, which the frontend polls to show an "Audio is being generated" note.

## One-time setup required (not automated)

- Create the `audio_generation_status` table (SQL in `CLAUDE.md`) via the Supabase SQL editor.
- Confirm the `audio` Storage bucket exists and is public (already required for the existing `audio/imported/` Anki audio).
- Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as repo secrets if not already present (the existing `fetch-articles.yml` workflow already relies on both).
