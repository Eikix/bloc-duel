import { forwardRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { ALL_CARDS } from '../game/cards'
import type { CardType } from '../game/cards'

interface PlayFieldProps {
  playerIndex: 0 | 1
  isHighlighted?: boolean
  label?: string
  compact?: boolean
  emptyHint?: string
  targetLabel?: string
}

const TYPE_COLORS: Record<CardType, string> = {
  AI: 'bg-blue-500 text-white',
  ECONOMY: 'bg-amber-500 text-white',
  MILITARY: 'bg-red-500 text-white',
  SYSTEM: 'bg-emerald-500 text-white',
}

const PlayField = forwardRef<HTMLDivElement, PlayFieldProps>(
  function PlayField({ playerIndex, isHighlighted, label, compact = false, emptyHint, targetLabel }, ref) {
    const playedCards = useGameStore((s) => s.players[playerIndex].playedCards)
    const playerName = useGameStore((s) => s.players[playerIndex].name)

    const cards = playedCards.map((id) => ALL_CARDS.find((card) => card.id === id)).filter(Boolean)

    return (
      <div
        ref={ref}
        className={`panel-glass rounded-[26px] px-3 py-3 md:px-4 ${
          isHighlighted
            ? 'border-blue-300/80 bg-[linear-gradient(135deg,rgba(219,234,254,0.9),rgba(239,246,255,0.96))] shadow-[0_20px_35px_rgba(59,130,246,0.18)]'
            : ''
        } ${compact ? 'rounded-[22px] px-3 py-2.5 md:px-3.5 md:py-3' : ''}`}
      >
        <div className={`flex items-center justify-between gap-3 ${compact ? 'mb-2' : 'mb-3'}`}>
          <div>
            <p className="section-label mb-1">Deployment lane</p>
            <p className={`font-display font-black text-ink ${compact ? 'text-sm md:text-base' : 'text-base'}`}>
              {label ?? `${playerName} network`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {targetLabel && (
              <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${
                isHighlighted
                  ? 'border-blue-300 bg-blue-100 text-blue-700'
                  : 'border-blue-200/80 bg-blue-50/80 text-blue-600'
              }`}>
                {targetLabel}
              </span>
            )}
            <span className="rounded-full bg-white/70 px-2.5 py-1 font-mono text-[10px] text-ink-muted">
              {cards.length} deployed
            </span>
          </div>
        </div>

        <div className={`scrollbar-hidden flex items-start gap-2 overflow-x-auto rounded-[20px] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] ${
          targetLabel
            ? 'border-2 border-dashed border-blue-200/90 bg-blue-50/50'
            : 'border border-white/80 bg-white/58'
        } ${compact ? 'min-h-[58px] py-2.5' : 'min-h-[70px] py-3'}`}>
          {cards.length === 0 ? (
            <span className={`font-mono text-[11px] italic text-ink-faint ${compact ? 'py-2' : 'py-3'}`}>
              {emptyHint ?? 'Drag a drafted card here to deploy it to the board.'}
            </span>
          ) : (
            <AnimatePresence initial={false}>
              {cards.map((card, index) => (
              <motion.span
                key={card!.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28, delay: index * 0.03 }}
                className={`inline-flex items-center rounded-xl font-mono text-[10px] font-semibold leading-none shadow-sm ${TYPE_COLORS[card!.type]} ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'}`}
                title={`${card!.name} (${card!.type})`}
              >
                {card!.chainFrom !== undefined ? '\u26D3 ' : ''}
                {card!.name}
              </motion.span>
            ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    )
  },
)

export default PlayField
