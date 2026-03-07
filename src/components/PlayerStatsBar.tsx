import { motion } from 'framer-motion'
import { useGameStore, canAfford } from '../store/gameStore'
import { RESOURCE_ICONS } from '../game/format'
import SystemsPanel from './SystemsPanel'

interface PlayerStatsBarProps {
  playerIndex: 0 | 1
  isBottom: boolean
}

export default function PlayerStatsBar({ playerIndex, isBottom }: PlayerStatsBarProps) {
  const player = useGameStore((s) => s.players[playerIndex])
  const currentPlayer = useGameStore((s) => s.currentPlayer)
  const localPlayerIndex = useGameStore((s) => s.localPlayerIndex)
  const isCurrentUserTurn = useGameStore((s) => s.isCurrentUserTurn)
  const phase = useGameStore((s) => s.phase)
  const availableHeroes = useGameStore((s) => s.availableHeroes)
  const toggleHeroPicker = useGameStore((s) => s.toggleHeroPicker)

  const isActive = currentPlayer === playerIndex
  const isAtlantic = playerIndex === 0
  const accent = isAtlantic ? 'text-atlantic' : 'text-continental'
  const accentSoft = isAtlantic ? 'bg-atlantic/10 border-atlantic/20' : 'bg-continental/10 border-continental/20'
  const accentLine = isAtlantic ? 'from-atlantic/85 via-atlantic/45 to-transparent' : 'from-continental/85 via-continental/45 to-transparent'
  const statusGlow = isAtlantic ? 'shadow-[0_18px_32px_rgba(47,109,246,0.12)]' : 'shadow-[0_18px_32px_rgba(210,106,56,0.14)]'

  const prod = player.production
  const surcharge = player.heroCount * 2
  const hasAffordableHero = availableHeroes.some((hero) => canAfford(player, hero.cost, surcharge))

  return (
    <motion.div
      layout
      initial={false}
      animate={{ y: 0 }}
      transition={{ duration: 0.18 }}
      className={`panel-glass relative overflow-hidden rounded-[28px] px-4 py-3 md:px-5 lg:py-2.5 ${isActive ? statusGlow : ''}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentLine}`} />

        <div className="relative flex flex-wrap items-center gap-2.5 lg:gap-2">
        <div className="min-w-[170px] flex-1 md:flex-none">
          <div className="mb-1 flex items-center gap-2">
            {isActive ? (
              <motion.div
                layoutId="active-dot"
                className={`h-2.5 w-2.5 rounded-full ${isAtlantic ? 'bg-atlantic' : 'bg-continental'}`}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            ) : (
              <div className="h-2.5 w-2.5 rounded-full bg-border/80" />
            )}
            <span className="section-label">{isBottom ? 'South command' : 'North command'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-display text-lg font-black tracking-[0.01em] ${accent}`}>{player.name}</span>
            <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${accentSoft}`}>
              {isActive ? 'Active' : 'Standby'}
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-stretch gap-2">
          <div className="min-w-[110px] rounded-2xl border border-white/70 bg-white/62 px-3 py-2 lg:py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
            <p className="section-label mb-2">Capital</p>
            <div className="flex items-center gap-2">
              <span className="text-base">{RESOURCE_ICONS.capital}</span>
              <span className="font-display text-xl font-black text-ink">{player.capital}</span>
            </div>
          </div>

          <div className="min-w-[180px] rounded-2xl border border-white/70 bg-white/62 px-3 py-2 lg:py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
            <p className="section-label mb-2">Income each turn</p>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-ink-muted">
              {prod.energy > 0 && <span>{RESOURCE_ICONS.energy}+{prod.energy}</span>}
              {prod.materials > 0 && <span>{RESOURCE_ICONS.materials}+{prod.materials}</span>}
              {prod.compute > 0 && <span>{RESOURCE_ICONS.compute}+{prod.compute}</span>}
              {prod.energy === 0 && prod.materials === 0 && prod.compute === 0 && (
                <span className="italic text-ink-faint">No production</span>
              )}
            </div>
          </div>

          <div className="min-w-[210px] flex-1 rounded-2xl border border-white/70 bg-white/62 px-3 py-2 lg:py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
            <p className="section-label mb-2">Systems online</p>
            <SystemsPanel systems={player.systems} activeSystemBonuses={player.activeSystemBonuses} />
          </div>

          <div className="min-w-[112px] rounded-2xl border border-white/70 bg-white/62 px-3 py-2 lg:py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
            <p className="section-label mb-2">Heroes used</p>
            <p className="font-mono text-xs font-semibold text-ink-muted">
              {player.heroCount > 0 ? `${player.heroCount} hero${player.heroCount > 1 ? 'es' : ''}` : 'None yet'}
            </p>
          </div>
        </div>

        {isBottom && localPlayerIndex === playerIndex && isCurrentUserTurn && phase === 'DRAFTING' && availableHeroes.length > 0 && (
          <button
            onClick={toggleHeroPicker}
            disabled={!hasAffordableHero}
            className={`rounded-2xl px-4 py-3 lg:py-2.5 font-mono text-xs font-semibold transition ${
              hasAffordableHero
                ? 'border border-amber-300 bg-[linear-gradient(135deg,#fff3c7,#ffd87a)] text-amber-900 shadow-[0_16px_24px_rgba(245,158,11,0.16)] hover:-translate-y-0.5 hover:brightness-105'
                : 'border border-border bg-white/55 text-ink-faint cursor-not-allowed'
            }`}
          >
            Invoke Hero
          </button>
        )}
      </div>
    </motion.div>
  )
}
