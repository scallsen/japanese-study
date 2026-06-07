import { useState } from 'react'
import { FONT, TRACKING, BORDER } from '../data/theme.js'

export default function PageHeader({ crumbs = [], rightSlot, noBorder, children }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

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
        {crumbs.flatMap((crumb, i) => {
          const isClickable = !!crumb.href || !!crumb.onClick
          const items = []
          if (i > 0) {
            items.push(
              <span key={`sep-${i}`} style={{ color: 'rgba(255,255,255,0.2)', fontSize: 16, margin: '0 6px' }}>
                /
              </span>
            )
          }
          const activeStyle = {
            color: hoveredIdx === i ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)',
            fontSize: 16,
            textDecoration: 'none',
            letterSpacing: TRACKING,
            transition: 'color 130ms',
            cursor: 'pointer',
          }
          items.push(
            isClickable ? (
              crumb.href ? (
                <a
                  key={`crumb-${i}`}
                  href={crumb.href}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={activeStyle}
                >
                  {crumb.label}
                </a>
              ) : (
                <span
                  key={`crumb-${i}`}
                  onClick={crumb.onClick}
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  style={activeStyle}
                >
                  {crumb.label}
                </span>
              )
            ) : (
              <span key={`crumb-${i}`} style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16 }}>
                {crumb.label}
              </span>
            )
          )
          return items
        })}
        {rightSlot && <div style={{ marginLeft: 'auto' }}>{rightSlot}</div>}
      </div>
      {children}
    </header>
  )
}
