import { useState, useEffect, useRef, useMemo } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import { TokenizedBody, WordPopup } from '../../components/JapaneseReader.jsx'
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
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CONTENT_HEADING, FS_CAPTION, FS_ARTICLE_BODY } from '../../data/theme.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const READ_MARK = '#6BCB6B'
const BODY_VERSION_OPTIONS = [
  { value: 'original', label: 'Original' },
  { value: 'simplified', label: 'Simplified' },
]

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function ImmersionReader({ article, onBack, isRead, onMarkRead }) {
  const { user, signIn } = useAuth()
  const [showSimplified, setShowSimplified] = useState(!!article.body_simple)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [revealedAnswers, setRevealedAnswers] = useState({})
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
  const questions = Array.isArray(article.questions) && article.questions.length > 0 ? article.questions : null

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
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: FS_CONTENT_HEADING,
              color: TEXT,
              fontFamily: FONT,
              letterSpacing: TRACKING,
              lineHeight: 1.5,
              marginBottom: 8,
            }}>
              {article.title}
            </div>
            {article.title_en && (
              <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, marginBottom: 6 }}>
                {article.title_en}
              </div>
            )}
            {article.published_at && (
              <div style={{ fontSize: FS_CAPTION, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, opacity: 0.7 }}>
                {formatDate(article.published_at)}
              </div>
            )}
          </div>

          {(hasSimplified || tokens) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
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

          <div style={{
            fontSize: FS_ARTICLE_BODY,
            color: TEXT,
            fontFamily: FONT,
            letterSpacing: TRACKING,
            lineHeight: tokens && showFurigana ? 2.4 : 1.9,
            whiteSpace: 'pre-wrap',
            marginBottom: 40,
          }}>
            {tokens
              ? <TokenizedBody tokens={tokens} vocabMap={vocabMap} onWordClick={handleWordClick} showFurigana={showFurigana} activeIdx={popup?.idx ?? null} />
              : body}
          </div>

          {hasSummary && (
            <div style={{ marginBottom: 32, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24 }}>
              <button
                onClick={() => setSummaryOpen(o => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: FS_BASE,
                  fontFamily: FONT,
                  letterSpacing: TRACKING,
                  color: TEXT_MUTED,
                }}
              >
                <span style={{ transform: summaryOpen ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 150ms' }}>▶</span>
                English summary
              </button>
              {summaryOpen && (
                <div style={{
                  marginTop: 12,
                  fontSize: FS_BASE,
                  color: TEXT_MUTED,
                  fontFamily: FONT,
                  letterSpacing: TRACKING,
                  lineHeight: 1.7,
                }}>
                  {article.summary_en}
                </div>
              )}
            </div>
          )}

          {questions && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, marginBottom: 40 }}>
              <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, marginBottom: 16 }}>
                Comprehension check
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {questions.map((item, i) => (
                  <div key={i}>
                    <div style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, lineHeight: 1.5, marginBottom: 6 }}>
                      {item.q}
                    </div>
                    {revealedAnswers[i] ? (
                      <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, lineHeight: 1.6 }}>
                        {item.a}
                      </div>
                    ) : (
                      <Button variant="neutral" size="sm" onClick={() => setRevealedAnswers(prev => ({ ...prev, [i]: true }))}>
                        Show answer
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, paddingBottom: 48, display: 'flex', alignItems: 'center', gap: 12 }}>
            {user ? (
              isRead ? (
                <span style={{ fontSize: FS_BASE, color: READ_MARK, fontFamily: FONT, letterSpacing: TRACKING, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✓</span> Marked as read
                </span>
              ) : (
                <Button variant="neutral" onClick={onMarkRead}>Mark as read</Button>
              )
            ) : (
              <Button variant="neutral" size="sm" onClick={signIn}>Sign in to save reading history</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
