import { useState } from 'react'
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

export default function ImmersionReader({ article, onBack, isRead, onMarkRead }) {
  const { user, signIn } = useAuth()
  const [showSimplified, setShowSimplified] = useState(!!article.body_simple)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [revealedAnswers, setRevealedAnswers] = useState({})
  const [srsWord, setSrsWord] = useState('')
  const [srsMeaning, setSrsMeaning] = useState('')
  const [srsStatus, setSrsStatus] = useState(null) // null | 'added' | 'duplicate'
  const { data: srsData, save: saveSrs } = useProgress('vocab-srs')

  function addToSrs() {
    const word = srsWord.trim()
    if (!word) return
    const meaning = srsMeaning.trim()
    const current = srsData ?? { decks: {}, cards: {}, lastSession: null, totalReviews: 0, newCardDay: { date: '', count: 0 } }
    const decks = { ...current.decks }
    if (!decks[IMMERSION_DECK_ID]) {
      decks[IMMERSION_DECK_ID] = { id: IMMERSION_DECK_ID, name: 'Immersion Words', active: true, source: 'imported', addedAt: Date.now() }
    }
    const cardId = `${IMMERSION_DECK_ID}-${Date.now()}`
    const card = createCard(word, meaning, cardId, IMMERSION_DECK_ID)
    saveSrs({ ...current, decks, cards: { ...current.cards, [cardId]: card } })
    setSrsWord('')
    setSrsMeaning('')
    setSrsStatus('added')
    setTimeout(() => setSrsStatus(null), 2000)
  }

  const body = showSimplified && article.body_simple ? article.body_simple : article.body_ja
  const hasSimplified = !!article.body_simple
  const hasSummary = !!article.summary_en
  const questions = Array.isArray(article.questions) && article.questions.length > 0 ? article.questions : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#1E1E1E' }}>
      <PageHeader
        crumbs={[
          { label: 'Japanese Study', href: '#/' },
          { label: 'Immersion', onClick: onBack },
          { label: 'Read' },
        ]}
        rightSlot={<AuthSlot />}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 24px' }}>
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

          {hasSimplified && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {['Original', 'Simplified'].map(label => {
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
            </div>
          )}

          <div style={{
            fontSize: 18,
            color: TEXT,
            fontFamily: FONT,
            letterSpacing: TRACKING,
            lineHeight: 1.9,
            whiteSpace: 'pre-wrap',
            marginBottom: 40,
          }}>
            {body}
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

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, marginBottom: 32 }}>
            <div style={{ fontSize: 13, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, marginBottom: 12 }}>
              Add to SRS
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={srsWord}
                onChange={e => setSrsWord(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addToSrs()}
                placeholder="Word or phrase"
                style={{
                  flex: '1 1 140px',
                  fontSize: 14,
                  fontFamily: FONT,
                  letterSpacing: TRACKING,
                  color: TEXT,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6,
                  padding: '6px 12px',
                  outline: 'none',
                }}
              />
              <input
                value={srsMeaning}
                onChange={e => setSrsMeaning(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addToSrs()}
                placeholder="Meaning (optional)"
                style={{
                  flex: '1 1 140px',
                  fontSize: 14,
                  fontFamily: FONT,
                  letterSpacing: TRACKING,
                  color: TEXT,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6,
                  padding: '6px 12px',
                  outline: 'none',
                }}
              />
              <button
                onClick={addToSrs}
                disabled={!srsWord.trim()}
                style={{
                  fontSize: 13,
                  fontFamily: FONT,
                  letterSpacing: TRACKING,
                  color: srsWord.trim() ? TEXT : TEXT_MUTED,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  padding: '6px 16px',
                  cursor: srsWord.trim() ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                }}
              >
                {srsStatus === 'added' ? '✓ Added' : 'Add'}
              </button>
            </div>
          </div>

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
