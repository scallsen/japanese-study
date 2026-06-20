import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { useProgress } from '../../hooks/useProgress.js'
// Cross-module write: creates cards in vocab-srs progress namespace
import { createCard } from '../vocab-srs/srs.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED } from '../../data/theme.js'

const ACCENT = '#E05A4E'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const IMMERSION_DECK_ID = 'immersion-words'

function buildVocabMap(vocabulary) {
  const map = {}
  if (!Array.isArray(vocabulary)) return map
  for (const entry of vocabulary) {
    if (entry.word) map[entry.word] = entry
  }
  return map
}

function TokenizedBody({ tokens, vocabMap, onWordClick, showFurigana, activeIdx }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  useEffect(() => {
    if (activeIdx === null) setHoveredIdx(null)
  }, [activeIdx])

  if (!Array.isArray(tokens) || tokens.length === 0) return null
  return (
    <span>
      {tokens.map((tok, i) => {
        if (!tok.w) return <span key={i}>{tok.t}</span>
        const isActive = hoveredIdx === i || activeIdx === i
        const inVocab = !!vocabMap[tok.t]
        return (
          <span
            key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={e => { e.stopPropagation(); onWordClick(tok, e, i) }}
            style={{
              cursor: 'pointer',
              borderRadius: 3,
              background: isActive
                ? inVocab ? 'rgba(224,90,78,0.22)' : 'rgba(255,255,255,0.1)'
                : 'transparent',
              padding: '0 1px',
              transition: 'background 80ms',
            }}
          >
            {showFurigana && tok.r
              ? (
                <ruby>
                  {tok.t}
                  <rt style={{ fontSize: '0.55em', color: TEXT_MUTED, letterSpacing: 0 }}>{tok.r}</rt>
                </ruby>
              )
              : tok.t}
          </span>
        )
      })}
    </span>
  )
}

function WordPopup({ token, vocabEntry, onAddToSrs, onClose, anchorRect }) {
  const popupRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  useLayoutEffect(() => {
    if (!popupRef.current || !anchorRect) return
    const el = popupRef.current
    const { width, height } = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let top = anchorRect.bottom + 6
    let left = anchorRect.left

    if (left + width + 8 > vw) left = vw - width - 8
    left = Math.max(8, left)

    if (top + height + 8 > vh) top = anchorRect.top - height - 6
    top = Math.max(8, top)

    el.style.top = top + 'px'
    el.style.left = left + 'px'
  }, [anchorRect])

  return (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        top: anchorRect ? anchorRect.bottom + 6 : 0,
        left: anchorRect ? anchorRect.left : 0,
        zIndex: 200,
        background: '#2A2A2A',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '10px 14px',
        minWidth: 160,
        maxWidth: 260,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        fontFamily: FONT,
        letterSpacing: TRACKING,
      }}
    >
      <div style={{ fontSize: 20, color: TEXT, marginBottom: 2 }}>{token.t}</div>
      {token.r && (
        <div style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: vocabEntry ? 6 : 10 }}>{token.r}</div>
      )}
      {vocabEntry?.meaning && (
        <div style={{ fontSize: 13, color: TEXT, marginBottom: 10 }}>{vocabEntry.meaning}</div>
      )}
      <button
        onClick={() => onAddToSrs(token, vocabEntry)}
        style={{
          fontSize: 12,
          fontFamily: FONT,
          letterSpacing: TRACKING,
          color: TEXT,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 5,
          padding: '4px 12px',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        Add to SRS
      </button>
    </div>
  )
}

export default function ImmersionReader({ article, onBack, isRead, onMarkRead }) {
  const { user, signIn } = useAuth()
  const [showSimplified, setShowSimplified] = useState(!!article.body_simple)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [revealedAnswers, setRevealedAnswers] = useState({})
  const [popup, setPopup] = useState(null) // { token, vocabEntry, anchorRect, idx }
  const [showFurigana, setShowFurigana] = useState(true)
  const { data: srsData, save: saveSrs } = useProgress('vocab-srs')
  const scrollRef = useRef(null)

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

  function handlePopupAddToSrs(token, vocabEntry) {
    const word = token.t
    const meaning = vocabEntry?.meaning ?? token.r ?? ''
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    const decks = { ...current.decks }
    if (!decks[IMMERSION_DECK_ID]) {
      decks[IMMERSION_DECK_ID] = { id: IMMERSION_DECK_ID, name: 'Immersion Words', active: true, source: 'imported', addedAt: Date.now() }
    }
    const cardId = `${IMMERSION_DECK_ID}-${Date.now()}`
    const card = createCard(word, meaning, cardId, IMMERSION_DECK_ID)
    saveSrs({ ...current, decks, cards: { ...current.cards, [cardId]: card } })
    setPopup(null)
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
          onAddToSrs={handlePopupAddToSrs}
          onClose={() => setPopup(null)}
        />
      )}
      <PageHeader
        crumbs={[
          { label: 'Japanese Study', href: '#/' },
          { label: 'Immersion', onClick: onBack },
          { label: 'Read' },
        ]}
        rightSlot={<AuthSlot />}
      />
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '40px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 22,
              color: TEXT,
              fontFamily: FONT,
              letterSpacing: TRACKING,
              lineHeight: 1.5,
              marginBottom: 8,
            }}>
              {article.title}
            </div>
            {article.title_en && (
              <div style={{ fontSize: 14, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, marginBottom: 6 }}>
                {article.title_en}
              </div>
            )}
            {article.published_at && (
              <div style={{ fontSize: 12, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, opacity: 0.7 }}>
                {formatDate(article.published_at)}
              </div>
            )}
          </div>

          {(hasSimplified || tokens) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
              {hasSimplified && ['Original', 'Simplified'].map(label => {
                const active = label === 'Simplified' ? showSimplified : !showSimplified
                return (
                  <button
                    key={label}
                    onClick={() => setShowSimplified(label === 'Simplified')}
                    style={{
                      fontSize: 12,
                      fontFamily: FONT,
                      letterSpacing: TRACKING,
                      color: active ? ACCENT : TEXT_MUTED,
                      background: active ? `${ACCENT}18` : 'transparent',
                      border: `1px solid ${active ? ACCENT + '55' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 4,
                      padding: '3px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
              {tokens && (
                <button
                  onClick={() => setShowFurigana(f => !f)}
                  style={{
                    marginLeft: 'auto',
                    fontSize: 12,
                    fontFamily: FONT,
                    letterSpacing: TRACKING,
                    color: showFurigana ? TEXT : TEXT_MUTED,
                    background: showFurigana ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: `1px solid ${showFurigana ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 4,
                    padding: '3px 12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {showFurigana ? 'Hide furigana' : 'Show furigana'}
                </button>
              )}
            </div>
          )}

          <div style={{
            fontSize: 18,
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
                  fontSize: 13,
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
                  fontSize: 14,
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
              <div style={{ fontSize: 13, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, marginBottom: 16 }}>
                Comprehension check
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {questions.map((item, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 15, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, lineHeight: 1.5, marginBottom: 6 }}>
                      {item.q}
                    </div>
                    {revealedAnswers[i] ? (
                      <div style={{ fontSize: 14, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, lineHeight: 1.6 }}>
                        {item.a}
                      </div>
                    ) : (
                      <button
                        onClick={() => setRevealedAnswers(prev => ({ ...prev, [i]: true }))}
                        style={{
                          fontSize: 12,
                          fontFamily: FONT,
                          letterSpacing: TRACKING,
                          color: TEXT_MUTED,
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 4,
                          padding: '3px 12px',
                          cursor: 'pointer',
                        }}
                      >
                        Show answer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, paddingBottom: 48, display: 'flex', alignItems: 'center', gap: 12 }}>
            {user ? (
              isRead ? (
                <span style={{ fontSize: 13, color: '#6BCB6B', fontFamily: FONT, letterSpacing: TRACKING, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✓</span> Marked as read
                </span>
              ) : (
                <button
                  onClick={onMarkRead}
                  style={{
                    fontSize: 13,
                    fontFamily: FONT,
                    letterSpacing: TRACKING,
                    color: TEXT,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6,
                    padding: '6px 16px',
                    cursor: 'pointer',
                  }}
                >
                  Mark as read
                </button>
              )
            ) : (
              <button
                onClick={signIn}
                style={{
                  fontSize: 13,
                  fontFamily: FONT,
                  letterSpacing: TRACKING,
                  color: TEXT_MUTED,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Sign in to save reading history
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
