import { FONT, TRACKING, TEXT_MUTED, FS_BASE, LANTERN_ON, LANTERN_SIZES } from '../data/theme.js'

// Explains why a screen that's otherwise empty is taking a while — paired
// with useDelayedLoading so it only appears for genuinely slow loads, not
// every routine fetch.
//
// The lantern pulse (brand/BRAND.md §4: "Loading | lamp pulsing, no
// spinner") replaces what used to be plain text with no indicator at all —
// this is the app's one shared loading component, so wiring it in here
// covers every caller (Dictionary, Anime Vocab, Immersion) without touching
// each one. A single lit sprite breathing in opacity + a synced soft glow
// (`.lantern-pulse`, global.css) — not a crossfade with the off sprite, see
// the class's own comment for why. Explored against the original hard
// on/off flicker at #/dev/accent-polish before landing here.
export default function CenteredLoadingMessage({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: TEXT_MUTED, fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING }}>
      <img src={LANTERN_ON} alt="" width={LANTERN_SIZES.nav} height={LANTERN_SIZES.nav} className="lantern-pulse" style={{ display: 'block', margin: '0 auto 10px', imageRendering: 'pixelated' }} />
      <div>{text}</div>
    </div>
  )
}
