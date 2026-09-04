import { useRef, useEffect } from 'react'
import { useAccent } from '../context/ModuleThemeContext.jsx'

// Chrome always draws the native indeterminate dash in white regardless of
// accent-color, so a custom-drawn box is the only way to make it match the
// black checkmark on checked boxes. The native input stays underneath
// (visually hidden) for click/keyboard/screen-reader behavior, including
// the "indeterminate" DOM property, which can only be set imperatively.
export default function SelectAllCheckbox({ checked, indeterminate, onChange }) {
  const ACCENT = useAccent()
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <label style={{ position: 'relative', width: 16, height: 16, flexShrink: 0, display: 'inline-flex', cursor: 'pointer' }}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ position: 'absolute', inset: 0, margin: 0, opacity: 0, cursor: 'pointer' }}
      />
      <span style={{
        width: 16,
        height: 16,
        borderRadius: 3,
        background: checked || indeterminate ? ACCENT : 'transparent',
        border: checked || indeterminate ? 'none' : '1px solid rgba(255,255,255,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {(checked || indeterminate) && (
          <svg width={16} height={16} viewBox="0 0 16 16" style={{ display: 'block' }}>
            {indeterminate && !checked ? (
              <line x1={4} y1={8} x2={12} y2={8} stroke="#3B3B3B" strokeWidth={2.4} strokeLinecap="round" />
            ) : (
              <polyline points="3.5,8.3 6.5,11.3 12.5,4.7" fill="none" stroke="#3B3B3B" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        )}
      </span>
    </label>
  )
}
