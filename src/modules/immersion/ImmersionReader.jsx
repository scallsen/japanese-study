import { useState, useEffect, useRef, useMemo } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import { WordPopup } from '../../components/JapaneseReader.jsx'
import { buildVocabMap } from '../../utils/vocabMap.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProgress } from '../../hooks/useProgress.js'
import { useToast } from '../../context/ToastContext.jsx'
// Cross-module write: creates cards in vocab-srs progress namespace
import { createCard } from '../vocab-srs/srs.js'
import { ensureDeck, createDeck, deleteCards } from '../vocab-srs/deckUtils.js'
import ChipSelector from '../../components/Chip.jsx'
import ToggleButton from '../../components/ToggleButton.jsx'
import Button from '../../components/Button.jsx'
import Disclosure from '../../components/Disclosure.jsx'
import NewspaperLayout from '../../components/NewspaperLayout.jsx'
import { FONT, TRACKING, TEXT_MUTED, FS_BASE } from '../../data/theme.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import { SOURCE_LABEL } from './sourceLabels.js'

// Both bodies are generated; 'simplified' is the beginner rewrite and the
// original body is the intermediate one, so the toggle reads as levels.
// A third, easier level would need the fetch-nhk pipeline to generate it.
const BODY_VERSION_OPTIONS = [
  { value: 'simplified', label: 'Simple' },
  { value: 'original', label: 'Intermediate' },
]
const EDITION_LABEL = { simplified: 'Simple edition', original: 'Intermediate edition' }

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function ImmersionReader({ article, onBack }) {
  const { user, signIn } = useAuth()
  const [showSimplified, setShowSimplified] = useState(!!article.body_simple)
  const [popup, setPopup] = useState(null) // { token, vocabEntry, anchorRect, idx }
  const [showFurigana, setShowFurigana] = useState(true)
  const { data: srsData, save: saveSrs } = useProgress('vocab-srs')
  const { showToast } = useToast()
  const scrollRef = useRef(null)
  const isMobile = useIsMobile()

  const decks = srsData?.decks ?? {}

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onScroll() { setPopup(null) }
    el.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('touchmove', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      document.removeEventListener('touchmove', onScroll)
    }
  }, [])

  const vocabMap = useMemo(() => buildVocabMap(article.vocabulary_ja), [article.vocabulary_ja])

  function handleWordClick(token, e, idx) {
    const rect = e.target.getBoundingClientRect()
    const vocabEntry = vocabMap[token.t] ?? null
    setPopup({ token, vocabEntry, anchorRect: rect, idx })
  }

  function addWordToDeck(token, vocabEntry, deckId, decksForCreate) {
    const word = token.t
    const meaning = vocabEntry?.meaning ?? token.r ?? ''
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    const newDecks = decksForCreate ?? ensureDeck(current.decks, deckId, current.decks[deckId]?.name ?? 'Deck')
    const cardId = `${deckId}-${Date.now()}`
    const extras = {}
    if (vocabEntry?.jmdictId) extras.jmdictId = vocabEntry.jmdictId
    const card = createCard(word, meaning, cardId, deckId, extras)
    saveSrs({ ...current, decks: newDecks, cards: { ...current.cards, [cardId]: card } })
    setPopup(null)
    showToast({
      message: `Added to "${newDecks[deckId]?.name ?? 'Deck'}".`,
      actionLabel: 'Undo',
      onAction: () => handleUndoAdd(cardId),
    })
  }

  function handlePopupAdd(token, vocabEntry, deckId) {
    addWordToDeck(token, vocabEntry, deckId)
  }

  function handlePopupCreateAndAdd(token, vocabEntry, name) {
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    const { decks: newDecks, deckId } = createDeck(current.decks, name)
    addWordToDeck(token, vocabEntry, deckId, newDecks)
  }

  function handleUndoAdd(cardId) {
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    saveSrs({ ...current, cards: deleteCards(current.cards, [cardId]) })
  }

  const showingSimplified = showSimplified && !!article.body_simple
  const body = showingSimplified ? article.body_simple : article.body_ja
  const tokens = showingSimplified ? article.tokens_simple : article.tokens_ja
  const hasSimplified = !!article.body_simple
  const hasSummary = !!article.summary_en

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#1E1E1E' }}>
      {popup && (
        <WordPopup
          token={popup.token}
          vocabEntry={popup.vocabEntry}
          anchorRect={popup.anchorRect}
          decks={decks}
          isMobile={isMobile}
          onAdd={handlePopupAdd}
          onCreateAndAdd={handlePopupCreateAndAdd}
          onClose={() => setPopup(null)}
        />
      )}

      <PageHeader
        crumbs={[
          { label: 'Japanese Study', href: '#/' },
          { label: 'News reader', onClick: onBack },
          { label: 'Read' },
        ]}
        rightSlot={<AuthSlot />}
      />
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '40px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {(hasSimplified || tokens) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              {hasSimplified && (
                <ChipSelector
                  mode="single"
                  options={BODY_VERSION_OPTIONS}
                  value={showSimplified ? 'simplified' : 'original'}
                  onChange={v => setShowSimplified(v === 'simplified')}
                />
              )}
              {tokens && (
                <div style={{ marginLeft: 'auto' }}>
                  <ToggleButton
                    active={showFurigana}
                    labels={{ on: 'Hide furigana', off: 'Show furigana' }}
                    activeTone="neutral"
                    onClick={() => setShowFurigana(f => !f)}
                  />
                </div>
              )}
            </div>
          )}

          <div style={{ marginBottom: 40 }}>
            <NewspaperLayout
              title={article.title}
              subtitle={article.title_en}
              masthead={SOURCE_LABEL[article.source] ?? article.source ?? 'News'}
              edition={EDITION_LABEL[showSimplified ? 'simplified' : 'original']}
              date={article.published_at ? formatDate(article.published_at) : undefined}
              tokens={tokens}
              body={body}
              vocabMap={vocabMap}
              onWordClick={handleWordClick}
              showFurigana={showFurigana}
              activeIdx={popup?.idx ?? null}
              isMobile={isMobile}
            />
          </div>

          {hasSummary && (
            <div style={{ marginBottom: 32, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24 }}>
              <Disclosure label="English summary">
                <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, lineHeight: 1.7 }}>
                  {article.summary_en}
                </div>
              </Disclosure>
            </div>
          )}

          {!user && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, paddingBottom: 48, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Button variant="neutral" size="sm" onClick={signIn}>Sign in to save reading history</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
