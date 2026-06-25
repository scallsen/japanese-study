import { useState, useEffect } from 'react'
import ModuleCard from '../components/ModuleCard.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { FONT, TRACKING, TEXT } from '../data/theme.js'
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
      <PageHeader crumbs={[{ label: 'Japanese Study' }]} rightSlot={<AuthSlot />}>
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
      </PageHeader>

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
          margin: '0 auto',
        }}>
          {MODULES.map(mod => (
            <ModuleCard
              key={mod.id}
              module={mod}
              disabled={signedOut && mod.requiresAuth}
            />
          ))}

        </div>
      </main>
    </div>
  )
}
