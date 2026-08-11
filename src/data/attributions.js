// Central registry of third-party data/asset credits shown around the app.
// Each entry is an array of text segments — { text } for plain text, or
// { text, href } for a clickable piece — rendered in sequence by
// renderAttributionSegments() (src/components/AttributionFooter.jsx).
// AttributionFooter renders a page-declared subset of these at the foot of a
// screen — each page/module lists which sources it actually uses (e.g.
// sources={['dictionary']}). Contextual credits whose wording depends on a
// specific active selection (e.g. which Voicevox voice is currently picked)
// render inline next to the control they explain instead of in the footer,
// but still pull their segments from here (see VOICEVOX_VOICES in
// utils/voicevoxAudio.js) so there's one place to look up or edit every
// credit in the app.
//
// EDRDG (JMdict/EDICT/KANJIDIC) requires acknowledgement "on each screen
// display, e.g. in the form of a message at the foot of the screen or page"
// — https://www.edrdg.org/edrdg/licence.html — and permits linking or
// quoting their project page URLs as that acknowledgement.
export const ATTRIBUTIONS = {
  dictionary: [
    { text: 'Dictionary files from ' },
    { text: 'JMdict/EDICT', href: 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project' },
    { text: ' and ' },
    { text: 'KANJIDIC', href: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project' },
    { text: ' (EDRDG)' },
  ],
  'tanaka-corpus': [
    { text: 'Example sentences from the ' },
    { text: 'Tanaka Corpus', href: 'https://www.edrdg.org/wiki/index.php/Tanaka_Corpus' },
    { text: ' (EDRDG, CC BY)' },
  ],
  // Generic, character-agnostic — shown in the page footer whenever Voicevox
  // is the active TTS voice. One entry covers both voices since it doesn't
  // name either character.
  voicevox: [
    { text: 'Text to speech audio generated with ' },
    { text: 'VOICEVOX', href: 'https://voicevox.hiroshiba.jp/' },
  ],
  // Character-specific — shown inline under the "Text to speech" picker.
  // Voicevox's own credit examples name the specific character voice used
  // (e.g. "VOICEVOX:四国めたん"), which the generic footer credit above doesn't.
  'voicevox-2': [
    { text: '四国めたん by ' },
    { text: 'VOICEVOX', href: 'https://voicevox.hiroshiba.jp/' },
  ],
  'voicevox-11': [
    { text: '玄野武宏 by ' },
    { text: 'VOICEVOX', href: 'https://voicevox.hiroshiba.jp/' },
  ],
  jiten: [
    { text: 'Anime vocabulary data from ' },
    { text: 'Jiten.moe', href: 'https://jiten.moe/' },
    { text: ' (CC BY-SA 4.0)' },
  ],
  // Community-estimated JLPT level tags — no official list exists (see
  // scripts/import-jlpt-vocab.mjs) — sourced via stephenmk's JMdict-matched
  // conversion of Jonathan Waller's original JLPT Resources list.
  'jlpt-vocab': [
    { text: 'JLPT level estimates from ' },
    { text: "Jonathan Waller's JLPT Resources", href: 'http://www.tanos.co.uk/jlpt/' },
    { text: ', via ' },
    { text: 'yomitan-jlpt-vocab', href: 'https://github.com/stephenmk/yomitan-jlpt-vocab' },
    { text: ' (CC BY-SA 4.0)' },
  ],
}
