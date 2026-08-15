import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTrackedAnime } from './useTrackedAnime.js'
import { difficultyLabel } from './difficultyLabels.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_LIST_TITLE } from '../../data/theme.js'

const ACCENT = '#D46EA3'
const TRACKED_COLOR = '#6BCB6B'
const REMOVE_COLOR = '#f87171'

// Duplicated per-file (matches this module's own established convention —
// see e.g. AnimeVocabModule.jsx — each self-contained module keeps its own
// small copy rather than a shared hook).
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

function EpisodeRow({ episode, onClick, isMobile }) {
  const [hovered, setHovered] = useState(false)
  const difficulty = episode.difficulty?.difficulty
  const wordCount = episode.unique_word_count != null && (
    <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING, flexShrink: 0 }}>
      {episode.unique_word_count} unique words
    </span>
  )
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
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 4 : 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ fontSize: FS_LIST_TITLE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {episode.title || `Episode ${episode.episode_number}`}
        </span>
        {!isMobile && wordCount}
        {difficulty != null && (
          <span style={{
            fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: ACCENT,
            background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 4, padding: '1px 7px', flexShrink: 0,
          }}>
            {difficultyLabel(difficulty)} ({Number(difficulty).toFixed(1)})
          </span>
        )}
      </div>
      {isMobile && wordCount}
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
        Follow
      </button>
    )
  }

  const label = tracked ? 'Unfollow' : 'Follow'
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

// Temporarily disabled — flip back to true to bring the related-decks
// row back once its display is revisited.
const SHOW_RELATED = false

export default function EpisodeList({ media, episodes, onSelectEpisode }) {
  const { user } = useAuth()
  const { isTracked, track, untrack } = useTrackedAnime()
  const tracked = isTracked(media.id)
  const isMobile = useIsMobile()

  function handleToggleTrack() {
    if (!user) return
    if (tracked) untrack(media.id); else track(media)
  }

  const showDifficulty = media.difficulty?.difficulty
  const showOriginalTitle = media.originalTitle && media.originalTitle !== media.title
  const tags = (media.tags ?? []).slice(0, MAX_TAGS_SHOWN)
  const relationships = SHOW_RELATED ? (media.relationships ?? []).slice(0, MAX_RELATED_SHOWN) : []
  const links = media.links ?? []
  const showLinksRow = !!media.externalId || links.length > 0

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {media.coverUrl && (
          <img src={media.coverUrl} alt="" style={{ width: 96, height: 135, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, minWidth: 0 }}>
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: FS_LIST_TITLE + 8, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, lineHeight: 1.25 }}>
              {media.title}
            </div>
            {showOriginalTitle && (
              <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
                {media.originalTitle}
              </div>
            )}
            <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: TRACKING }}>
              {episodes.length} episode{episodes.length === 1 ? '' : 's'}
            </div>
            {showDifficulty != null && (
              <div>
                <span style={{
                  fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: ACCENT,
                  background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 4, padding: '1px 7px',
                }}>
                  {difficultyLabel(showDifficulty)} ({Number(showDifficulty).toFixed(1)})
                </span>
              </div>
            )}
          </div>
          <TrackToggle tracked={tracked} signedIn={!!user} onClick={handleToggleTrack} />
        </div>
      </div>

      {media.description && (
        <div style={{ fontSize: FS_BASE, color: TEXT, fontFamily: FONT, letterSpacing: 'normal', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
          {media.description}
        </div>
      )}

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
          <EpisodeRow key={ep.id} episode={ep} onClick={() => onSelectEpisode(ep)} isMobile={isMobile} />
        ))}
      </div>
    </div>
  )
}
