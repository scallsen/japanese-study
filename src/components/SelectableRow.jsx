import { TRACKING } from '../data/theme.js'

const ACCENT = '#3ABDA4'

// Shared shell for a clickable, checkbox-selectable list row — click anywhere
// on the row (not just the checkbox) toggles selection via native <label>
// wrapping, and hover/selected visuals come from the .selectable-row classes
// in global.css. Callers supply their own row content as children.
export default function SelectableRow({ selected, onToggle, children, gap = 12, padding = '10px 14px', borderBottom = '1px solid rgba(255,255,255,0.05)' }) {
  return (
    <label
      className={selected ? 'selectable-row selectable-row--selected' : 'selectable-row'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap,
        padding,
        borderBottom,
        cursor: 'pointer',
        fontFamily: 'inherit',
        letterSpacing: TRACKING,
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        style={{ flexShrink: 0, width: 16, height: 16, margin: 0, accentColor: ACCENT }}
      />
      {children}
    </label>
  )
}
