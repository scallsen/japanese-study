import { useAuth } from '../../context/AuthContext.jsx'
import { useTrackedAnime } from './useTrackedAnime.js'
import { difficultyLabel } from './difficultyLabels.js'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_BADGE, FS_LIST_TITLE } from '../../data/theme.js'
import ToggleButton from '../../components/ToggleButton.jsx'
import DataList from '../../components/DataList.jsx'
import Badge from '../../components/Badge.jsx'
import { useIsMobile } from '../../hooks/useIsMobile.js'

// Duplicated per-file (matches this module's own established convention —
// see e.g. AnimeVocabModule.jsx — each self-contained module keeps its own
// small copy rather than a shared hook).

function episodeColumns(isMobile) {
  return [
    {
      key: 'title',
      flex: 1,
      render: ep => (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 2 : 12, minWidth: 0, width: '100%' }}>
          <span style={{ fontSize: FS_LIST_TITLE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
            {ep.title || `Episode ${ep.episode_number}`}
          </span>
          {ep.unique_word_count != null && (
            <span style={{ fontSize: FS_BASE, color: TEXT_MUTED, flexShrink: 0 }}>{ep.unique_word_count} unique words</span>
          )}
        </div>
      ),
    },
    {
      key: 'difficulty',
      width: 110,
      align: 'right',
      render: ep => ep.difficulty?.difficulty != null && (
        <Badge tone="accent">{difficultyLabel(ep.difficulty.difficulty)} ({Number(ep.difficulty.difficulty).toFixed(1)})</Badge>
      ),
    },
  ]
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
                <Badge tone="accent">{difficultyLabel(showDifficulty)} ({Number(showDifficulty).toFixed(1)})</Badge>
              </div>
            )}
          </div>
          <ToggleButton
            active={tracked}
            labels={{ on: 'Unfollow', off: 'Follow' }}
            activeTone="success"
            destructiveHover
            disabled={!user}
            onClick={handleToggleTrack}
          />
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

      <DataList
        columns={episodeColumns(isMobile)}
        rows={episodes}
        maxWidth="100%"
        navigate={{ onClick: onSelectEpisode }}
      />
    </div>
  )
}
