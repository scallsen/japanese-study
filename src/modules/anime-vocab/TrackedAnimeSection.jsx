import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { difficultyLabel } from './difficultyLabels.js'
import { FONT, TEXT_MUTED, SUBHEADING_STYLE } from '../../data/theme.js'
import PinnedShelf from '../../components/PinnedShelf.jsx'

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

  const items = entries.map(([mediaId, entry]) => {
    const difficulty = mediaById[mediaId]?.difficulty?.difficulty
    return {
      id: mediaId,
      title: entry.title,
      coverUrl: mediaById[mediaId]?.cover_url,
      badges: [
        { label: entry.mediaType, tone: 'accent' },
        ...(difficulty != null ? [{ label: `${difficultyLabel(difficulty)} (${Number(difficulty).toFixed(1)})`, tone: 'accent' }] : []),
      ],
    }
  })

  return (
    <section style={{ maxWidth: 640, margin: '0 auto 20px' }}>
      <div style={{ ...SUBHEADING_STYLE, color: TEXT_MUTED, fontFamily: FONT, marginBottom: 10 }}>
        Currently studying
      </div>
      <PinnedShelf
        items={items}
        onSelect={item => { window.location.hash = `/anime-vocab/${item.id}` }}
        onRemove={untrack}
      />
    </section>
  )
}
