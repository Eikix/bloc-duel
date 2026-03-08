import StrategicMapBackground from '../components/StrategicMapBackground'
import type { CardType } from '../game/cards'
import type { GamePhase } from '../dojo/torii'

const DEBUG_TEAMS = [
  {
    active: true,
    agi: 5,
    capital: 12,
    escalation: 2,
    faction: 'ATLANTIC' as const,
    heroCount: 2,
    projectedPoints: 7,
    production: {
      compute: 3,
      energy: 3,
      materials: 2,
    },
    systems: 3,
  },
  {
    active: false,
    agi: 2,
    capital: 14,
    escalation: 1,
    faction: 'CONTINENTAL' as const,
    heroCount: 1,
    projectedPoints: 5,
    production: {
      compute: 2,
      energy: 2,
      materials: 3,
    },
    systems: 2,
  },
] as const

function getDebugAge(value: string | null): 1 | 2 | 3 {
  if (value === '1' || value === '2' || value === '3') return Number(value) as 1 | 2 | 3
  return 2
}

function getDebugVariant(value: string | null): 'battle' | 'hero' {
  return value === 'hero' ? 'hero' : 'battle'
}

function getDebugPhase(value: string | null): GamePhase {
  if (value === 'LOBBY' || value === 'DRAFTING' || value === 'AGE_TRANSITION' || value === 'GAME_OVER') {
    return value
  }

  return 'DRAFTING'
}

function getDebugType(value: string | null): CardType | null {
  if (value === 'AI' || value === 'ECONOMY' || value === 'MILITARY' || value === 'SYSTEM') return value
  return null
}

export function MapDebug() {
  const params = typeof window === 'undefined'
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search)

  const age = getDebugAge(params.get('age'))
  const phase = getDebugPhase(params.get('phase'))
  const selectedType = getDebugType(params.get('type'))
  const variant = getDebugVariant(params.get('variant'))

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#d7e1e6]">
      <StrategicMapBackground
        age={age}
        className="absolute inset-0"
        phase={phase}
        selectedType={selectedType}
        showPresentationOverlays={false}
        teams={DEBUG_TEAMS as [typeof DEBUG_TEAMS[0], typeof DEBUG_TEAMS[1]]}
        variant={variant}
      />
    </div>
  )
}

export default MapDebug
