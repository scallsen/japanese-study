import Badge from '../components/Badge.jsx'
import { FONT, KANJI_FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_ENTRY_KANJI } from '../data/theme.js'

function kanjiGradeLabel(grade) {
  if (!grade) return null
  if (grade <= 6) return `G${grade}`
  if (grade <= 8) return 'Secondary'
  return 'Jinmeiyō'
}

// Kanji breakdown content -- shared by DictionaryPage's KanjiRow (a row
// inside the kanji carousel's expanded list) and DictionaryEntryPage's
// KanjiCard (a standalone card). Renders only the inner flex content (kanji
// glyph + reading/badge/meaning column), no outer shell -- the caller
// supplies whatever container fits its context (a Card for a standalone
// card, a padded/divided row div for a list), same shell-vs-content split
// used throughout this rebuild (Badge is content, Card is shell).
//
// `truncateMeanings`: the carousel's row list truncates to 4 meanings for a
// compact quick-glance row; the entry page's standalone card shows all of
// them -- a real behavioral difference between the two original
// implementations, preserved as an explicit prop rather than picking one.
export function KanjiBreakdownEntry({ entry, truncateMeanings = false }) {
  const jlptLabel = entry.jlpt ? `N${entry.jlpt}` : null
  const gradeLabel = kanjiGradeLabel(entry.grade)
  const meanings = truncateMeanings
    ? entry.meanings?.split('; ').slice(0, 4).join('; ')
    : entry.meanings

  return (
    <>
      <span style={{ fontSize: FS_ENTRY_KANJI, color: TEXT, fontFamily: KANJI_FONT, lineHeight: 1, flexShrink: 0, letterSpacing: 0, minWidth: 44, textAlign: 'center' }}>
        {entry.literal}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
          {entry.on_readings?.length > 0 && (
            <span style={{ fontSize: FS_BASE, color: TEXT, fontFamily: KANJI_FONT, letterSpacing: 0 }}>
              {entry.on_readings.join('、')}
            </span>
          )}
          {entry.kun_readings?.length > 0 && (
            <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: KANJI_FONT, letterSpacing: 0 }}>
              {entry.kun_readings.join('、')}
            </span>
          )}
          {jlptLabel && <Badge variant="text" tone="accent">{jlptLabel}</Badge>}
          {gradeLabel && <Badge variant="text" tone="neutral">{gradeLabel}</Badge>}
          {entry.stroke_count && <Badge variant="text" tone="neutral" dimmed>{entry.stroke_count} strokes</Badge>}
          {entry.frequency && <Badge variant="text" tone="neutral" dimmed>freq #{entry.frequency}</Badge>}
        </div>
        {meanings && (
          <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
            {meanings}
          </span>
        )}
      </div>
    </>
  )
}
