import { FONT, TRACKING, TEXT, TEXT_MUTED, FS_BASE, FS_CAPTION } from '../../data/theme.js'

// Matches the source-selector pattern established in VocabPage
// (custom appearance, chevron background-image, rgba border/background).
export const labelStyle = { fontSize: FS_CAPTION, color: TEXT_MUTED, letterSpacing: '0.08em', display: 'block', marginBottom: 4 }

export const fieldStyle = {
  fontFamily: FONT,
  letterSpacing: TRACKING,
  fontSize: FS_BASE,
  color: TEXT,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6,
  padding: '8px 12px',
  width: '100%',
  boxSizing: 'border-box',
}

export const selectFieldStyle = {
  ...fieldStyle,
  padding: '8px 36px 8px 12px',
  appearance: 'none',
  WebkitAppearance: 'none',
  cursor: 'pointer',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
}
