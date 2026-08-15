import { FONT, TRACKING, TEXT_MUTED, FS_BASE } from '../data/theme.js'

// Explains why a screen that's otherwise empty is taking a while — paired
// with useDelayedLoading so it only appears for genuinely slow loads, not
// every routine fetch.
export default function CenteredLoadingMessage({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: TEXT_MUTED, fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING }}>
      {text}
    </div>
  )
}
