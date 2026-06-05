import { useState, useEffect } from 'react'
import ModuleCard from '../components/ModuleCard.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { FONT, TRACKING, BORDER, TEXT } from '../data/theme.js'
import { MODULES } from '../data/modules.js'

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

export default function DashboardPage() {
  const isMobile = useIsMobile()
  const { user, loading } = useAuth()
  const signedOut = !loading && !user

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
        flexDirection: 'column',
        borderBottom: `1px solid ${BORDER}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '20px 24px' }}>
          <span style={{ fontSize: 16 }}>Japanese Study</span>
          <div style={{ marginLeft: 'auto' }}><AuthSlot /></div>
        </div>
        {signedOut && (
          <div style={{
            background: 'rgba(37, 99, 235, 0.1)',
            borderTop: '1px solid rgba(59, 130, 246, 0.2)',
            padding: '8px 24px',
            fontSize: 13,
            color: '#93C5FD',
          }}>
            Sign in to unlock all features
          </div>
        )}
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
            <ModuleCard
              key={mod.id}
              module={mod}
              disabled={signedOut && mod.requiresAuth}
            />
          ))}
          <AddModuleCard />
        </div>
      </main>
    </div>
  )
}
