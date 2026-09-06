import { useAccent } from '../context/ModuleThemeContext.jsx'

// A binary on/off indicator for a settings row. Distinct from the two
// neighbours it could be confused with:
//
//  - Not `ToggleButton`. That renames itself between states (Follow /
//    Unfollow, On / Off) and is a standalone action. A switch keeps the
//    row's label as its name and only reports state, which is what a list
//    of settings needs — the label column stays scannable because nothing
//    in it changes as you toggle.
//  - Not `Checkbox`. Checkbox leads with its control and carries its own
//    label and subtext, for opting into things inside a form. This trails a
//    row whose label lives on the left.
//
// The track takes the module accent, so a switch in Anime Vocab is pink for
// the same reason its chips are.
export default function Switch({ checked, onChange, disabled = false, accent: accentOverride, label }) {
  const accent = useAccent(accentOverride)

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="switch"
      style={{
        background: 'none', border: 'none', padding: 0, display: 'flex',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span
        className="switch-track"
        style={{
          position: 'relative', display: 'inline-block', width: 38, height: 22, borderRadius: 11,
          background: checked ? accent : 'rgba(255,255,255,0.16)',
          border: `1px solid ${checked ? accent : 'rgba(255,255,255,0.2)'}`,
          transition: 'background 140ms, border-color 140ms',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: '50%',
          background: checked ? '#fff' : 'rgba(255,255,255,0.55)',
          transition: 'left 140ms, background 140ms',
        }} />
      </span>
    </button>
  )
}
