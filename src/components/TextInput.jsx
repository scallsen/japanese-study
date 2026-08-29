import { forwardRef } from 'react'
import { FONT, TEXT, FS_BASE, SPACE_4, SPACE_8, SPACE_12, SPACE_16 } from '../data/theme.js'

// Reconciled from the four real text inputs in the app: MediaSearch's
// prominent search box (lg), DeckPickerSheet's "Deck name" field (md),
// DataList's editable cells (sm), and DataList's own search row (bare).
//
// `bare` exists because an input sitting *inside* an already-bordered
// container (a list's search row) must not draw a second border — that's a
// structural difference, not a style preference.
const VARIANTS = {
  default: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 6,
  },
  bare: {
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
  },
}

const SIZES = {
  sm: `${SPACE_4}px ${SPACE_8}px`,
  md: `${SPACE_8}px ${SPACE_12}px`,
  lg: `${SPACE_12}px ${SPACE_16}px`,
}

// forwardRef so callers can focus it imperatively — DeckComboBox focuses its
// search field on the frame after its popover opens, which autoFocus can't
// express reliably for an element that mounts mid-animation.
const TextInput = forwardRef(function TextInput({
  value,
  onChange,
  placeholder,
  variant = 'default',
  size = 'md',
  type = 'text',
  disabled = false,
  autoFocus = false,
  onKeyDown,
  fullWidth = true,
  style,
}, ref) {
  return (
    <input
      ref={ref}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className="text-input"
      style={{
        ...VARIANTS[variant] ?? VARIANTS.default,
        padding: SIZES[size] ?? SIZES.md,
        width: fullWidth ? '100%' : undefined,
        color: TEXT,
        fontFamily: FONT,
        fontSize: FS_BASE,
        // Japanese text is entered here — TRACKING's 0.05em looks wrong on
        // input text mid-composition, so inputs run untracked app-wide.
        letterSpacing: 'normal',
        outline: 'none',
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    />
  )
})

export default TextInput
