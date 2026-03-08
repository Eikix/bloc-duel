import { forwardRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Card as GameCard } from '../game/cards'
import { useGameStore } from '../store/gameStore'
import { ALL_CARDS } from '../game/cards'
import { formatCost } from '../game/format'
import { TYPE_STYLES, formatCardEffects } from '../game/cardVisuals'

interface PlayFieldProps {
  playerIndex: 0 | 1
  isHighlighted?: boolean
  label?: string
  compact?: boolean
  emptyHint?: string
  targetLabel?: string
  immersive?: boolean
  onInspectCard?: (card: GameCard) => void
}

const PlayField = forwardRef<HTMLDivElement, PlayFieldProps>(
  function PlayField({
    playerIndex,
    isHighlighted,
    label,
    compact = false,
    emptyHint,
    targetLabel,
    immersive = false,
    onInspectCard,
  }, ref) {
    const playedCards = useGameStore((s) => s.players[playerIndex].playedCards)
    const playerName = useGameStore((s) => s.players[playerIndex].name)

    const cards = playedCards.map((id) => ALL_CARDS.find((card) => card.id === id)).filter(Boolean)
    const laneClassName = targetLabel
      ? immersive
        ? 'border-2 border-dashed border-blue-300/28 bg-[linear-gradient(180deg,rgba(25,53,104,0.18),rgba(11,24,46,0.12))]'
        : 'border-2 border-dashed border-blue-200/90 bg-blue-50/50'
      : immersive
        ? 'border border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(8,18,34,0.14))]'
        : 'border border-white/80 bg-white/58'
    const cardSizeClass = immersive
      ? compact
        ? 'h-[6.2rem] w-[4.4rem] sm:h-[7.6rem] sm:w-[5.4rem]'
        : 'h-[7.8rem] w-[5.5rem]'
      : compact
        ? 'h-[6.3rem] w-[4.5rem]'
        : 'h-[7.2rem] w-[5rem]'

    if (immersive) {
      return (
        <div
          ref={ref}
          className={`scrollbar-hidden relative flex items-stretch gap-3 overflow-x-auto rounded-[24px] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
            isHighlighted
              ? 'border-blue-300/70 bg-[linear-gradient(135deg,rgba(23,46,91,0.64),rgba(13,27,52,0.42))] shadow-[0_20px_35px_rgba(59,130,246,0.2),inset_0_1px_0_rgba(255,255,255,0.12)]'
              : ''
          } ${laneClassName} ${compact ? 'min-h-[128px] py-3' : 'min-h-[132px] py-4'}`}
        >
          {isHighlighted && targetLabel && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-blue-200/55 bg-blue-400/16 font-display text-4xl font-black leading-none text-blue-50 shadow-[0_18px_28px_rgba(59,130,246,0.18)]">
                +
              </div>
            </div>
          )}
          {cards.length === 0 ? (
            <span className={`font-mono text-[11px] italic text-white/42 ${compact ? 'py-2.5' : 'py-3.5'} opacity-0`}>
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
                  className={`relative shrink-0 cursor-pointer overflow-hidden rounded-[18px] border bg-slate-950 ${TYPE_STYLES[card!.type].frame} ${TYPE_STYLES[card!.type].glow} ${cardSizeClass}`}
                  title={`${card!.name} (${card!.type})`}
                  onClick={() => onInspectCard?.(card!)}
                  whileHover={{ scale: 1.04, y: -3 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${TYPE_STYLES[card!.type].accent}`} />
                  <div className={`absolute inset-0 ${TYPE_STYLES[card!.type].fallback}`} />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-[linear-gradient(180deg,rgba(3,9,18,0.4),rgba(3,9,18,0.08)_70%,transparent)]" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,transparent,rgba(3,9,18,0.14)_12%,rgba(3,9,18,0.58)_74%,rgba(3,9,18,0.86)_100%)]" />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),transparent_28%,rgba(5,10,18,0.18)_100%)]" />

                  <div className="relative flex h-full flex-col p-1.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <span className={`rounded-full px-1.5 py-0.5 font-mono text-[6px] font-bold uppercase tracking-[0.12em] shadow-[0_4px_10px_rgba(0,0,0,0.18)] ${TYPE_STYLES[card!.type].chip}`}>
                        {card!.type.slice(0, 3)}
                      </span>
                      <span className="rounded-full border border-white/12 bg-black/30 px-1.5 py-0.5 font-mono text-[6px] font-semibold text-white/88 backdrop-blur-[4px] shadow-[0_4px_10px_rgba(0,0,0,0.16)]">
                        {formatCost(card!.cost)}
                      </span>
                    </div>

                    <div className="mt-auto px-0.5 pb-0.5">
                      <p className={`line-clamp-2 font-display text-[9px] font-black leading-[0.96] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] ${TYPE_STYLES[card!.type].text}`}>
                        {card!.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {card!.chainTo !== undefined && (
                          <span className="rounded-full border border-violet-200/24 bg-violet-400/12 px-1 py-0.5 font-mono text-[5px] font-bold tracking-[0.08em] text-violet-50/92">
                            CHAIN
                          </span>
                        )}
                        {formatCardEffects(card!.effect, card!.symbol).slice(0, 1).map((effect) => (
                          <span
                            key={effect}
                            className="rounded-full border border-white/12 bg-black/26 px-1.5 py-0.5 font-mono text-[5px] font-bold leading-none text-white/86 backdrop-blur-[4px]"
                          >
                            {effect
                              .replace(/^AGI \+/, 'AGI+')
                              .replace(/^ESC \+/, 'ESC+')
                              .replace(/^ESC -/, 'ESC-')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          )}
        </div>
      )
    }

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
        {!immersive && (
          <div className={`flex items-center justify-between gap-3 ${compact ? 'mb-2' : 'mb-3'}`}>
            <div>
              <p className="section-label mb-1">Deployment lane</p>
              <p className={`font-display font-black text-ink ${compact ? 'text-base' : 'text-lg'}`}>
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
        )}

        <div className={`scrollbar-hidden relative flex items-stretch gap-2.5 overflow-x-auto rounded-[22px] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] ${laneClassName} ${compact ? 'min-h-[108px] py-3' : 'min-h-[128px] py-4'}`}>
          {cards.length === 0 ? (
            <span className={`font-mono text-[11px] italic text-ink-faint ${compact ? 'py-2.5' : 'py-3.5'}`}>
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
                  className={`relative shrink-0 cursor-pointer overflow-hidden rounded-[18px] border bg-slate-950 ${TYPE_STYLES[card!.type].frame} ${TYPE_STYLES[card!.type].glow} ${cardSizeClass}`}
                  title={`${card!.name} (${card!.type})`}
                  onClick={() => onInspectCard?.(card!)}
                  whileHover={{ scale: 1.04, y: -3 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${TYPE_STYLES[card!.type].accent}`} />
                  <div className={`absolute inset-0 ${TYPE_STYLES[card!.type].fallback}`} />
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-[linear-gradient(180deg,rgba(3,9,18,0.4),rgba(3,9,18,0.08)_70%,transparent)]" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,transparent,rgba(3,9,18,0.14)_12%,rgba(3,9,18,0.58)_74%,rgba(3,9,18,0.86)_100%)]" />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.12),transparent_28%,rgba(5,10,18,0.18)_100%)]" />

                  <div className="relative flex h-full flex-col p-1.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <span className={`rounded-full px-1.5 py-0.5 font-mono text-[6px] font-bold uppercase tracking-[0.12em] shadow-[0_4px_10px_rgba(0,0,0,0.18)] ${TYPE_STYLES[card!.type].chip}`}>
                        {card!.type.slice(0, 3)}
                      </span>
                      <span className="rounded-full border border-white/12 bg-black/30 px-1.5 py-0.5 font-mono text-[6px] font-semibold text-white/88 backdrop-blur-[4px] shadow-[0_4px_10px_rgba(0,0,0,0.16)]">
                        {formatCost(card!.cost)}
                      </span>
                    </div>

                    <div className="mt-auto px-0.5 pb-0.5">
                      <p className={`line-clamp-2 font-display text-[8px] font-black leading-[0.96] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] ${TYPE_STYLES[card!.type].text}`}>
                        {card!.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {card!.chainTo !== undefined && (
                          <span className="rounded-full border border-violet-200/24 bg-violet-400/12 px-1 py-0.5 font-mono text-[5px] font-bold tracking-[0.08em] text-violet-50/92">
                            CHAIN
                          </span>
                        )}
                        {formatCardEffects(card!.effect, card!.symbol).slice(0, 1).map((effect) => (
                          <span
                            key={effect}
                            className="rounded-full border border-white/12 bg-black/26 px-1.5 py-0.5 font-mono text-[5px] font-bold leading-none text-white/86 backdrop-blur-[4px]"
                          >
                            {effect
                              .replace(/^AGI \+/, 'AGI+')
                              .replace(/^ESC \+/, 'ESC+')
                              .replace(/^ESC -/, 'ESC-')}
                          </span>
                        ))}
                      </div>
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
