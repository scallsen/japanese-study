import FlipCard from '../FlipCard.jsx'
import { buildFurigana } from '../utils/furigana.js'
import { FONT } from '../data/theme.js'
import { useKanjiMeanings } from '../hooks/useKanjiMeanings.js'
import { kanjiCharsOf } from '../utils/kanjiMeaningLookup.js'

const CARD_BG = '#E8E4DE'

function CardShell({ children }) {
  return (
    <div style={{ position: 'relative', backgroundColor: CARD_BG, width: '100%', height: '100%' }}>
      {children}
    </div>
  )
}

function FrontContent({ word, pixelFont }) {
  const jaFont = pixelFont ? FONT : 'system-ui, sans-serif'
  return (
    <CardShell>
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          fontFamily: jaFont,
          fontSize: '12.63cqw',
          fontWeight: 400,
          color: '#222',
          letterSpacing: 'normal',
          lineHeight: 1.2,
          textShadow: '2px 2px 0 rgba(0,0,0,0.25)',
        }}>
          {word.kanji}
        </div>
      </div>
    </CardShell>
  )
}

function KanjiMeaningBar({ chars, meanings, jaFont }) {
  return (
    <div style={{ display: 'flex', borderTop: '1px solid rgba(0,0,0,0.14)', backgroundColor: 'rgba(0,0,0,0.035)' }}>
      {chars.map((ch, i) => (
        <div key={`${ch}-${i}`} style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '1.8cqw 1cqw', gap: 2,
          borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.1)' : 'none',
        }}>
          <span style={{ fontFamily: jaFont, fontSize: '5cqw', color: '#333' }}>{ch}</span>
          <div style={{
            fontFamily: FONT, fontSize: '2.6cqw', color: '#777', textAlign: 'center',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
          }}>
            {meanings[ch]}
          </div>
        </div>
      ))}
    </div>
  )
}

function BackContent({ word, showFurigana, showTranslation, showSentence, showKanjiMeaning, pixelFont }) {
  const jaFont = pixelFont ? FONT : 'system-ui, sans-serif'
  const f = showFurigana ? buildFurigana(word.kanji, word.kana) : null

  const kanjiDisplay = f ? (
    <span>
      {f.prefix}
      <ruby>
        {f.kanjiPart}
        <rt style={{ fontSize: '0.45em', fontFamily: jaFont, letterSpacing: '0.05em', paddingBottom: '0.25em' }}>
          {f.furigana}
        </rt>
      </ruby>
      {f.okurigana}
    </span>
  ) : word.kanji

  const kanjiMeanings = useKanjiMeanings(word.kanji, showKanjiMeaning)
  const kanjiChars = showKanjiMeaning ? kanjiCharsOf(word.kanji) : []
  const meaningBarReady = kanjiChars.length > 0 && kanjiChars.every(ch => ch in kanjiMeanings)

  return (
    <CardShell>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 16px' }}>
          <div style={{
            fontFamily: jaFont,
            fontSize: '12.63cqw',
            fontWeight: 400,
            color: '#222',
            letterSpacing: 'normal',
            lineHeight: 1.4,
            textShadow: '2px 2px 0 rgba(0,0,0,0.25)',
            textAlign: 'center',
          }}>
            {kanjiDisplay}
          </div>
          {showTranslation && (
            <div style={{
              fontFamily: FONT,
              fontSize: '5.26cqw',
              fontWeight: 400,
              letterSpacing: '0.04em',
              color: '#555',
              textAlign: 'center',
            }}>
              {word.english}
            </div>
          )}
          {showSentence && word.sentence && (
            <div style={{
              fontFamily: jaFont,
              fontSize: '4.2cqw',
              fontWeight: 400,
              letterSpacing: '0.03em',
              color: '#888',
              textAlign: 'center',
              lineHeight: 1.5,
            }}>
              {word.sentence}
            </div>
          )}
        </div>
        {meaningBarReady && <KanjiMeaningBar chars={kanjiChars} meanings={kanjiMeanings} jaFont={jaFont} />}
      </div>
    </CardShell>
  )
}

export default function VocabCard({ word, flipped, onFlip, animate, showFurigana, showTranslation, showSentence, showKanjiMeaning, pixelFont }) {
  const front = <FrontContent word={word} pixelFont={pixelFont} />
  const back  = <BackContent word={word} showFurigana={showFurigana} showTranslation={showTranslation} showSentence={showSentence} showKanjiMeaning={showKanjiMeaning} pixelFont={pixelFont} />

  const ants = flipped && animate ? (
    <svg viewBox="0 0 380 280" className="mc-overlay" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10, overflow: 'visible' }} aria-hidden="true">
      <rect className="mc-ants" x="-4" y="-4" width="388" height="288" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeDasharray="6 6" />
      <rect className="mc-ants--offset" x="-4" y="-4" width="388" height="288" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" strokeDasharray="6 6" />
    </svg>
  ) : null

  return (
    <div style={{ width: 'min(380px, calc(100vw - 32px), calc(var(--card-max-h, 9999px) * 380 / 280))', aspectRatio: '380 / 280', containerType: 'size' }}>
      <FlipCard front={front} back={back} width="100%" height="100%" flipped={flipped} onFlip={onFlip} animate={animate} overlay={ants} />
    </div>
  )
}
