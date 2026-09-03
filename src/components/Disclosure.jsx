import { useState } from 'react'
import { FONT, TRACKING, TEXT_MUTED, FS_BASE, SPACE_8, SPACE_12 } from '../data/theme.js'

// A "▶ Label" toggle that reveals its children — Immersion's English
// summary. Uncontrolled by default; pass `open`/`onToggle` to control it.
export default function Disclosure({ label, open: controlledOpen, onToggle, defaultOpen = false, children }) {
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const open = controlledOpen ?? localOpen
  const toggle = () => (onToggle ? onToggle(!open) : setLocalOpen(o => !o))

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="disclosure-btn"
        style={{
          display: 'flex', alignItems: 'center', gap: SPACE_8,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: FS_BASE, fontFamily: FONT, letterSpacing: TRACKING, color: TEXT_MUTED,
        }}
      >
        <span style={{ transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 150ms' }}>▶</span>
        {label}
      </button>
      {open && <div style={{ marginTop: SPACE_12 }}>{children}</div>}
    </div>
  )
}
