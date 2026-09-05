import { useAuth } from '../context/AuthContext.jsx'
import { FONT, TRACKING, TEXT_MUTED, FS_BASE } from '../data/theme.js'

export default function AuthSlot() {
  const { user, signIn, signOut, loading } = useAuth()
  if (loading) return null

  const btnStyle = {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: FONT,
    fontSize: FS_BASE,
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
      <a href="#/account" className="muted-link" style={{ fontSize: FS_BASE, color: TEXT_MUTED }} title="Account">
        {initials}
      </a>
      <button onClick={signOut} style={btnStyle}>Sign out</button>
    </div>
  )
}
