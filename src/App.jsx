import { useState, useEffect } from 'react'
import DashboardPage from './pages/DashboardPage.jsx'
import VocabPage from './pages/VocabPage.jsx'
import VocabSrsModule from './modules/vocab-srs/VocabSrsModule.jsx'
import ImmersionModule from './modules/immersion/ImmersionModule.jsx'

function getRoute() {
  return window.location.hash.slice(1) || '/'
}

export default function App() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    const root = document.getElementById('root')
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    root.style.overflow = 'hidden'
    root.style.height = '100%'
  }, [])

  useEffect(() => {
    const handler = () => setRoute(getRoute())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  if (route === '/') return <DashboardPage />
  if (route === '/vocab') return <VocabPage />
  if (route === '/vocab-srs') return <VocabSrsModule />
  if (route === '/immersion') return <ImmersionModule />
  return <DashboardPage />
}
