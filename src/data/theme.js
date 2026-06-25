export const FONT = "'DotGothic16', system-ui, sans-serif"
export const TRACKING = '0.05em'
export const BORDER = '#2E2E2E'
export const TEXT = '#E8E8E8'
export const TEXT_MUTED = '#888888'

export const FS_SM = 13
export const FS_BASE = 15
export const FS_NAV = 16

export const SUBHEADING_STYLE = { fontSize: FS_BASE, textTransform: 'uppercase', letterSpacing: '0.08em' }

// Semantic font sizes — all FS_BASE for now, adjust as a group
export const FS_BADGE = 12         // inline pill labels: source, difficulty, JLPT, POS, "common"
export const FS_CAPTION = FS_BASE  // dates, hints, secondary metadata below controls
export const FS_HEADING = FS_BASE  // screen/section headings ("No active decks", panel headings)
export const FS_ENTRY = FS_BASE    // dictionary word form, word popup content

// Exceptions: intentionally outside the semantic token system
export const FS_DISPLAY_HEADING = 28  // done-screen "Session complete"
export const FS_STAT_VALUE = 24       // done-screen reviewed / again / time numbers
export const FS_CONTENT_HEADING = 22  // article title in reader, module stat summary, grammar node heading
export const FS_LIST_TITLE = 17       // article card title in list view
export const FS_ENTRY_WORD = 20       // word form in dictionary results & word popup
export const FS_ENTRY_KANJI = 36      // dictionary large kanji display
export const FS_ARTICLE_BODY = 18     // article body text (reading-optimised, do not normalise)
