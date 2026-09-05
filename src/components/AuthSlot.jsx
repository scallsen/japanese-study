import { useState, useRef } from 'react'
import Avatar from './Avatar.jsx'
import Menu from './Menu.jsx'
import Popover from './Popover.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useIsMobile } from '../hooks/useIsMobile.js'
import { FONT, TRACKING, FS_BASE } from '../data/theme.js'

const MENU_ITEMS = [
  { id: 'account', label: 'Manage account' },
  { id: 'signout', label: 'Sign out' },
]

export default function AuthSlot() {
  const { user, signIn, signOut, loading } = useAuth()
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const anchorRef = useRef(null)

  if (loading) return null

  if (!user) {
    return (
      <button
        onClick={signIn}
        className="muted-link"
        style={{
          // No colour here — .muted-link owns it so its :hover can win.
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: FONT, fontSize: FS_BASE, letterSpacing: TRACKING,
          height: 34,
        }}
      >
        Sign in
      </button>
    )
  }

  const displayName = user.user_metadata?.full_name || user.user_metadata?.user_name || user.email || ''

  function handleSelect(id) {
    setMenuOpen(false)
    if (id === 'account') window.location.hash = '#/account'
    else signOut()
  }

  return (
    <>
      <button
        ref={anchorRef}
        onClick={() => setMenuOpen(open => !open)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="avatar-trigger"
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center',
        }}
      >
        <Avatar name={displayName} />
      </button>

      <Popover
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={anchorRef}
        isMobile={isMobile}
        // The sheet fills the width on mobile and needs a header to be
        // dismissible; the desktop popover is dismissed by clicking away.
        title={isMobile ? (displayName || 'Account') : undefined}
        // The trigger sits at the far right of the header, so left-aligning
        // would overflow and get clamped against the window edge.
        align="end"
        width={200}
      >
        <Menu items={MENU_ITEMS} onSelect={handleSelect} />
      </Popover>
    </>
  )
}
