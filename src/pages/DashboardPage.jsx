import { useState, useEffect } from 'react'
import ModuleCard from '../components/ModuleCard.jsx'
import AuthSlot from '../components/AuthSlot.jsx'
import { FONT, TRACKING, BORDER, TEXT, TEXT_MUTED } from '../data/theme.js'
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
  const liveModules = MODULES.filter(m => !m.external)
  const externalModules = MODULES.filter(m => m.external)

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
        <div style={{ marginLeft: 'auto' }}><AuthSlot /></div>
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
          {liveModules.map(mod => (
            <ModuleCard key={mod.id} module={mod} />
          ))}
          <AddModuleCard />
        </div>

        {externalModules.length > 0 && (
          <div style={{ maxWidth: 900, marginTop: 28 }}>
            <div style={{
              fontSize: 11,
              color: TEXT_MUTED,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}>
              External
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 10,
            }}>
              {externalModules.map(mod => (
                <ModuleCard key={mod.id} module={mod} secondary />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
