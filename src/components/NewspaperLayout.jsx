import { TokenizedBody } from './JapaneseReader.jsx'
import { FONT, MINCHO_FONT } from '../data/theme.js'

// The paper-styled reading surface — built for Story's `news` format,
// promoted here so the News reader (a different module, can't import from
// src/modules/story/ per the cross-module rule) can render real articles in
// it too. `masthead`/`edition`/`date` are the three header lines (Story's
// fixed "The Story Times" / "Practice edition" / today's date became
// defaults so Story's own call site is unchanged); `subtitle` is an
// optional line under the headline (the News reader's English title).
// `tokens` renders through TokenizedBody as before; `body` is a plain-text
// fallback for callers with no tokenization (kept for parity, unused by
// either current caller).
export default function NewspaperLayout({
  title,
  subtitle,
  tokens,
  body,
  vocabMap,
  onWordClick,
  showFurigana,
  activeIdx,
  isMobile,
  masthead = 'The Story Times',
  edition = 'Practice edition',
  date,
}) {
  const dateLine = date ?? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  return (
    <div style={{
      background: '#EDE7DA',
      color: '#1C1A17',
      borderRadius: 4,
      padding: isMobile ? '18px 16px 26px' : '28px 34px 38px',
      boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
    }}>
      <div style={{
        textAlign: 'center',
        fontFamily: FONT,
        letterSpacing: '0.3em',
        fontSize: 12,
        textTransform: 'uppercase',
        borderBottom: '1px solid #1C1A17',
        paddingBottom: 8,
      }}>
        {masthead}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: FONT,
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        borderBottom: '3px double #1C1A17',
        padding: '4px 2px 6px',
        marginBottom: 20,
        color: '#4A453C',
      }}>
        <span>{edition}</span>
        <span>{dateLine}</span>
      </div>
      <h1 style={{
        fontFamily: MINCHO_FONT,
        fontWeight: 700,
        fontSize: isMobile ? 26 : 34,
        lineHeight: 1.4,
        margin: subtitle ? '0 0 6px' : '0 0 18px',
        textAlign: 'center',
      }}>
        {title}
      </h1>
      {subtitle && (
        <div style={{
          fontFamily: FONT,
          fontSize: 13,
          color: '#4A453C',
          textAlign: 'center',
          marginBottom: 18,
        }}>
          {subtitle}
        </div>
      )}
      <div style={{
        fontFamily: MINCHO_FONT,
        fontSize: isMobile ? 16 : 17,
        lineHeight: tokens && showFurigana ? 2.3 : 1.95,
        whiteSpace: 'pre-wrap',
        textAlign: 'justify',
        columnCount: isMobile ? 1 : 2,
        columnGap: 36,
        columnRule: '1px solid rgba(28,26,23,0.25)',
        borderTop: '1px solid rgba(28,26,23,0.25)',
        paddingTop: 18,
      }}>
        {tokens ? (
          <TokenizedBody
            tokens={tokens}
            vocabMap={vocabMap}
            onWordClick={onWordClick}
            showFurigana={showFurigana}
            activeIdx={activeIdx}
            vocabHighlight="rgba(178,88,32,0.28)"
            hoverBg="rgba(28,26,23,0.1)"
            rtColor="#6B6558"
          />
        ) : body}
      </div>
    </div>
  )
}
