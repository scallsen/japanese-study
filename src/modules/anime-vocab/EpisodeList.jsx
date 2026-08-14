import { useState } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTrackedAnime } from './useTrackedAnime.js'
import { difficultyLabel } from './difficultyLabels.js'
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
          {difficultyLabel(difficulty)} ({Number(difficulty).toFixed(1)})
        </span>
      )}
    </div>
  )
}

function TrackToggle({ tracked, signedIn, onClick }) {
  const [hovered, setHovered] = useState(false)

  if (!signedIn) {
    return (
      <button
        disabled
        style={{
          padding: '8px 14px', borderRadius: 6, cursor: 'not-allowed', background: 'transparent',
          fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0,
          color: TEXT_MUTED, border: `1px solid ${TEXT_MUTED}55`, opacity: 0.6,
        }}
      >
        Sign in to track this series
      </button>
    )
  }

  const label = tracked ? (hovered ? 'Remove tracking' : '✓ Tracking') : '+ Track this series'
  const color = tracked ? (hovered ? REMOVE_COLOR : TRACKED_COLOR) : ACCENT

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

const LINK_TYPE_LABELS = { 4: 'AniList', 5: 'MyAnimeList' }

function linkLabel(link) {
  if (LINK_TYPE_LABELS[link.linkType]) return LINK_TYPE_LABELS[link.linkType]
  try { return new URL(link.url).hostname.replace(/^www\./, '') } catch { return 'Link' }
}

function HeaderLink({ href, label }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, fontSize: FS_BASE, textDecoration: 'none' }}
      onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
      onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
    >
      {label}
    </a>
  )
}

function TagPill({ label }) {
  return (
    <span style={{
      fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT_MUTED,
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '2px 8px',
    }}>
      {label}
    </span>
  )
}

function RelatedPill({ title, mediaType }) {
  return (
    <span style={{
      fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT_MUTED,
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '2px 8px',
    }}>
      {title} <span style={{ opacity: 0.6 }}>· {mediaType}</span>
    </span>
  )
}

// Tags/relationships can run into the dozens for a well-indexed show —
// capped here to keep the header from sprawling; both arrays already come
// back ordered by relevance (tags by Jiten's own percentage, relationships
// in provider order).
const MAX_TAGS_SHOWN = 8
const MAX_RELATED_SHOWN = 6

export default function EpisodeList({ media, episodes, onSelectEpisode }) {
  const { user } = useAuth()
  const { isTracked, track, untrack } = useTrackedAnime()
  const tracked = isTracked(media.id)

  function handleToggleTrack() {
    if (!user) return
    if (tracked) untrack(media.id); else track(media)
  }

  const showDifficulty = media.difficulty?.difficulty
  const showOriginalTitle = media.originalTitle && media.originalTitle !== media.title
  const tags = (media.tags ?? []).slice(0, MAX_TAGS_SHOWN)
  const relationships = (media.relationships ?? []).slice(0, MAX_RELATED_SHOWN)
  const links = media.links ?? []
  const showLinksRow = !!media.externalId || links.length > 0

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, minWidth: 0 }}>
          {media.coverUrl && (
            <img src={media.coverUrl} alt="" style={{ width: 96, height: 135, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: FS_LIST_TITLE + 8, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, lineHeight: 1.25 }}>
              {media.title}
            </div>
            {showOriginalTitle && (
              <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
                {media.originalTitle}
              </div>
            )}
            {media.description && (
              <div style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: 'normal', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {media.description}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
              {episodes.length} episode{episodes.length === 1 ? '' : 's'}
              {showDifficulty != null && (
                <span style={{
                  fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: ACCENT,
                  background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 4, padding: '1px 7px', flexShrink: 0,
                }}>
                  {difficultyLabel(showDifficulty)} ({Number(showDifficulty).toFixed(1)})
                </span>
              )}
            </div>
          </div>
        </div>
        <TrackToggle tracked={tracked} signedIn={!!user} onClick={handleToggleTrack} />
      </div>

      {(tags.length > 0 || relationships.length > 0 || showLinksRow) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tags.map(t => <TagPill key={t.name} label={t.name} />)}
            </div>
          )}
          {relationships.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {relationships.map(r => <RelatedPill key={r.externalId} title={r.title} mediaType={r.mediaType} />)}
            </div>
          )}
          {showLinksRow && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {media.externalId && (
                <HeaderLink href={`https://jiten.moe/decks/media/${media.externalId}/detail`} label="Jiten ↗" />
              )}
              {links.map(l => (
                <HeaderLink key={l.url} href={l.url} label={`${linkLabel(l)} ↗`} />
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {episodes.map(ep => (
          <EpisodeRow key={ep.id} episode={ep} onClick={() => onSelectEpisode(ep)} />
        ))}
      </div>
    </div>
  )
}
