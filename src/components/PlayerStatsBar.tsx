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
  const agiTrack = useGameStore((s) => s.agiTrack)
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
  const agiProgress = agiTrack[playerIndex]
  const systemsOnline = new Set(player.systems).size
  const projectedPoints = agiProgress + systemsOnline + player.heroCount
  const factionWash = isAtlantic
    ? 'bg-[radial-gradient(circle_at_left,rgba(47,109,246,0.18),transparent_72%)]'
    : 'bg-[radial-gradient(circle_at_left,rgba(210,106,56,0.18),transparent_72%)]'
  const factionPanel = isAtlantic
    ? 'border-atlantic/15 bg-[linear-gradient(135deg,rgba(47,109,246,0.1),rgba(255,255,255,0.72))]'
    : 'border-continental/15 bg-[linear-gradient(135deg,rgba(210,106,56,0.12),rgba(255,255,255,0.72))]'
  const metricChip = 'rounded-full border border-white/75 bg-white/86 px-2.5 py-1 font-mono text-[10px] font-semibold text-ink-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]'

  return (
    <motion.div
      layout
      initial={false}
      animate={{ y: 0 }}
      transition={{ duration: 0.18 }}
      className={`panel-glass relative overflow-hidden rounded-[30px] px-5 py-4 md:px-6 md:py-5 ${isActive ? statusGlow : ''}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentLine}`} />
      <div className={`absolute inset-y-0 left-0 w-40 ${factionWash}`} />

      <div className="relative grid gap-4 xl:grid-cols-[minmax(235px,0.9fr)_minmax(0,1.65fr)_auto] xl:items-center">
        <div className={`rounded-[26px] border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] ${factionPanel}`}>
          <div className="mb-2 flex items-center gap-2">
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

          <div className="flex flex-wrap items-center gap-2.5">
            <span className={`font-display text-[1.35rem] font-black tracking-[0.01em] ${accent}`}>{player.name}</span>
            <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${accentSoft}`}>
              {isActive ? 'Active' : 'Standby'}
            </span>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            {isActive
              ? 'This bloc currently holds initiative. Draft tempo and free chains matter most right now.'
              : 'This bloc is waiting for initiative to swing back. Track pressure and scoring windows.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-white/75 bg-white/72 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
            <p className="section-label mb-2">Capital</p>
            <div className="flex items-center gap-2">
              <span className="text-lg">{RESOURCE_ICONS.capital}</span>
              <span className="font-display text-[1.7rem] font-black text-ink">{player.capital}</span>
            </div>
            <p className="mt-2 font-mono text-[10px] text-ink-faint">Capital covers any resource shortfall this turn.</p>
          </div>

          <div className="rounded-[24px] border border-white/75 bg-white/72 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
            <p className="section-label mb-2">Income each turn</p>
            <div className="flex min-h-[28px] flex-wrap items-center gap-2 font-mono text-xs text-ink-muted">
              {prod.energy > 0 && <span>{RESOURCE_ICONS.energy}+{prod.energy}</span>}
              {prod.materials > 0 && <span>{RESOURCE_ICONS.materials}+{prod.materials}</span>}
              {prod.compute > 0 && <span>{RESOURCE_ICONS.compute}+{prod.compute}</span>}
              {prod.energy === 0 && prod.materials === 0 && prod.compute === 0 && (
                <span className="italic text-ink-faint">No production</span>
              )}
            </div>
            <p className="mt-2 font-mono text-[10px] text-ink-faint">Production lowers the capital you need to deploy costly cards.</p>
          </div>

          <div className="rounded-[24px] border border-white/75 bg-white/72 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
            <p className="section-label mb-2">Systems online</p>
            <SystemsPanel systems={player.systems} activeSystemBonuses={player.activeSystemBonuses} />
            <p className="mt-2 font-mono text-[10px] text-ink-faint">
              Bonus doctrines activate from pairs or a three-system spread.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/75 bg-white/72 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
            <p className="section-label mb-2">Victory pressure</p>
            <div className="flex flex-wrap gap-2">
              <span className={metricChip}>AGI {agiProgress}/6</span>
              <span className={metricChip}>Systems {systemsOnline}/4</span>
              <span className={metricChip}>Heroes {player.heroCount}</span>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="font-display text-xl font-black text-ink">{projectedPoints} pts</p>
                <p className="font-mono text-[10px] text-ink-faint">Age III fallback score</p>
              </div>
              <p className="max-w-[10rem] text-right font-mono text-[10px] text-ink-faint">
                Points = AGI + distinct systems + heroes
              </p>
            </div>
          </div>
        </div>

        {isBottom && localPlayerIndex === playerIndex && isCurrentUserTurn && phase === 'DRAFTING' && availableHeroes.length > 0 && (
          <button
            onClick={toggleHeroPicker}
            disabled={!hasAffordableHero}
            className={`rounded-[22px] px-4 py-3 font-mono text-xs font-semibold transition xl:self-stretch ${
              hasAffordableHero
                ? 'border border-amber-300 bg-[linear-gradient(135deg,#fff3c7,#ffd87a)] text-amber-900 shadow-[0_16px_24px_rgba(245,158,11,0.16)] hover:-translate-y-0.5 hover:brightness-105'
                : 'border border-border bg-white/55 text-ink-faint cursor-not-allowed'
            }`}
          >
            Invoke Hero
            <span className="mt-1 block font-mono text-[10px] font-medium opacity-80">Current surcharge +{surcharge}</span>
          </button>
        )}
      </div>
    </motion.div>
  )
}
