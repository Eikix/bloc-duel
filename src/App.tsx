import { useEffect, useState } from 'react'
import { TransactionToaster } from './components/TransactionToaster'
import { Game } from './pages/Game'
import { Home } from './pages/Home'

type AppScreen = 'home' | 'game'

function getInitialScreen(): AppScreen {
  if (typeof window === 'undefined') return 'home'

  const params = new URLSearchParams(window.location.search)
  return params.has('game') || params.get('view') === 'game' ? 'game' : 'home'
}

function syncScreenToUrl(screen: AppScreen) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  if (screen === 'game') {
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

  if (screen === 'home') {
    return (
      <>
        <Home onPlayNow={() => setScreen('game')} />
        <TransactionToaster />
      </>
    )
  }

  return (
    <>
      <Game onBackHome={() => setScreen('home')} />
      <TransactionToaster />
    </>
  )
}

export default App
