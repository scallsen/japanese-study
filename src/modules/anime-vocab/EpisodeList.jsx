import { useState } from 'react'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_LIST_TITLE } from '../../data/theme.js'

const ACCENT = '#D46EA3'

function EpisodeRow({ episode, onClick }) {
  const [hovered, setHovered] = useState(false)
  const difficulty = episode.difficulty?.difficulty
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#313131' : '#2A2A2A',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        padding: '12px 18px',
        cursor: 'pointer',
        transition: 'background 130ms',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ fontSize: FS_LIST_TITLE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {episode.title || `Episode ${episode.episode_number}`}
      </span>
      {episode.unique_word_count != null && (
        <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0 }}>
          {episode.unique_word_count} unique words
        </span>
      )}
      {difficulty != null && (
        <span style={{
          fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: ACCENT,
          background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 4, padding: '1px 7px', flexShrink: 0,
        }}>
          Difficulty {Number(difficulty).toFixed(1)}
        </span>
      )}
      {episode.synced_at && (
        <span style={{ fontSize: FS_BADGE, color: '#6BCB6B', fontFamily: FONT, flexShrink: 0 }}>Synced</span>
      )}
    </div>
  )
}

export default function EpisodeList({ media, episodes, onSelectEpisode }) {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: FS_LIST_TITLE + 4, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, marginBottom: 4 }}>
          {media.title}
        </div>
        <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
          {episodes.length} episode{episodes.length === 1 ? '' : 's'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {episodes.map(ep => (
          <EpisodeRow key={ep.id} episode={ep} onClick={() => onSelectEpisode(ep)} />
        ))}
      </div>
    </div>
  )
}
