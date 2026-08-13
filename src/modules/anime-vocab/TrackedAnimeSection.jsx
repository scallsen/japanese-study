import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTrackedAnime } from './useTrackedAnime.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, SUBHEADING_STYLE, FS_BADGE, FS_LIST_TITLE } from '../../data/theme.js'

const ACCENT = '#D46EA3'

function RemoveButton({ onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Stop tracking"
      title="Stop tracking"
      style={{
        flexShrink: 0, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', borderRadius: 4, padding: 0, cursor: 'pointer',
        fontSize: 15, lineHeight: 1, fontFamily: FONT,
        color: hovered ? '#f87171' : TEXT_MUTED,
        background: hovered ? 'rgba(248,113,113,0.12)' : 'transparent',
      }}
    >
      ×
    </button>
  )
}

function TrackedAnimeRow({ mediaId, title, mediaType, onOpen, onRemove }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#313131' : '#2A2A2A',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        padding: '12px 16px',
        cursor: 'pointer',
        transition: 'background 130ms',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{
        fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: ACCENT,
        background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 4, padding: '1px 7px', flexShrink: 0,
      }}>
        {mediaType}
      </span>
      <span style={{ fontSize: FS_LIST_TITLE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      <RemoveButton onClick={onRemove} />
    </div>
  )
}

export default function TrackedAnimeSection() {
  const { user, loading: authLoading } = useAuth()
  const { tracked, untrack } = useTrackedAnime()

  if (authLoading || !user) return null

  const entries = Object.entries(tracked).sort(([, a], [, b]) => new Date(b.addedAt) - new Date(a.addedAt))
  if (entries.length === 0) return null

  return (
    <section style={{ maxWidth: 640, margin: '0 auto 20px' }}>
      <div style={{ ...SUBHEADING_STYLE, color: TEXT_MUTED, fontFamily: FONT, marginBottom: 10 }}>
        Currently studying
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entries.map(([mediaId, entry]) => (
          <TrackedAnimeRow
            key={mediaId}
            mediaId={mediaId}
            title={entry.title}
            mediaType={entry.mediaType}
            onOpen={() => { window.location.hash = `/anime-vocab/${mediaId}` }}
            onRemove={() => untrack(mediaId)}
          />
        ))}
      </div>
    </section>
  )
}
