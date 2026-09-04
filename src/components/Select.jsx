import { FONT, TEXT, FS_BASE, FS_CAPTION, SPACE_8, SPACE_12 } from '../data/theme.js'

// sm is the settings-drawer control this was extracted from (VocabPage /
// VocabSrsModule sidebars); md matches TextInput's md padding so a select
// and a text input sit level in a form — Story's generator form was the
// first to need a select as a primary form field rather than a drawer row.
// The right padding leaves room for the chevron in both.
const SIZES = {
  sm: '5px 28px 5px 10px',
  md: `${SPACE_8}px 36px ${SPACE_8}px ${SPACE_12}px`,
}

// `inline`: no background/border, same height as a sm Chip — for a Select
// living inside a FilterRow alongside chip rows (Story's Vocabulary/Format,
// Anime Vocab's JLPT row), where a bordered field would read as a different
// kind of control instead of just another row option. Right padding covers
// the chevron; left is flush since the FilterRow label already gives it room.
const VARIANTS = {
  default: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.18)' },
  inline: { background: 'transparent', border: 'none' },
}
const INLINE_PADDING = `4px 20px 4px 0`

// An option is { value, label }; a group is { label, options: [...] } and
// renders as a native <optgroup> — StoryModule's vocabulary-source picker
// groups sublists under their source and SRS decks under their own heading.
function renderOption(opt) {
  if (Array.isArray(opt.options)) {
    return (
      <optgroup key={opt.label} label={opt.label}>
        {opt.options.map(renderOption)}
      </optgroup>
    )
  }
  return (
    <option key={opt.value} value={opt.value} style={{ background: '#2E2E2E', color: '#fff' }}>
      {opt.label}
    </option>
  )
}

export default function Select({ value, onChange, options, label, subtext, size = 'sm', variant = 'default', disabled = false }) {
  const isInline = variant === 'inline'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}>{label}</span>}
      {subtext && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: FS_CAPTION, fontFamily: FONT }}>{subtext}</span>}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            ...(VARIANTS[variant] ?? VARIANTS.default),
            borderRadius: isInline ? 0 : 6,
            color: isInline ? TEXT : 'rgba(255,255,255,0.65)',
            fontSize: FS_BASE,
            fontFamily: FONT,
            padding: isInline ? INLINE_PADDING : (SIZES[size] ?? SIZES.sm),
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            minWidth: isInline ? undefined : 90,
            lineHeight: '1.4',
            width: '100%',
          }}
        >
          {options.map(renderOption)}
        </select>
        <svg style={{ position: 'absolute', right: isInline ? 4 : (size === 'md' ? 12 : 8), pointerEvents: 'none' }} width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}
