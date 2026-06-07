import { useAuth } from '../context/AuthContext.jsx'
import { FONT, TRACKING, TEXT_MUTED } from '../data/theme.js'

export default function AuthSlot() {
  const { user, signIn, signOut, loading } = useAuth()
  if (loading) return null

  const btnStyle = {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: FONT,
    fontSize: 13,
    letterSpacing: TRACKING,
    color: TEXT_MUTED,
    height: 34,
  }

  if (!user) {
    return <button onClick={signIn} style={btnStyle}>Sign in</button>
  }

  const initials = (user.user_metadata?.full_name || user.email || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ fontSize: 13, color: TEXT_MUTED }}>{initials}</span>
      <button onClick={signOut} style={btnStyle}>Sign out</button>
    </div>
  )
}
