import { useState } from 'react'
import PageHeader from '../components/PageHeader.jsx'
import DrillButtonRow, { DrillButton } from '../components/DrillButton.jsx'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, DRILL_COLORS, DRILL_ROW_WIDTH } from '../data/theme.js'

const CARD_BG = '#E8E4DE'

function MockCard({ flipped, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: DRILL_ROW_WIDTH,
        aspectRatio: '380 / 280',
        background: CARD_BG,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
        fontSize: 44,
        color: '#222',
        cursor: 'pointer',
        boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
      }}
    >
      {flipped ? 'かかわる' : '関わる'}
    </div>
  )
}

// hintMode: 'device' (Option A — shown on desktop, hidden on mobile) | 'never' (Option B — always hidden)
function DrillDemo({ label, hintMode, deviceMobile }) {
  const [flipped, setFlipped] = useState(false)
  const showHint = hintMode === 'device' ? !deviceMobile : false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 24, background: '#242424', borderRadius: 12, width: 380 + 48 }}>
      <div style={{ color: TEXT_MUTED, fontSize: FS_BASE, textAlign: 'center' }}>{label}</div>
      <MockCard flipped={flipped} onClick={() => setFlipped(f => !f)} />
      {!flipped ? (
        <DrillButtonRow placeholder="Space or tap to flip" />
      ) : (
        <DrillButtonRow>
          <DrillButton label="Again" hint={showHint ? '1' : null} color={DRILL_COLORS.again} onClick={() => setFlipped(false)} />
          <DrillButton label="Hard" hint={showHint ? '2' : null} color={DRILL_COLORS.hard} onClick={() => setFlipped(false)} />
          <DrillButton label="Good" hint={showHint ? '3' : null} color={DRILL_COLORS.good} onClick={() => setFlipped(false)} />
          <DrillButton label="Easy" hint={showHint ? '4' : null} color={DRILL_COLORS.easy} onClick={() => setFlipped(false)} />
        </DrillButtonRow>
      )}
    </div>
  )
}

// Dev-only comparison harness for the Review card's flip-position fix: the
// judgment-button row now shares DRILL_ROW_HEIGHT with the pre-flip
// placeholder (click either card below and watch nothing else move), and
// compares the two remaining options for the keyboard-shortcut hint ("[1]"
// etc) now that the interval sublabel is gone. Not linked from the dashboard.
export default function DrillFlipLabPage() {
  const [deviceMobile, setDeviceMobile] = useState(false)

  return (
    <div style={{ minHeight: '100%', background: '#1E1E1E', color: TEXT, fontFamily: FONT, letterSpacing: TRACKING }}>
      <PageHeader crumbs={[{ label: 'Japanese Study', href: '#/' }, { label: 'Drill flip layout lab' }]} />
      <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
        <p style={{ color: TEXT_MUTED, fontSize: FS_BASE, lineHeight: 1.6 }}>
          Click a card to flip it. The button row now reserves the same height as the
          placeholder, so the card above it doesn&apos;t move. Toggle &quot;mobile&quot; below to compare
          the two options for the keyboard-shortcut hint.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: FS_BASE, margin: '16px 0 24px' }}>
          <input type="checkbox" checked={deviceMobile} onChange={e => setDeviceMobile(e.target.checked)} />
          Simulate mobile (no physical keyboard)
        </label>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <DrillDemo label="Option A — hint follows device (hidden when “mobile” is checked)" hintMode="device" deviceMobile={deviceMobile} />
          <DrillDemo label="Option B — hint always hidden" hintMode="never" deviceMobile={deviceMobile} />
        </div>
      </div>
    </div>
  )
}
