import { useState } from 'react'
import PageHeader from '../../components/PageHeader.jsx'
import AuthSlot from '../../components/AuthSlot.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED } from '../../data/theme.js'

const ACCENT = '#E05A4E'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function ImmersionReader({ article, onBack }) {
  const [showSimplified, setShowSimplified] = useState(!!article.body_simple)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [revealedAnswers, setRevealedAnswers] = useState({})

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
        </div>
      </div>
    </div>
  )
}
