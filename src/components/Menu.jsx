import { FONT, TRACKING, TEXT, FS_BASE } from '../data/theme.js'

const ROW_HAIRLINE = 'rgba(255,255,255,0.06)'

/**
 * A short list of actions, for use inside a `Popover` (which gives it a
 * popover on desktop and a bottom sheet on mobile).
 *
 * Distinct from `OptionPicker`, which is a *searchable* list and always
 * renders its search field: a search box above two actions would be absurd.
 * The row treatment is deliberately identical to OptionPicker's, so the two
 * read as the same kind of surface.
 *
 * `items`: [{ id, label }] — no icons, no variants until a real call site
 * needs them.
 */
export default function Menu({ items, onSelect }) {
  return (
    <div role="menu" style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, i) => (
        <button
          key={item.id}
          role="menuitem"
          onClick={() => onSelect(item.id)}
          className="menu-item"
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '10px 12px',
            background: 'transparent',
            border: 'none',
            // The container draws the outer edge; a divider under the last row
            // doubles up against it and reads as a 2px seam.
            borderBottom: i === items.length - 1 ? 'none' : `1px solid ${ROW_HAIRLINE}`,
            color: TEXT,
            fontFamily: FONT,
            fontSize: FS_BASE,
            letterSpacing: TRACKING,
            cursor: 'pointer',
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
