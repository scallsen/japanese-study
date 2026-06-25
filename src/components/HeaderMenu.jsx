import { useState, useEffect, useRef } from 'react'
import { FONT, TRACKING } from '../data/theme.js'

const NARROW_BP = 540

const ghostBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8, cursor: 'pointer',
  fontFamily: FONT, letterSpacing: TRACKING,
  transition: 'background 130ms',
  color: 'rgba(255,255,255,0.7)',
}

// items: [{ label, icon?, desktopLabel?, onClick, dim? }]
// - icon present → renders as 34x34 icon button on desktop; icon + label in dropdown
// - no icon → renders as text button on desktop using desktopLabel ?? label
export default function HeaderMenu({ primary, items = [] }) {
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW_BP)
  const [open, setOpen] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [dropHoveredIdx, setDropHoveredIdx] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW_BP - 1}px)`)
    const handler = e => { setNarrow(e.matches); setOpen(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    const close = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  if (!narrow) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {items.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              ...ghostBtn,
              background: hoveredIdx === i ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
              ...(item.icon ? { width: 34, height: 34, padding: 0 } : { height: 34, padding: '0 12px', fontSize: 13 }),
              ...(item.dim ? { opacity: 0.35 } : {}),
            }}
          >
            {item.icon ?? (item.desktopLabel ?? item.label)}
          </button>
        ))}
        {primary}
      </div>
    )
  }

  return (
    <div ref={menuRef} style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
      {items.length > 0 && (
        <button
          onClick={() => setOpen(v => !v)}
          onMouseEnter={() => setHoveredIdx('dots')}
          onMouseLeave={() => setHoveredIdx(null)}
          style={{
            ...ghostBtn,
            background: open || hoveredIdx === 'dots' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
            width: 34, height: 34, padding: 0, fontSize: 16,
          }}
        >
          …
        </button>
      )}
      {primary}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          background: '#2A2A2A',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 10,
          minWidth: 160,
          zIndex: 100,
          overflow: 'hidden',
        }}>
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { item.onClick(); setOpen(false) }}
              onMouseEnter={() => setDropHoveredIdx(i)}
              onMouseLeave={() => setDropHoveredIdx(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%',
                background: dropHoveredIdx === i ? 'rgba(255,255,255,0.07)' : 'none',
                border: 'none',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                padding: '12px 16px',
                fontFamily: FONT, letterSpacing: TRACKING,
                fontSize: 14,
                color: 'rgba(255,255,255,0.75)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 100ms',
                ...(item.dim ? { opacity: 0.5 } : {}),
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
