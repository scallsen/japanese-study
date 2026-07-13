# Pre-generate vocab audio

Generate MP3 audio files for vocab word lists and upload them to Supabase Storage, matching the pattern already used by the Core 2000 deck.

## Goal

Replace browser Speech Synthesis (variable quality, OS-dependent) with pre-generated neural TTS audio stored in `audio/imported/` in Supabase Storage. Playback becomes instant static file serving with no runtime API calls.

## Chosen approach: Voicevox (local, free)

[Voicevox](https://voicevox.hiroshige.jp/) is a free open-source Japanese TTS engine. Run it locally while the script runs — no account, no credit card, no usage limits.

**Alternative: Azure Cognitive Services TTS** — free F0 tier (500k chars/month), requires an Azure account with credit card for identity verification. Use if Voicevox setup is a blocker.

## Setup (Voicevox)

1. Download and install [VOICEVOX](https://voicevox.hiroshige.jp/) for Mac/Windows/Linux.
2. Launch the app — it starts a REST API server on `localhost:50021`.
3. Keep it running while the script runs.

## What the script will do

1. Read all word JSON files under `src/data/words/`.
2. For each word missing a `wordAudio` field, call Voicevox with the word's `kana` value.
3. Save the returned WAV, convert to MP3 (via ffmpeg), and upload to Supabase Storage `audio/imported/`.
4. Write the returned filename back into the word object.
5. Overwrite the JSON file with updated word objects.

Word objects will gain a `wordAudio` field matching the shape used in `core2000.json`:

```js
{
  "id": "nsm-n3-w1d1-001",
  "kanji": "魚",
  "kana": "さかな",
  "english": "fish",
  "wordAudio": "abc123....mp3",   // ← added by script
  "listKey": "nsm-n3-w1d1"
}
```

## Playback integration

`VocabCard.jsx` and `useTTS.js` will need to check for `wordAudio` and construct the Supabase Storage URL (same pattern as `VocabSrsDrill.jsx`):

```js
const AUDIO_BASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/audio/imported`
// → `${AUDIO_BASE}/${word.wordAudio}`
```

Fall back to browser TTS if `wordAudio` is absent.

## Prerequisites

- Voicevox installed and running, OR Azure Speech resource key + region in `.env`
- `ffmpeg` installed (`brew install ffmpeg`)
- `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
