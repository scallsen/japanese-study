import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase.js'
import { difficultyLabel } from './difficultyLabels.js'
import { FONT, TEXT_MUTED, SUBHEADING_STYLE, FS_LIST_TITLE } from '../../data/theme.js'
import DataList from '../../components/DataList.jsx'
import Badge from '../../components/Badge.jsx'
import Button from '../../components/Button.jsx'

const TRACKED_COLUMNS = [
  {
    key: 'cover', width: 40,
    render: row => row.coverUrl && <img src={row.coverUrl} alt="" style={{ width: 40, height: 56, objectFit: 'cover', borderRadius: 4 }} />,
  },
  { key: 'mediaType', width: 70, render: row => <Badge tone="accent">{row.mediaType}</Badge> },
  { key: 'title', flex: 1, fontSize: FS_LIST_TITLE },
  {
    key: 'difficulty', width: 110,
    render: row => row.difficulty != null && <Badge tone="accent">{difficultyLabel(row.difficulty)} ({Number(row.difficulty).toFixed(1)})</Badge>,
  },
  {
    key: 'remove', width: 30, align: 'center',
    render: row => (
      <Button
        variant="ghost-muted"
        icon="×"
        label="Stop tracking"
        onClick={e => { e.stopPropagation(); row.onRemove() }}
      />
    ),
  },
]

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

  const rows = entries.map(([mediaId, entry]) => ({
    id: mediaId,
    title: entry.title,
    mediaType: entry.mediaType,
    coverUrl: mediaById[mediaId]?.cover_url,
    difficulty: mediaById[mediaId]?.difficulty?.difficulty,
    onRemove: () => untrack(mediaId),
  }))

  return (
    <section style={{ maxWidth: 640, margin: '0 auto 20px' }}>
      <div style={{ ...SUBHEADING_STYLE, color: TEXT_MUTED, fontFamily: FONT, marginBottom: 10 }}>
        Currently studying
      </div>
      <DataList
        columns={TRACKED_COLUMNS}
        rows={rows}
        maxWidth="100%"
        navigate={{ onClick: row => { window.location.hash = `/anime-vocab/${row.id}` } }}
      />
    </section>
  )
}
