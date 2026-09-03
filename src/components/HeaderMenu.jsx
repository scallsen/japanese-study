import { useState, useEffect, useRef } from 'react'
import { FONT, TRACKING, FS_BASE, FS_NAV } from '../data/theme.js'

const NARROW_BP = 540

// Hover/open backgrounds are CSS classes (.header-menu-btn, .header-menu-item
// in global.css) per the no-useState-hover rule; the resting background is
// set there too so the hover rule doesn't need !important.
const ghostBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8, cursor: 'pointer',
  fontFamily: FONT, letterSpacing: TRACKING,
  color: 'rgba(255,255,255,0.7)',
}

// The text-pill button HeaderMenu's own items use, exported for the
// "Options" toggle every drill screen passes as `primary` — VocabPage,
// VocabSrsModule and VocabSrsDrill each hand-rolled this exact button.
export function HeaderMenuButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="header-menu-btn"
      style={{ ...ghostBtn, height: 34, padding: '0 12px', fontSize: FS_BASE }}
    >
      {children}
    </button>
  )
}

// items: [{ label, icon?, desktopLabel?, onClick, dim? }]
// - icon present → renders as 34x34 icon button on desktop; icon + label in dropdown
// - no icon → renders as text button on desktop using desktopLabel ?? label
export default function HeaderMenu({ primary, items = [] }) {
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW_BP)
  const [open, setOpen] = useState(false)
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
            className="header-menu-btn"
            style={{
              ...ghostBtn,
              ...(item.icon ? { width: 34, height: 34, padding: 0 } : { height: 34, padding: '0 12px', fontSize: FS_BASE }),
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
          className={open ? 'header-menu-btn header-menu-btn--open' : 'header-menu-btn'}
          style={{
            ...ghostBtn,
            width: 34, height: 34, padding: 0, fontSize: FS_NAV,
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
              className="header-menu-item"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%',
                border: 'none',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                padding: '12px 16px',
                fontFamily: FONT, letterSpacing: TRACKING,
                fontSize: FS_BASE,
                color: 'rgba(255,255,255,0.75)',
                cursor: 'pointer',
                textAlign: 'left',
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
