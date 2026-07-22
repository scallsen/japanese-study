import { FS_BASE, FS_CAPTION } from '../data/theme.js'

export default function DrawerCheckbox({ checked, onChange, label, subtext, indent = 0, disabled = false, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: indent * 16 }}>
      <label
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => { if (!disabled && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); onChange() } }}
        style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: disabled ? 'default' : 'pointer', userSelect: 'none', opacity: disabled ? 0.4 : 1 }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          tabIndex={-1}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        />
        <div style={{
          flexShrink: 0,
          marginTop: 1,
          width: 16,
          height: 16,
          border: checked ? 'none' : '1px solid rgba(255,255,255,0.35)',
          background: checked ? 'rgba(255,255,255,0.85)' : 'transparent',
          borderRadius: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 130ms',
        }}>
          {checked && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="#2E2E2E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: FS_BASE, fontFamily: 'inherit' }}>{label}</span>
          {subtext && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: FS_CAPTION, fontFamily: 'inherit' }}>{subtext}</span>}
        </div>
      </label>
      {children && <div style={{ paddingLeft: 26 }}>{children}</div>}
    </div>
  )
}
