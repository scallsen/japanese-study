import { forwardRef } from 'react'
import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, SPACE_8, SPACE_16, SPACE_24, DANGER } from '../data/theme.js'
import { useAccent } from '../context/ModuleThemeContext.jsx'

// Reconciled from the real variants already in use across the app —
// ConfirmDialog, WordImportPanel, VocabSrsModule, DeckComboBox, etc. each
// independently hand-rolled these with slightly drifting opacity/radius.
// `danger-outline`'s background tint is fixed to actually match its own
// text color (ConfirmDialog's had a mismatched hue — rgba(192,57,43,..)
// background under an #f87171 label).
//
// `accent` param, not a module constant: primary/accent-outline/ghost need
// the ambient module accent (Anime Vocab's Start Drill CTA must render
// pink, not core teal) — same gap Badge and SelectAllCheckbox had.
function buildVariants(accent) {
  return {
    primary: { background: accent, border: 'none', color: '#fff' },
    'accent-outline': { background: `${accent}29`, border: `1px solid ${accent}6b`, color: accent },
    neutral: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: TEXT },
    'danger-outline': { background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: DANGER },
    ghost: { background: 'transparent', border: 'none', color: accent },
    // Borderless neutral that reddens on hover — the dismiss/remove affordance
    // (a toast's ×, a row's remove). Replaces the former IconButton atom: an
    // icon-only button is a Button with an icon and no label, not a separate
    // component, so `icon` here also covers icon+text cases the old atom couldn't.
    'ghost-muted': { background: 'transparent', border: 'none', color: TEXT_MUTED },
  }
}

// Sizes match the three distinct paddings actually used app-wide, not an
// arbitrary scale — sm: bulk-select confirm/cancel, md: dialog buttons, lg:
// primary drill CTAs like "Start Drill". Vertical padding on sm/lg (5px,
// 10px) doesn't land on the spacing scale — real historical values, kept
// exact rather than rounded onto a token and changing the rendered size.
const SIZES = {
  sm: '5px 14px',
  md: `${SPACE_8}px ${SPACE_16}px`,
  lg: `10px ${SPACE_24}px`,
}

// An icon with no label needs square padding — reusing the text paddings
// above would render a stretched rectangle around a single glyph.
const ICON_ONLY_SIZES = { sm: 4, md: 6, lg: 8 }

// className drives hover/active — colored variants brighten via `filter`
// (works for solid/translucent tints alike), neutral/ghost shift background
// directly since brightness() can't visibly lighten them. See global.css.
const VARIANT_CLASS = {
  primary: 'btn btn-tint',
  'accent-outline': 'btn btn-tint',
  'danger-outline': 'btn btn-tint',
  neutral: 'btn btn-neutral',
  ghost: 'btn btn-ghost',
  'ghost-muted': 'btn btn-ghost-muted',
}

// forwardRef because callers need the real DOM node: DeckComboBox measures
// this button to position its popover against it. A component library whose
// elements can't be measured or focused forces call sites back to raw
// <button>, which is exactly what this replaces.
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', disabled = false, type = 'button', onClick, fullWidth = false, icon, label, children, accent },
  ref
) {
  const resolvedAccent = useAccent(accent)
  const VARIANTS = buildVariants(resolvedAccent)
  const style = VARIANTS[variant] ?? VARIANTS.primary
  const iconOnly = icon != null && !children

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={VARIANT_CLASS[variant] ?? 'btn btn-tint'}
      style={{
        ...style,
        padding: iconOnly ? ICON_ONLY_SIZES[size] ?? ICON_ONLY_SIZES.md : SIZES[size] ?? SIZES.md,
        borderRadius: 6,
        fontFamily: FONT,
        letterSpacing: TRACKING,
        fontSize: FS_BASE,
        lineHeight: 1,
        width: fullWidth ? '100%' : undefined,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: icon && children ? 6 : 0,
      }}
    >
      {icon}
      {children}
    </button>
  )
})

export default Button
