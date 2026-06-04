import { useState, useEffect } from 'react'
import ModuleCard from '../components/ModuleCard.jsx'
import { FONT, TRACKING, BORDER, TEXT, TEXT_MUTED } from '../data/theme.js'
import { MODULES } from '../data/modules.js'
import { useAuth } from '../context/AuthContext.jsx'

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = e => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

function AddModuleCard() {
  return (
    <div style={{
      border: '1px dashed rgba(255,255,255,0.12)',
      borderRadius: 6,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      color: 'rgba(255,255,255,0.2)',
      fontFamily: FONT,
      fontSize: 13,
      letterSpacing: TRACKING,
    }}>
      + Add Module
    </div>
  )
}

function AuthSlot() {
  const { user, signIn, signOut, loading } = useAuth()
  if (loading) return null
  if (!user) {
    return (
      <button
        onClick={signIn}
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: FONT,
          fontSize: 13,
          letterSpacing: TRACKING,
          color: TEXT_MUTED,
        }}
      >
        Sign in
      </button>
    )
  }
  const initials = (user.user_metadata?.full_name || user.email || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0].toUpperCase())
    .join('')
  const linkStyle = {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: FONT,
    fontSize: 13,
    letterSpacing: TRACKING,
    color: TEXT_MUTED,
  }
  return (
    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{ fontSize: 13, color: TEXT_MUTED }}>{initials}</span>
      <button onClick={signOut} style={linkStyle}>Sign out</button>
    </div>
  )
}

export default function DashboardPage() {
  const isMobile = useIsMobile()

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: FONT,
      letterSpacing: TRACKING,
      color: TEXT,
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        padding: '20px 24px',
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 16 }}>Japanese Study</span>
        <AuthSlot />
      </header>

      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: isMobile ? '20px 16px' : '28px 28px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 10,
          maxWidth: 900,
        }}>
          {MODULES.map(mod => (
            <ModuleCard key={mod.id} module={mod} />
          ))}
          <AddModuleCard />
        </div>
      </main>
    </div>
  )
}
