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
  const phase = useGameStore((s) => s.phase)
  const availableHeroes = useGameStore((s) => s.availableHeroes)
  const toggleHeroPicker = useGameStore((s) => s.toggleHeroPicker)

  const isActive = currentPlayer === playerIndex
  const isAtlantic = playerIndex === 0

  const accentColor = isAtlantic ? 'border-atlantic' : 'border-continental'
  const dimColor = isAtlantic ? 'border-atlantic/20' : 'border-continental/20'
  const textColor = isAtlantic ? 'text-atlantic' : 'text-continental'
  const dotColor = isAtlantic ? 'bg-atlantic' : 'bg-continental'

  const prod = player.production
  const surcharge = player.heroes.length * 2
  const hasAffordableHero = availableHeroes.some(h => canAfford(player, h.cost, surcharge))

  return (
    <div
      className={`
        flex items-center gap-3 rounded-xl border-2 px-3 py-2 transition-all duration-200
        ${isActive ? `${accentColor} bg-surface-raised shadow-md` : `${dimColor} bg-surface-raised/60`}
        max-md:flex-wrap max-md:gap-2
      `}
    >
      {/* Active dot + Name */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isActive && (
          <motion.div
            layoutId="active-dot"
            className={`w-2 h-2 rounded-full ${dotColor}`}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
        <span className={`font-display text-sm font-bold ${textColor}`}>
          {player.name}
        </span>
      </div>

      <div className="w-px h-5 bg-border hidden md:block" />

      {/* Capital */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-sm">{RESOURCE_ICONS.capital}</span>
        <span className="font-mono text-sm font-bold text-ink">{player.capital}</span>
      </div>

      <div className="w-px h-5 bg-border hidden md:block" />

      {/* Production */}
      <div className="flex items-center gap-2 shrink-0">
        {prod.energy > 0 && (
          <span className="font-mono text-xs text-ink-muted">{RESOURCE_ICONS.energy}+{prod.energy}</span>
        )}
        {prod.materials > 0 && (
          <span className="font-mono text-xs text-ink-muted">{RESOURCE_ICONS.materials}+{prod.materials}</span>
        )}
        {prod.compute > 0 && (
          <span className="font-mono text-xs text-ink-muted">{RESOURCE_ICONS.compute}+{prod.compute}</span>
        )}
        {prod.energy === 0 && prod.materials === 0 && prod.compute === 0 && (
          <span className="font-mono text-[10px] text-ink-faint italic">no prod</span>
        )}
      </div>

      <div className="w-px h-5 bg-border hidden md:block" />

      {/* Systems chips */}
      <div className="hidden md:flex items-center shrink-0">
        <SystemsPanel systems={player.systems} activeSystemBonuses={player.activeSystemBonuses} />
      </div>

      {/* Heroes count */}
      <div className="hidden md:flex items-center gap-1 shrink-0">
        <span className="font-mono text-[10px] text-ink-faint">
          {player.heroes.length > 0 ? `${player.heroes.length} hero${player.heroes.length > 1 ? 'es' : ''}` : ''}
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Invoke Hero button (bottom player only) */}
      {isBottom && phase === 'DRAFTING' && availableHeroes.length > 0 && (
        <button
          onClick={toggleHeroPicker}
          disabled={!hasAffordableHero}
          className={`
            shrink-0 rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition
            ${hasAffordableHero
              ? 'border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'border border-border text-ink-faint cursor-not-allowed'
            }
          `}
        >
          Invoke Hero
        </button>
      )}
    </div>
  )
}
