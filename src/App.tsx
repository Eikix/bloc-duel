import { useEffect, useState } from 'react'
import { TransactionToaster } from './components/TransactionToaster'
import { Game } from './pages/Game'
import { Home } from './pages/Home'
import { MapDebug } from './pages/MapDebug'

type AppScreen = 'home' | 'game' | 'map-debug'

function getInitialScreen(): AppScreen {
  if (typeof window === 'undefined') return 'home'

  const params = new URLSearchParams(window.location.search)
  if (params.get('view') === 'map-debug') return 'map-debug'
  return params.has('game') || params.get('view') === 'game' ? 'game' : 'home'
}

function syncScreenToUrl(screen: AppScreen) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  if (screen === 'map-debug') {
    url.searchParams.set('view', 'map-debug')
    url.searchParams.delete('game')
  } else if (screen === 'game') {
    if (!url.searchParams.has('game')) {
      url.searchParams.set('view', 'game')
    }
  } else {
    url.searchParams.delete('view')
    url.searchParams.delete('game')
  }

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function App() {
  const [screen, setScreen] = useState<AppScreen>(() => getInitialScreen())

  useEffect(() => {
    syncScreenToUrl(screen)
  }, [screen])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handlePopState = () => {
      setScreen(getInitialScreen())
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  if (screen === 'home') {
    return (
      <>
        <Home onPlayNow={() => setScreen('game')} />
        <TransactionToaster />
      </>
    )
  }

  if (screen === 'map-debug') {
    return <MapDebug />
  }

  return (
    <>
      <Game onBackHome={() => setScreen('home')} />
      <TransactionToaster />
    </>
  )
}

export default App
