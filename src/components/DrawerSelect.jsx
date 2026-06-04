export default function DrawerSelect({ value, onChange, options, label, subtext }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>{label}</span>}
      {subtext && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: 'inherit' }}>{subtext}</span>}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.65)',
            fontSize: 13,
            fontFamily: 'inherit',
            padding: '5px 28px 5px 10px',
            cursor: 'pointer',
            minWidth: 90,
            lineHeight: '1.4',
            width: '100%',
          }}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} style={{ background: '#2E2E2E', color: '#fff' }}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg style={{ position: 'absolute', right: 8, pointerEvents: 'none' }} width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
