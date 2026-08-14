import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { difficultyLabel } from './difficultyLabels.js'
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

function TrackedAnimeRow({ title, mediaType, coverUrl, difficulty, onOpen, onRemove }) {
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
      {coverUrl && (
        <img src={coverUrl} alt="" style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
      )}
      <span style={{
        fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: ACCENT,
        background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 4, padding: '1px 7px', flexShrink: 0,
      }}>
        {mediaType}
      </span>
      <span style={{ fontSize: FS_LIST_TITLE, color: TEXT, fontFamily: FONT, letterSpacing: TRACKING, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      {difficulty != null && (
        <span style={{
          fontSize: FS_BADGE, fontFamily: FONT, letterSpacing: TRACKING, color: ACCENT,
          background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, borderRadius: 4, padding: '1px 7px', flexShrink: 0,
        }}>
          {difficultyLabel(difficulty)} ({Number(difficulty).toFixed(1)})
        </span>
      )}
      <RemoveButton onClick={onRemove} />
    </div>
  )
}

// Presentational — tracked/untrack are lifted to AnimeVocabModule (which also
// needs the tracked list to decide the recommended-carousel empty state) so
// there's only one live useTrackedAnime()/useProgress() read per page load,
// not two. cover_url/difficulty aren't stored in the tracked payload itself
// (denormalized at track-time, would go stale) — fetched fresh here, keyed
// on the current tracked id list, mirroring media.difficulty's own
// refresh-on-reopen freshness rule (see anime-media-select).
export default function TrackedAnimeSection({ tracked, untrack }) {
  const [mediaById, setMediaById] = useState({})
  const ids = Object.keys(tracked)

  useEffect(() => {
    if (ids.length === 0 || !supabase) return
    let cancelled = false
    supabase.from('media').select('id, cover_url, difficulty').in('id', ids).then(({ data }) => {
      if (!cancelled && data) setMediaById(Object.fromEntries(data.map(m => [m.id, m])))
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')])

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
            title={entry.title}
            mediaType={entry.mediaType}
            coverUrl={mediaById[mediaId]?.cover_url}
            difficulty={mediaById[mediaId]?.difficulty?.difficulty}
            onOpen={() => { window.location.hash = `/anime-vocab/${mediaId}` }}
            onRemove={() => untrack(mediaId)}
          />
        ))}
      </div>
    </section>
  )
}
