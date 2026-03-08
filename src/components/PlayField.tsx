import { forwardRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'
import { ALL_CARDS } from '../game/cards'
import type { CardEffect, CardType } from '../game/cards'
import { formatCost, RESOURCE_ICONS } from '../game/format'

interface PlayFieldProps {
  playerIndex: 0 | 1
  isHighlighted?: boolean
  label?: string
  compact?: boolean
  emptyHint?: string
  targetLabel?: string
  immersive?: boolean
}

const CARD_TILE_STYLES: Record<CardType, { banner: string, card: string, chip: string, text: string }> = {
  AI: {
    banner: 'bg-blue-500',
    card: 'border-blue-200/80 bg-[linear-gradient(180deg,rgba(239,247,255,0.98),rgba(216,232,252,0.92))]',
    chip: 'bg-blue-500 text-white',
    text: 'text-blue-900',
  },
  ECONOMY: {
    banner: 'bg-amber-500',
    card: 'border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,251,238,0.98),rgba(251,235,191,0.92))]',
    chip: 'bg-amber-500 text-white',
    text: 'text-amber-950',
  },
  MILITARY: {
    banner: 'bg-red-500',
    card: 'border-red-200/80 bg-[linear-gradient(180deg,rgba(255,243,241,0.98),rgba(251,220,214,0.92))]',
    chip: 'bg-red-500 text-white',
    text: 'text-red-900',
  },
  SYSTEM: {
    banner: 'bg-emerald-500',
    card: 'border-emerald-200/80 bg-[linear-gradient(180deg,rgba(239,255,247,0.98),rgba(214,245,231,0.92))]',
    chip: 'bg-emerald-500 text-white',
    text: 'text-emerald-900',
  },
}

function summarizeCardEffect(effect: CardEffect, symbol?: string): string {
  const parts: string[] = []
  if (effect.agi) parts.push(`AGI +${effect.agi}`)
  if (effect.escalation) parts.push(`ESC ${effect.escalation > 0 ? '+' : ''}${effect.escalation}`)
  if (effect.capital) parts.push(`${RESOURCE_ICONS.capital}${effect.capital}`)
  if (effect.energyPerTurn) parts.push(`${RESOURCE_ICONS.energy}+${effect.energyPerTurn}`)
  if (effect.materialsPerTurn) parts.push(`${RESOURCE_ICONS.materials}+${effect.materialsPerTurn}`)
  if (effect.computePerTurn) parts.push(`${RESOURCE_ICONS.compute}+${effect.computePerTurn}`)
  if (effect.symbol) parts.push(effect.symbol.slice(0, 3))
  if (symbol) parts.push(symbol.slice(0, 3))
  return parts.slice(0, 3).join(' • ') || 'Passive'
}

const PlayField = forwardRef<HTMLDivElement, PlayFieldProps>(
  function PlayField({ playerIndex, isHighlighted, label, compact = false, emptyHint, targetLabel, immersive = false }, ref) {
    const playedCards = useGameStore((s) => s.players[playerIndex].playedCards)
    const playerName = useGameStore((s) => s.players[playerIndex].name)

    const cards = playedCards.map((id) => ALL_CARDS.find((card) => card.id === id)).filter(Boolean)

    return (
      <div
        ref={ref}
        className={`panel-glass ${immersive ? 'panel-battle-glass' : ''} rounded-[28px] px-4 py-4 md:px-5 ${
          isHighlighted
            ? immersive
              ? 'border-blue-300/70 bg-[linear-gradient(135deg,rgba(23,46,91,0.64),rgba(13,27,52,0.42))] shadow-[0_20px_35px_rgba(59,130,246,0.2)]'
              : 'border-blue-300/80 bg-[linear-gradient(135deg,rgba(219,234,254,0.9),rgba(239,246,255,0.96))] shadow-[0_20px_35px_rgba(59,130,246,0.18)]'
            : ''
        } ${compact ? 'rounded-[24px] px-3.5 py-3 md:px-4 md:py-3.5' : ''}`}
      >
        <div className={`flex items-center justify-between gap-3 ${compact ? 'mb-2' : 'mb-3'}`}>
          <div>
            <p className={`section-label mb-1 ${immersive ? 'text-white/45' : ''}`}>Deployment lane</p>
            <p className={`font-display font-black ${immersive ? 'text-white' : 'text-ink'} ${compact ? 'text-base' : 'text-lg'}`}>
              {label ?? `${playerName} network`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {targetLabel && (
              <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${
                isHighlighted
                  ? immersive
                    ? 'border-blue-300/70 bg-blue-500/18 text-blue-100'
                    : 'border-blue-300 bg-blue-100 text-blue-700'
                  : immersive
                    ? 'border-white/15 bg-white/8 text-white/66'
                    : 'border-blue-200/80 bg-blue-50/80 text-blue-600'
              }`}>
                {targetLabel}
              </span>
            )}
            <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] ${
              immersive
                ? 'border border-white/12 bg-white/8 text-white/62'
                : 'bg-white/70 text-ink-muted'
            }`}>
              {cards.length} deployed
            </span>
          </div>
        </div>

        <div className={`scrollbar-hidden flex items-stretch gap-2.5 overflow-x-auto rounded-[22px] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] ${
          targetLabel
            ? immersive
              ? 'border-2 border-dashed border-blue-300/28 bg-[linear-gradient(180deg,rgba(25,53,104,0.18),rgba(11,24,46,0.12))]'
              : 'border-2 border-dashed border-blue-200/90 bg-blue-50/50'
            : immersive
              ? 'border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(8,18,34,0.14))]'
              : 'border border-white/80 bg-white/58'
        } ${compact ? 'min-h-[108px] py-3' : 'min-h-[128px] py-4'}`}>
          {cards.length === 0 ? (
            <span className={`font-mono text-[11px] italic ${immersive ? 'text-white/42' : 'text-ink-faint'} ${compact ? 'py-2.5' : 'py-3.5'}`}>
              {emptyHint ?? 'Drag a drafted card here to deploy it to the board.'}
            </span>
          ) : (
            <AnimatePresence initial={false}>
              {cards.map((card, index) => (
                <motion.article
                  key={card!.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 28, delay: index * 0.03 }}
                  className={`relative shrink-0 overflow-hidden rounded-[16px] border shadow-[0_14px_24px_rgba(8,18,34,0.16)] ${
                    CARD_TILE_STYLES[card!.type].card
                  } ${compact ? 'min-h-[96px] w-[112px] p-2.5' : 'min-h-[112px] w-[124px] p-3'}`}
                  title={`${card!.name} (${card!.type})`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1.5 ${CARD_TILE_STYLES[card!.type].banner}`} />
                  <div className="relative flex h-full flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.14em] ${CARD_TILE_STYLES[card!.type].chip}`}>
                        {card!.type.slice(0, 3)}
                      </span>
                      <span className="rounded-full bg-white/78 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-ink-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                        {formatCost(card!.cost)}
                      </span>
                    </div>

                    <p className={`mt-2 line-clamp-2 font-display text-[11px] font-black leading-[1.02] ${CARD_TILE_STYLES[card!.type].text}`}>
                      {card!.name}
                    </p>

                    <p className="mt-2 line-clamp-3 font-mono text-[8px] leading-tight text-ink-muted">
                      {summarizeCardEffect(card!.effect, card!.symbol)}
                    </p>

                    <div className="mt-auto flex flex-wrap items-center gap-1 pt-2">
                      {card!.chainFrom !== undefined && (
                        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 font-mono text-[8px] font-bold text-violet-700">
                          CHAIN
                        </span>
                      )}
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    )
  },
)

export default PlayField
