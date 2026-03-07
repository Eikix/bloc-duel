import { forwardRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { ALL_CARDS } from '../game/cards'
import type { CardType } from '../game/cards'

interface PlayFieldProps {
  playerIndex: 0 | 1
  isHighlighted?: boolean
  label?: string
}

const TYPE_COLORS: Record<CardType, string> = {
  AI: 'bg-blue-500 text-white',
  ECONOMY: 'bg-amber-500 text-white',
  MILITARY: 'bg-red-500 text-white',
  SYSTEM: 'bg-emerald-500 text-white',
}

const PlayField = forwardRef<HTMLDivElement, PlayFieldProps>(
  function PlayField({ playerIndex, isHighlighted, label }, ref) {
    const playedCards = useGameStore((s) => s.players[playerIndex].playedCards)
    const playerName = useGameStore((s) => s.players[playerIndex].name)

    const cards = playedCards.map((id) => ALL_CARDS.find((c) => c.id === id)).filter(Boolean)

    return (
      <div
        ref={ref}
        className={`
          flex items-center gap-1 rounded-lg border-2 border-dashed px-2 md:px-3 py-1.5 min-h-[44px] md:min-h-[40px] transition-all duration-200 overflow-x-auto
          ${isHighlighted
            ? 'border-blue-400 bg-blue-50/50 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
            : 'border-border/40 bg-surface/50'
          }
        `}
      >
        {cards.length === 0 ? (
          <span className="font-mono text-[10px] text-ink-faint italic">
            {label ?? `${playerName} cards`}
          </span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {cards.map((card) => (
              <span
                key={card!.id}
                className={`
                  inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none
                  ${TYPE_COLORS[card!.type]}
                `}
                title={`${card!.name} (${card!.type})`}
              >
                {card!.chainFrom !== undefined ? '\u26D3 ' : ''}{card!.name.split(' ')[0]}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  },
)

export default PlayField
