const TRACK_BG = 'rgba(255,255,255,0.08)'

// Thin bar meant to render as a PageHeader child (same slot/position as Vocab
// Drill's session-progress bar). Two modes:
//   - `progress` (0-1): determinate fill, e.g. a drill session's completion.
//   - `loading`: indeterminate — a segment sweeps left-to-right on a loop.
// Callers using `loading` should gate it through useDelayedLoading first so
// this never flashes for near-instant operations — this component itself
// has no opinion on timing, only on how to render whichever mode it's given.
export default function TopProgressBar({ progress, loading, color = '#3ABDA4' }) {
  if (progress == null && !loading) return null

  return (
    <div style={{ height: 3, background: TRACK_BG, overflow: 'hidden', position: 'relative' }}>
      {progress != null ? (
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(1, progress)) * 100}%`, background: color, transition: 'width 300ms ease' }} />
      ) : (
        <div className="top-progress-sweep" style={{ position: 'absolute', top: 0, height: '100%', width: '40%', background: color }} />
      )}
    </div>
  )
}
