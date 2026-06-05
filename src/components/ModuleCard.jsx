import { useState } from 'react'
import { FONT, TRACKING, TEXT, TEXT_MUTED } from '../data/theme.js'

function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
      <path d="M2 9L9 2M9 2H4M9 2V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function ModuleCard({ module, disabled }) {
  const { label, sublabel, href, external } = module
  const [hovered, setHovered] = useState(false)

  const Tag = disabled ? 'div' : 'a'
  const linkProps = disabled ? {} : {
    href,
    ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
  }

  return (
    <Tag
      {...linkProps}
      style={{
        display: 'block',
        background: hovered && !disabled ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)'}`,
        borderRadius: 6,
        padding: '20px 20px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 130ms, border-color 130ms',
        fontFamily: FONT,
        letterSpacing: TRACKING,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontSize: 16, color: hovered && !disabled ? 'rgba(255,255,255,0.85)' : TEXT, transition: 'color 130ms' }}>
          {label}
        </div>
        {external && <ExternalLinkIcon />}
      </div>
      <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 4 }}>
        {disabled && hovered ? `Sign in to access ${label}` : sublabel}
      </div>
    </Tag>
  )
}
