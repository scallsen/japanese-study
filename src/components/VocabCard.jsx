import FlipCard from '../FlipCard.jsx'
import { buildFurigana } from '../utils/furigana.js'
import { FONT } from '../data/theme.js'
import { useKanjiMeanings } from '../hooks/useKanjiMeanings.js'
import { kanjiCharsOf } from '../utils/kanjiMeaningLookup.js'
import { useDictionaryEntry } from '../hooks/useDictionaryEntries.js'
import { briefGloss } from '../utils/dictionaryEntryLookup.js'
import { useSentenceForWord } from '../hooks/useSentenceForWord.js'
import { getMainTextScale, getSecondaryTextScale, cqw } from '../utils/cardTextFit.js'

const CARD_BG = '#E8E4DE'

function CardShell({ isReview, isSentenceVocab, children }) {
  return (
    <div style={{ position: 'relative', backgroundColor: CARD_BG, width: '100%', height: '100%' }}>
      {(isReview || isSentenceVocab) && (
        <div style={{
          position: 'absolute', top: '3cqw', left: '3cqw',
          fontFamily: FONT, fontSize: '4.5cqw', fontWeight: 700,
          color: 'rgba(0,0,0,0.16)', lineHeight: 1,
          pointerEvents: 'none', userSelect: 'none',
        }}>
          {isReview ? 'R' : 'SR'}
        </div>
      )}
      {children}
    </div>
  )
}

function frontTextStyle(scale) {
  return {
    fontSize: cqw(12.63, scale),
    fontWeight: 400,
    color: '#222',
    letterSpacing: 'normal',
    lineHeight: 1.2,
    textShadow: '2px 2px 0 rgba(0,0,0,0.25)',
    textAlign: 'center',
  }
}

function FrontContent({ word, displayForm, resolvedEnglish, reviewMode, pixelFont }) {
  const jaFont = pixelFont ? FONT : 'system-ui, sans-serif'
  const isMeaningFront = reviewMode === 'meaning-front'
  const frontText = isMeaningFront ? resolvedEnglish : displayForm
  const scale = getMainTextScale(frontText)
  return (
    <CardShell isReview={word.isReview} isSentenceVocab={word.isSentenceVocab}>
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMeaningFront ? '0 16px' : 0 }}>
        <div style={{ ...frontTextStyle(scale), fontFamily: isMeaningFront ? FONT : jaFont }}>
          {frontText}
        </div>
      </div>
    </CardShell>
  )
}

function KanjiMeaningBar({ chars, meanings, jaFont, scale }) {
  return (
    <div style={{ display: 'flex', borderTop: '1px solid rgba(0,0,0,0.14)', backgroundColor: 'rgba(0,0,0,0.035)' }}>
      {chars.map((ch, i) => (
        <div key={`${ch}-${i}`} style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '1.8cqw 1cqw', gap: 2,
          borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.1)' : 'none',
        }}>
          <span style={{ fontFamily: jaFont, fontSize: cqw(5, scale), color: '#333' }}>{ch}</span>
          <div style={{
            fontFamily: FONT, fontSize: cqw(2.6, scale), color: '#777', textAlign: 'center',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
          }}>
            {meanings[ch]}
          </div>
        </div>
      ))}
    </div>
  )
}

function BackContent({ word, displayForm, reading, resolvedEnglish, sentenceText, showFurigana, showTranslation, showSentence, showKanjiMeaning, pixelFont }) {
  const jaFont = pixelFont ? FONT : 'system-ui, sans-serif'
  const furiganaParts = showFurigana ? buildFurigana(displayForm, reading) : null

  const kanjiDisplay = furiganaParts ? (
    <span>
      {furiganaParts.map((part, i) => part.type === 'kanji' ? (
        <ruby key={i}>
          {part.text}
          <rt style={{ fontSize: '0.45em', fontFamily: jaFont, letterSpacing: '0.05em', paddingBottom: '0.25em' }}>
            {part.furigana}
          </rt>
        </ruby>
      ) : (
        <span key={i}>{part.text}</span>
      ))}
    </span>
  ) : displayForm

  const kanjiMeanings = useKanjiMeanings(displayForm, showKanjiMeaning)
  const kanjiChars = showKanjiMeaning ? kanjiCharsOf(displayForm) : []
  const meaningBarReady = kanjiChars.length > 0 && kanjiChars.every(ch => ch in kanjiMeanings)

  const mainScale = getMainTextScale(displayForm)
  const secondaryScale = getSecondaryTextScale({
    translation: showTranslation ? resolvedEnglish : null,
    sentence: showSentence ? sentenceText : null,
    showKanjiMeaning: meaningBarReady,
  })

  return (
    <CardShell isReview={word.isReview} isSentenceVocab={word.isSentenceVocab}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '0 16px' }}>
          <div style={{
            fontFamily: jaFont,
            fontSize: cqw(12.63, mainScale),
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
              fontSize: cqw(5.26, secondaryScale),
              fontWeight: 400,
              letterSpacing: '0.04em',
              color: '#555',
              textAlign: 'center',
            }}>
              {resolvedEnglish}
            </div>
          )}
          {showSentence && sentenceText && (
            <div style={{
              fontFamily: jaFont,
              fontSize: cqw(4.2, secondaryScale),
              fontWeight: 400,
              letterSpacing: '0.03em',
              color: '#888',
              textAlign: 'center',
              lineHeight: 1.5,
            }}>
              {sentenceText}
            </div>
          )}
        </div>
        {meaningBarReady && <KanjiMeaningBar chars={kanjiChars} meanings={kanjiMeanings} jaFont={jaFont} scale={secondaryScale} />}
      </div>
    </CardShell>
  )
}

export default function VocabCard({ word, flipped, onFlip, animate, reviewMode, showFurigana, showTranslation, showSentence, showKanjiMeaning, pixelFont, sentenceSource }) {
  // Dictionary is the source of truth for the definition — and, whenever the
  // word doesn't carry its own kanji/kana override, for the display form and
  // reading too — when this word is linked (word.jmdictId). The word's own
  // fields are only a fallback for words that don't have (or don't yet have)
  // a dictionary match.
  const { entry: dictEntry, loading: dictLoading } = useDictionaryEntry(word.jmdictId, true)
  const resolvedEnglish = briefGloss(dictEntry) ?? word.english
  const displayForm = word.kanji ?? dictEntry?.primary_form
  const reading = word.kana ?? dictEntry?.kana_forms?.[0]

  // The word's own curated sentence wins by default ('custom'); a Tanaka
  // Corpus sentence fills the gap when there isn't one, or takes priority
  // outright when sentenceSource is 'tanaka'.
  const tanakaSentence = useSentenceForWord(word.jmdictId, showSentence)
  const useTanaka = sentenceSource === 'tanaka' ? !!tanakaSentence : (!word.sentence && !!tanakaSentence)
  const sentenceText = useTanaka ? tanakaSentence.japanese : word.sentence

  // dictLoading is only ever true while a dictionary fetch is genuinely in
  // flight (see useDictionaryEntry) — once it resolves, or immediately for a
  // word with no jmdictId, displayForm/reading/resolvedEnglish are already
  // final via the fallbacks above. Avoids flashing blank/undefined content
  // (or crashing buildFurigana on a missing reading) for a word that relies
  // on the dictionary for its kanji/kana/english.
  if (dictLoading) {
    return (
      <div style={{ width: 'min(380px, calc(100vw - 32px), calc(var(--card-max-h, 9999px) * 380 / 280))', aspectRatio: '380 / 280', containerType: 'size' }}>
        <CardShell isReview={word.isReview} isSentenceVocab={word.isSentenceVocab} />
      </div>
    )
  }

  const front = <FrontContent word={word} displayForm={displayForm} resolvedEnglish={resolvedEnglish} reviewMode={reviewMode} pixelFont={pixelFont} />
  const back  = <BackContent word={word} displayForm={displayForm} reading={reading} resolvedEnglish={resolvedEnglish} sentenceText={sentenceText} showFurigana={showFurigana} showTranslation={showTranslation} showSentence={showSentence} showKanjiMeaning={showKanjiMeaning} pixelFont={pixelFont} />

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
