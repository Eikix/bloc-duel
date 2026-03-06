import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore, canAfford, getSellValue } from '../store/gameStore'
import CardPyramid from '../components/CardPyramid'
import AGITrack from '../components/AGITrack'
import EscalationTrack from '../components/EscalationTrack'
import PlayerStatsBar from '../components/PlayerStatsBar'
import PlayField from '../components/PlayField'
import DiscardZone from '../components/DiscardZone'
import HeroPicker from '../components/HeroPicker'
import { formatCost, totalCost } from '../game/format'

const AGE_LABELS = { 1: 'I', 2: 'II', 3: 'III' } as const

export function Game() {
  const {
    currentPlayer,
    phase,
    age,
    selectedCard,
    pyramid,
    players,
    agiTrack,
    escalationTrack,
    playCard,
    discardCard,
    playCardAt,
    discardCardAt,
    initGame,
    nextAge,
  } = useGameStore()

  useEffect(() => {
    initGame()
  }, [initGame])

  // Perspective: current player is always at bottom
  const bottomPlayer = currentPlayer
  const topPlayer: 0 | 1 = currentPlayer === 0 ? 1 : 0

  // Drop zone refs
  const playFieldRef = useRef<HTMLDivElement>(null)
  const discardRef = useRef<HTMLDivElement>(null)

  // Drag highlight state
  const [activeDragZone, setActiveDragZone] = useState<'play' | 'discard' | null>(null)

  const dropRefs = { playField: playFieldRef, discard: discardRef }

  // Selected card info for tap-action fallback
  const current = players[currentPlayer]
  const selectedNode = selectedCard !== null ? pyramid.find(n => n.position === selectedCard) : null

  const isFreeViaChain = selectedNode?.card.chainFrom
    ? current.playedCards.includes(selectedNode.card.chainFrom)
    : false

  const canAffordCard = selectedNode
    ? isFreeViaChain || canAfford(current, selectedNode.card.cost)
    : false

  const sellValue = getSellValue(age)

  // Determine winner for game over screen
  const getVictoryInfo = () => {
    if (agiTrack[0] >= 6) return { winner: players[0].name, reason: 'AGI Breakthrough' }
    if (agiTrack[1] >= 6) return { winner: players[1].name, reason: 'AGI Breakthrough' }
    if (escalationTrack >= 6) return { winner: players[0].name, reason: 'Escalation Dominance' }
    if (escalationTrack <= -6) return { winner: players[1].name, reason: 'Escalation Dominance' }
    const score = (idx: 0 | 1) => agiTrack[idx] + players[idx].systems.length + players[idx].heroes.length
    const s0 = score(0)
    const s1 = score(1)
    if (s0 > s1) return { winner: players[0].name, reason: `Points ${s0}-${s1}` }
    if (s1 > s0) return { winner: players[1].name, reason: `Points ${s1}-${s0}` }
    return { winner: 'Nobody', reason: `Tie ${s0}-${s1}` }
  }

  return (
    <div className="md:h-screen md:overflow-hidden min-h-screen flex flex-col bg-surface">
      {/* Header — minimal single line */}
      <header className="flex items-center justify-between px-3 py-2 shrink-0">
        <h1 className="font-display text-lg font-black tracking-tight text-ink">
          BLOC<span className="text-ink-faint">:</span>DUEL
        </h1>
        <span className="rounded-md bg-ink/5 px-2 py-0.5 font-mono text-xs font-bold text-ink-muted">
          Age {AGE_LABELS[age]}
        </span>
        <button
          onClick={initGame}
          className="rounded-md border border-border bg-surface-raised px-2.5 py-1 font-mono text-[10px] font-medium text-ink-muted transition hover:border-ink-faint hover:text-ink"
        >
          New Game
        </button>
      </header>

      {/* Battlefield */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPlayer}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col flex-1 px-2 md:px-3 pb-2 gap-1.5 md:gap-2 md:overflow-hidden"
        >
          {/* Opponent stats bar */}
          <PlayerStatsBar playerIndex={topPlayer} isBottom={false} />

          {/* Opponent play field */}
          <PlayField playerIndex={topPlayer} />

          {/* Tracks — side by side on desktop, stacked on mobile */}
          <div className="flex flex-col md:flex-row gap-1.5 md:gap-3 px-1">
            <div className="flex-1">
              <p className="font-mono text-[8px] uppercase tracking-wider text-ink-faint mb-0.5 text-center">AGI</p>
              <AGITrack />
            </div>
            <div className="flex-1">
              <p className="font-mono text-[8px] uppercase tracking-wider text-ink-faint mb-0.5 text-center">Escalation</p>
              <EscalationTrack />
            </div>
          </div>

          {/* Pyramid — takes remaining space, centered */}
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-1">
            <CardPyramid
              dropRefs={dropRefs}
              onPlay={playCardAt}
              onDiscard={discardCardAt}
              onDragOverZone={setActiveDragZone}
            />

            {/* Tap-action fallback when a card is selected */}
            <AnimatePresence>
              {selectedNode && phase === 'DRAFTING' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="flex items-center gap-2 mt-2 rounded-xl border border-border bg-surface-raised px-3 py-2 shadow-lg"
                >
                  <span className="font-body text-xs font-semibold text-ink mr-1">
                    {selectedNode.card.name}
                  </span>
                  <button
                    onClick={playCard}
                    disabled={!canAffordCard}
                    className={`rounded-lg px-3 py-1.5 font-mono text-[10px] font-semibold text-white transition ${
                      canAffordCard
                        ? 'bg-ink hover:bg-ink/80 shadow-sm'
                        : 'bg-ink-faint cursor-not-allowed'
                    }`}
                  >
                    {isFreeViaChain
                      ? 'Play (FREE)'
                      : totalCost(selectedNode.card.cost) > 0
                        ? `Play (${formatCost(selectedNode.card.cost)})`
                        : 'Play'}
                  </button>
                  <button
                    onClick={discardCard}
                    className="rounded-lg border border-border px-3 py-1.5 font-mono text-[10px] font-medium text-ink-muted transition hover:bg-surface hover:text-ink"
                  >
                    Sell +{sellValue}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Discard zone */}
          <DiscardZone
            ref={discardRef}
            sellValue={sellValue}
            isHighlighted={activeDragZone === 'discard'}
          />

          {/* Your play field (drop target) */}
          <PlayField
            ref={playFieldRef}
            playerIndex={bottomPlayer}
            isHighlighted={activeDragZone === 'play'}
          />

          {/* Your stats bar */}
          <PlayerStatsBar playerIndex={bottomPlayer} isBottom={true} />
        </motion.div>
      </AnimatePresence>

      {/* Hero Picker */}
      <HeroPicker />

      {/* Age Transition overlay */}
      <AnimatePresence>
        {phase === 'AGE_TRANSITION' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-3xl bg-surface-raised p-10 text-center shadow-2xl border border-border"
            >
              <h2 className="font-display text-3xl font-black text-ink mb-2">
                Age {AGE_LABELS[age]} Complete
              </h2>
              <p className="text-sm text-ink-muted mb-6">
                Prepare for the next age.
              </p>
              <button
                onClick={nextAge}
                className="rounded-xl bg-ink px-8 py-3 font-display text-sm font-bold text-white shadow-lg transition hover:bg-ink/80"
              >
                Begin Age {AGE_LABELS[(age + 1) as 1 | 2 | 3] ?? 'III'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over overlay */}
      <AnimatePresence>
        {phase === 'GAME_OVER' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-3xl bg-surface-raised p-10 text-center shadow-2xl border border-border"
            >
              <h2 className="font-display text-3xl font-black text-ink mb-2">
                Game Over
              </h2>
              <p className="font-display text-lg font-bold text-ink mb-1">
                {getVictoryInfo().winner} Wins!
              </p>
              <p className="text-sm text-ink-muted mb-6">{getVictoryInfo().reason}</p>
              <button
                onClick={initGame}
                className="rounded-xl bg-ink px-8 py-3 font-display text-sm font-bold text-white shadow-lg transition hover:bg-ink/80"
              >
                Play Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
