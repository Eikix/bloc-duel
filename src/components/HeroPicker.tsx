import { AnimatePresence, motion } from 'framer-motion'
import type { CardType } from '../game/cards'
import StrategicMapBackground from './StrategicMapBackground'
import { useGameStore, canAfford } from '../store/gameStore'
import { formatCost } from '../game/format'

function getEscalationPressure(playerIndex: 0 | 1, escalationTrack: number): number {
  return playerIndex === 0 ? Math.max(0, -escalationTrack) : Math.max(0, escalationTrack)
}

function resolveHeroSceneType(
  heroes: ReturnType<typeof useGameStore.getState>['availableHeroes'],
  current: ReturnType<typeof useGameStore.getState>['players'][number],
  surcharge: number,
): CardType | null {
  const focusHero = heroes.find((hero) => canAfford(current, hero.cost, surcharge)) ?? heroes[0]
  if (!focusHero) return null

  if (focusHero.effect.agi || focusHero.effect.computePerTurn) return 'AI'
  if (focusHero.effect.escalation) return 'MILITARY'
  if (focusHero.effect.symbol) return 'SYSTEM'
  return 'ECONOMY'
}

export default function HeroPicker() {
  const open = useGameStore((s) => s.heroPickerOpen)
  const age = useGameStore((s) => s.age)
  const agiTrack = useGameStore((s) => s.agiTrack)
  const currentPlayerIndex = useGameStore((s) => s.currentPlayer)
  const escalationTrack = useGameStore((s) => s.escalationTrack)
  const heroes = useGameStore((s) => s.availableHeroes)
  const phase = useGameStore((s) => s.phase)
  const players = useGameStore((s) => s.players)
  const current = useGameStore((s) => s.players[s.currentPlayer])
  const invokeHero = useGameStore((s) => s.invokeHero)
  const toggle = useGameStore((s) => s.toggleHeroPicker)

  const surcharge = current.heroCount * 2
  const heroSceneType = resolveHeroSceneType(heroes, current, surcharge)
  const heroSceneTeams = ([0, 1] as const).map((playerIndex) => ({
    active: currentPlayerIndex === playerIndex,
    agi: agiTrack[playerIndex],
    capital: players[playerIndex].capital,
    escalation: getEscalationPressure(playerIndex, escalationTrack),
    faction: players[playerIndex].faction,
    heroCount: players[playerIndex].heroCount,
    projectedPoints: agiTrack[playerIndex] + new Set(players[playerIndex].systems).size + players[playerIndex].heroCount,
    production: players[playerIndex].production,
    systems: new Set(players[playerIndex].systems).size,
  })) as [{
    active: boolean
    agi: number
    capital: number
    escalation: number
    faction: 'ATLANTIC' | 'CONTINENTAL'
    heroCount: number
    projectedPoints: number
    production: {
      energy: number
      materials: number
      compute: number
    }
    systems: number
  }, {
    active: boolean
    agi: number
    capital: number
    escalation: number
    faction: 'ATLANTIC' | 'CONTINENTAL'
    heroCount: number
    projectedPoints: number
    production: {
      energy: number
      materials: number
      compute: number
    }
    systems: number
  }]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle,rgba(17,32,56,0.18),rgba(17,32,56,0.52))] px-4 backdrop-blur-sm"
          onClick={toggle}
        >
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="panel-steel relative w-full max-w-5xl rounded-[32px] px-5 py-6 md:px-7"
            onClick={(event) => event.stopPropagation()}
          >
            <StrategicMapBackground
              age={age}
              className="absolute inset-0 opacity-95"
              phase={phase}
              selectedType={heroSceneType}
              teams={heroSceneTeams}
              variant="hero"
            />

            <div className="relative z-10">
              <div className="mb-6 text-center">
                <p className="section-label mb-2">Executive asset deployment</p>
                <h3 className="font-display text-3xl font-black text-ink">Invoke a historical hero</h3>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
                  Calling a hero replaces your normal draft pick this turn and permanently increases the surcharge for future hero calls.
                </p>
                {surcharge > 0 && (
                  <span className="mt-3 inline-flex rounded-full border border-amber-300 bg-amber-50 px-3 py-1 font-mono text-[11px] font-semibold text-amber-700">
                    Current surcharge: +{surcharge} capital
                  </span>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {heroes.map((hero, index) => {
                  const affordable = canAfford(current, hero.cost, surcharge)

                  return (
                    <motion.button
                      key={hero.slot}
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                      disabled={!affordable}
                      onClick={() => invokeHero(hero.slot)}
                      className={`group relative overflow-hidden rounded-[28px] border text-left transition-all duration-200 ${
                        affordable
                          ? 'border-amber-300 bg-[linear-gradient(180deg,rgba(255,250,235,0.92),rgba(251,235,187,0.78))] shadow-[0_24px_34px_rgba(245,158,11,0.18)] hover:-translate-y-1 hover:brightness-105'
                          : 'border-border bg-white/52 opacity-55 cursor-not-allowed'
                      }`}
                    >
                      <div className="h-2 bg-[linear-gradient(90deg,#f59e0b,#facc15,#f59e0b)]" />

                      <div className="px-5 py-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-white/72 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                            Hero asset
                          </span>
                          <span className={`rounded-full px-2.5 py-1 font-mono text-xs font-bold ${
                            affordable ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {formatCost(hero.cost)}
                            {surcharge > 0 ? ` +${surcharge}` : ''}
                          </span>
                        </div>

                        <h4 className="font-display text-2xl font-black leading-tight text-ink">{hero.name}</h4>
                        <p className="mt-1 font-body text-sm font-semibold italic text-amber-700">{hero.title}</p>

                        <div className="mt-4 rounded-[22px] border border-white/76 bg-white/62 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                          <p className="section-label mb-2">Operational effect</p>
                          <p className="font-mono text-xs leading-relaxed text-ink-muted">{hero.description}</p>
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              <p className="mt-5 text-center font-mono text-[10px] text-ink-faint">Click outside the command deck to close.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
