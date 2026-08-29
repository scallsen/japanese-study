import { FONT, TRACKING, TEXT_MUTED, FS_BASE, SPACE_4, SPACE_8, SPACE_12 } from '../data/theme.js'
import { useAccent } from '../context/ModuleThemeContext.jsx'

// Reconciled from four independent implementations of the same visual
// language: MediaSearch's `Chip` (filter rows) and `ViewModeButton`,
// VocabModeToggle, and WordImportPanel's `TabButton`. They drifted on
// radius (4 vs 8), padding, and border opacity (0.12 vs 0.15).
// Radius 4 wins — three of the four already use it, and it matches Badge.
const SIZES = {
  sm: `${SPACE_4}px 11px`,          // filter chips — 11px is the real historical value
  md: `${SPACE_8}px ${SPACE_12}px`, // segmented toggles / tabs
}

// `destructiveHover`: while active, hovering warns that clicking removes/undoes
// rather than reinforcing the current state. Real for a removable filter chip
// and for ToggleButton's unfollow — the hover has to mean the opposite action,
// which no amount of resting-state styling can express.
export function Chip({ label, active, onClick, size = 'sm', accent: accentOverride, grow = false, disabled = false, destructiveHover = false }) {
  const accent = useAccent(accentOverride)
  const className = [
    'chip',
    active ? 'chip--on' : 'chip--off',
    destructiveHover ? 'chip--destructive' : null,
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{
        padding: SIZES[size] ?? SIZES.sm,
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: FS_BASE,
        fontFamily: FONT,
        letterSpacing: TRACKING,
        background: active ? `${accent}22` : 'transparent',
        color: active ? accent : TEXT_MUTED,
        border: `1px solid ${active ? `${accent}55` : 'rgba(255,255,255,0.12)'}`,
        flex: grow ? 1 : undefined,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  )
}

/**
 * A row of chips with a selection model. Three modes, because these are
 * genuinely different selection semantics — not three styles:
 *
 *  - `multi`     — independent toggles, any subset valid. `value` is a Set.
 *                  (media type, difficulty buckets, maturity filters)
 *  - `single`    — exactly one active, radio-style. `value` is one option value.
 *                  (tabs, view mode, Japanese→English direction)
 *  - `threshold` — ordered and cumulative: picking an option activates it AND
 *                  everything on one side of it, so the row reads as "this
 *                  and beyond". `value` is one option value. (JLPT minimum
 *                  level, where "N3" means N3/N2/N1 — rendering only N3 as
 *                  active would misrepresent what the filter actually does.)
 *                  `thresholdDirection` picks which way it fills: 'forward'
 *                  (default) fills toward the end of the list, 'backward'
 *                  toward the start. Which one is right depends purely on how
 *                  the caller ordered its options — a JLPT row written
 *                  N5→N1 fills forward, the same row written N1→N5 fills
 *                  backward — so it can't be inferred here.
 *
 * The accent comes from the surrounding ModuleThemeProvider, so chips match
 * whichever module they're rendered in without any call site passing it.
 * `accent` is available as an explicit override for one-offs.
 */
export default function ChipSelector({
  options,
  value,
  onChange,
  mode = 'multi',
  thresholdDirection = 'forward',
  size = 'sm',
  accent,
  grow = false,
  disabled = false,
}) {
  const thresholdIndex = mode === 'threshold' ? options.findIndex(o => o.value === value) : -1

  function isActive(option, i) {
    if (mode === 'multi') return value?.has(option.value) ?? false
    if (mode === 'threshold') {
      if (thresholdIndex === -1) return false
      return thresholdDirection === 'backward' ? i <= thresholdIndex : i >= thresholdIndex
    }
    return value === option.value
  }

  function handleClick(option) {
    if (mode !== 'multi') return onChange(option.value)
    const next = new Set(value)
    if (next.has(option.value)) next.delete(option.value)
    else next.add(option.value)
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE_8, flex: grow ? 1 : undefined, minWidth: 0 }}>
      {options.map((option, i) => (
        <Chip
          key={option.value}
          label={option.label}
          active={isActive(option, i)}
          onClick={() => handleClick(option)}
          size={size}
          accent={accent}
          grow={grow}
          disabled={disabled}
        />
      ))}
    </div>
  )
}
