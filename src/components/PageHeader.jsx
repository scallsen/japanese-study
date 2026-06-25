import { useState, useEffect } from 'react'
import { FONT, TRACKING, BORDER, FS_NAV } from '../data/theme.js'

const NARROW_BP = 540

export default function PageHeader({ crumbs = [], rightSlot, noBorder, children }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [narrow, setNarrow] = useState(() => window.innerWidth < NARROW_BP)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW_BP - 1}px)`)
    const handler = e => setNarrow(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const crumbStyle = (hovered) => ({
    color: hovered ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)',
    fontSize: FS_NAV,
    textDecoration: 'none',
    letterSpacing: TRACKING,
    transition: 'color 130ms',
    cursor: 'pointer',
  })

  const sep = (key) => (
    <span key={key} style={{ color: 'rgba(255,255,255,0.2)', fontSize: FS_NAV, margin: '0 6px' }}>/</span>
  )

  let crumbNodes
  if (narrow && crumbs.length > 1) {
    const parent = crumbs[crumbs.length - 2]
    const current = crumbs[crumbs.length - 1]
    const backNode = parent.href ? (
      <a
        key="back"
        href={parent.href}
        onMouseEnter={() => setHoveredIdx(-1)}
        onMouseLeave={() => setHoveredIdx(null)}
        style={crumbStyle(hoveredIdx === -1)}
      >
        ←
      </a>
    ) : (
      <span
        key="back"
        onClick={parent.onClick}
        onMouseEnter={() => setHoveredIdx(-1)}
        onMouseLeave={() => setHoveredIdx(null)}
        style={crumbStyle(hoveredIdx === -1)}
      >
        ←
      </span>
    )
    crumbNodes = [
      backNode,
      sep('sep'),
      <span key="current" style={{ color: 'rgba(255,255,255,0.85)', fontSize: FS_NAV }}>
        {current.label}
      </span>,
    ]
  } else {
    crumbNodes = crumbs.flatMap((crumb, i) => {
      const isClickable = !!crumb.href || !!crumb.onClick
      const items = []
      if (i > 0) items.push(sep(`sep-${i}`))
      items.push(
        isClickable ? (
          crumb.href ? (
            <a
              key={`crumb-${i}`}
              href={crumb.href}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={crumbStyle(hoveredIdx === i)}
            >
              {crumb.label}
            </a>
          ) : (
            <span
              key={`crumb-${i}`}
              onClick={crumb.onClick}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={crumbStyle(hoveredIdx === i)}
            >
              {crumb.label}
            </span>
          )
        ) : (
          <span key={`crumb-${i}`} style={{ color: 'rgba(255,255,255,0.85)', fontSize: FS_NAV }}>
            {crumb.label}
          </span>
        )
      )
      return items
    })
  }

  return (
    <header style={{
      display: 'flex',
      flexDirection: 'column',
      borderBottom: noBorder ? undefined : `1px solid ${BORDER}`,
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 64,
        padding: '0 24px',
        fontFamily: FONT,
        letterSpacing: TRACKING,
      }}>
        {crumbNodes}
        {rightSlot && <div style={{ marginLeft: 'auto' }}>{rightSlot}</div>}
      </div>
      {children}
    </header>
  )
}
