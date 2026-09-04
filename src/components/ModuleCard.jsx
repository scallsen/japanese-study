import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE } from '../data/theme.js'

function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
      <path d="M2 9L9 2M9 2H4M9 2V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Hover lives in global.css (.module-card) — the useState hover this used to
// carry is the StrictMode double-invoke hazard every other component fixed.
export default function ModuleCard({ module, disabled }) {
  const { label, sublabel, icon, href, external } = module

  const Tag = disabled ? 'div' : 'a'
  const linkProps = disabled ? {} : {
    href,
    ...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
  }

  return (
    <Tag
      {...linkProps}
      className={disabled ? 'module-card module-card--disabled' : 'module-card'}
      style={{
        display: 'flex',
        flexDirection: 'column',
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
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: FS_BASE, color: TEXT }}>
              {label}
            </div>
            {external && <ExternalLinkIcon />}
          </div>
          <div style={{ fontSize: FS_BASE, color: TEXT_MUTED, marginTop: 4 }}>
            {sublabel}
          </div>
        </div>
        {icon && (
          <img src={icon} alt="" style={{ width: 36, height: 36, flexShrink: 0 }} />
        )}
      </div>
    </Tag>
  )
}
