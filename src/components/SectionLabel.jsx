import { FONT, TEXT_MUTED, FS_BADGE, SPACE_8 } from '../data/theme.js'

// Small uppercase label with a trailing hairline — separates groups *inside*
// page content (Dictionary's Kanji / Words / Your Decks, Vocab Drill's
// Preview groups by sublist). Distinct from SectionHeader, which is the
// larger heading a settings drawer or done-screen uses, with an action slot
// instead of a divider. Promoted from pages/dictionaryShared.jsx once the
// Vocab Drill rebuild became its second consumer.
export default function SectionLabel({ label, marginTop = 4 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE_8, marginBottom: SPACE_8, marginTop }}>
      <span style={{ fontSize: FS_BADGE, color: TEXT_MUTED, fontFamily: FONT, letterSpacing: '0.08em', opacity: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  )
}
