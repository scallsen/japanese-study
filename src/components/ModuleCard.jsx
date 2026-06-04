import { useState } from 'react'
import { FONT, TRACKING, TEXT, TEXT_MUTED } from '../data/theme.js'

export default function ModuleCard({ module }) {
  const { label, sublabel, href, external } = module
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      style={{
        display: 'block',
        background: hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 6,
        padding: '20px 20px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 130ms',
        fontFamily: FONT,
        letterSpacing: TRACKING,
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontSize: 16, color: hovered ? 'rgba(255,255,255,0.85)' : TEXT, transition: 'color 130ms' }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 4 }}>
        {sublabel}
      </div>
    </a>
  )
}
