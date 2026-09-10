import { FONT, TRACKING, TEXT_MUTED, FS_BASE, LANTERN_ON, LANTERN_OFF, LANTERN_SIZES, LANTERN_ASPECT } from '../data/theme.js'

// Explains why a screen that's otherwise empty is taking a while — paired
// with useDelayedLoading so it only appears for genuinely slow loads, not
// every routine fetch.
//
// The lantern flicker (brand/BRAND.md §4: "Loading | lamp-on/lamp-off
// alternating, no spinner") replaces what used to be plain text with no
// indicator at all — this is the app's one shared loading component, so
// wiring it in here covers every caller (Dictionary, Anime Vocab, Immersion)
// without touching each one.
export default function CenteredLoadingMessage({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: TEXT_MUTED, fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING }}>
      {/* Sprite's viewBox is cropped to its true (non-square) bounds — height-only
          sizing on both stacked images, wrapper matched to the same real aspect
          ratio via LANTERN_ASPECT, so nothing stretches and nothing overflows it. */}
      <span style={{ position: 'relative', display: 'inline-block', width: LANTERN_SIZES.nav * LANTERN_ASPECT, height: LANTERN_SIZES.nav, marginBottom: 10 }}>
        <img src={LANTERN_ON} alt="" height={LANTERN_SIZES.nav} className="lantern-flicker-on" style={{ position: 'absolute', inset: 0, display: 'block', imageRendering: 'pixelated' }} />
        <img src={LANTERN_OFF} alt="" height={LANTERN_SIZES.nav} className="lantern-flicker-off" style={{ position: 'absolute', inset: 0, display: 'block', imageRendering: 'pixelated' }} />
      </span>
      <div>{text}</div>
    </div>
  )
}
