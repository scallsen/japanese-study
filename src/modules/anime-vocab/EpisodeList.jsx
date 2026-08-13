import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTrackedAnime } from './useTrackedAnime.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_LIST_TITLE } from '../../data/theme.js'

const ACCENT = '#D46EA3'
const TRACKED_COLOR = '#6BCB6B'
const REMOVE_COLOR = '#f87171'

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
    </div>
  )
}

function TrackToggle({ tracked, signedIn, onClick }) {
  const [hovered, setHovered] = useState(false)

  let label = '+ Track this series'
  let color = ACCENT
  if (!signedIn) {
    label = 'Sign in to track this series'
    color = TEXT_MUTED
  } else if (tracked) {
    label = hovered ? 'Remove tracking' : '✓ Tracking'
    color = hovered ? REMOVE_COLOR : TRACKED_COLOR
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 14px', borderRadius: 6, cursor: 'pointer', background: 'transparent',
        fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0,
        color, border: `1px solid ${color}`,
      }}
    >
      {label}
    </button>
  )
}

export default function EpisodeList({ media, episodes, onSelectEpisode }) {
  const { user, signIn } = useAuth()
  const { isTracked, track, untrack } = useTrackedAnime()
  const tracked = isTracked(media.id)

  function handleToggleTrack() {
    if (!user) { signIn(); return }
    if (tracked) untrack(media.id); else track(media)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: FS_LIST_TITLE + 4, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, marginBottom: 4 }}>
            {media.title}
          </div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
            {episodes.length} episode{episodes.length === 1 ? '' : 's'}
          </div>
        </div>
        <TrackToggle tracked={tracked} signedIn={!!user} onClick={handleToggleTrack} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {episodes.map(ep => (
          <EpisodeRow key={ep.id} episode={ep} onClick={() => onSelectEpisode(ep)} />
        ))}
      </div>
    </div>
  )
}
