import { useState, useEffect, useRef } from 'react'
import ModuleCard from '../components/ModuleCard.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import PageHeader from '../components/PageHeader.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { FONT, TRACKING, TEXT, FS_BASE } from '../data/theme.js'
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
  const gridRef = useRef(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const equalise = () => {
      Array.from(grid.children).forEach(c => c.style.height = '')
      const max = Math.max(...Array.from(grid.children).map(c => c.getBoundingClientRect().height))
      Array.from(grid.children).forEach(c => c.style.height = `${max}px`)
    }
    equalise()

    document.fonts.ready.then(equalise)
    window.addEventListener('resize', equalise)
    return () => window.removeEventListener('resize', equalise)
  }, [])
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
            fontSize: FS_BASE,
            color: '#93C5FD',
          }}>
            New accounts are currently disabled. Most features are available without logging in!
          </div>
        )}
      </PageHeader>

      <main style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: isMobile ? '20px 16px' : '28px 28px',
      }}>

        <div style={{ flex: 1 }}>
          <div ref={gridRef} style={{
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
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          paddingTop: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a
              href="https://scallsen.ca"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'rgba(232,232,232,0.55)', fontSize: 13, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(232,232,232,0.85)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(232,232,232,0.55)'}
            >
              Developed by Simon Callsen
            </a>
            <span style={{ color: 'rgba(232,232,232,0.55)', fontSize: 13 }}>·</span>
            <a
              href="https://github.com/scallsen/japanese-study"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'rgba(232,232,232,0.55)', fontSize: 13, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(232,232,232,0.85)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(232,232,232,0.55)'}
            >
              GitHub
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
