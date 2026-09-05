import { createCard } from './srs.js'

function stripHtml(str) {
  return (str || '').replace(/<[^>]*>/g, '').trim()
}

function extractSound(field) {
  const m = (field || '').match(/\[sound:([^\]]+)\]/)
  return m ? m[1] : null
}

// Parses an Anki "Notes in Plain Text" export.
//
// Supports two layouts:
//   Simple (2 cols):  front \t back
//   Rich (18 cols) — the shape Core-2000-style Anki note types export; this app
//   no longer ships that deck, but the layout is still accepted on import:
//                        noteId \t kanji \t furigana \t kana \t english \t wordAudio \t pos \t
//                        (empty) \t sentence \t sentence+furi \t kanaTranscript \t englishSentence \t
//                        cloze \t sentenceAudio \t stepLabel \t pos \t n \t n
//
// existingIds should be the keys of the current cards{} object to skip duplicates.
export function parseAnkiExport(tsvString, existingIds = []) {
  const existingSet = new Set(existingIds)
  const cards = []

  for (const line of tsvString.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const cols = trimmed.split('\t')

    let front, back, id, extras = {}

    if (cols.length >= 14) {
      // Full 18-column layout
      const noteId = cols[0].trim()
      front = stripHtml(cols[1])
      const kana = stripHtml(cols[3])
      back = stripHtml(cols[4])
      const wordAudio = extractSound(cols[5])
      const sentence = stripHtml(cols[11])
      const sentenceAudio = extractSound(cols[13])

      if (!front || !back) continue
      id = `anki-${noteId}`
      if (kana && kana !== front) extras.kana = kana
      if (wordAudio) extras.wordAudio = wordAudio
      if (sentenceAudio) extras.sentenceAudio = sentenceAudio
      if (sentence) extras.sentence = sentence
    } else {
      // Simple 2-column layout
      const tabIdx = trimmed.indexOf('\t')
      if (tabIdx === -1) continue
      front = trimmed.slice(0, tabIdx).trim()
      back = trimmed.slice(tabIdx + 1).trim()
      if (!front || !back) continue
      id = `anki-${front}`
    }

    if (existingSet.has(id)) continue
    cards.push(createCard(front, back, id, 'imported', extras))
  }

  return cards
}
