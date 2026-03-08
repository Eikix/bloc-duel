import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore, canAfford, getEffectiveCost } from '../store/gameStore'
import { isAvailable } from '../game/pyramid'
import Card from './Card'
import type { DropRefs } from './Card'

const ROWS: number[][] = [
  [0],
  [1, 2],
  [3, 4, 5],
  [6, 7, 8, 9],
]

const ROW_Z: Record<number, number> = { 0: 10, 1: 20, 2: 30, 3: 40 }
const ROW_OVERLAP = '-mt-9 sm:-mt-10 md:-mt-11 lg:-mt-12 xl:-mt-[3.25rem] 2xl:-mt-[3.6rem]'

interface CardPyramidProps {
  dropRefs?: DropRefs
  onPlay?: (pos: number) => void
  onDiscard?: (pos: number) => void
  onDragOverZone?: (zone: 'play' | 'discard' | null) => void
}

export default function CardPyramid({ dropRefs, onPlay, onDiscard, onDragOverZone }: CardPyramidProps) {
  const pyramid = useGameStore((s) => s.pyramid)
  const selectedCard = useGameStore((s) => s.selectedCard)
  const selectCard = useGameStore((s) => s.selectCard)
  const player = useGameStore((s) => s.players[s.currentPlayer])

  if (pyramid.length === 0) return null

  const pyramidKey = pyramid.map((node) => `${node.position}:${node.card.id}`).join('|')

  return (
    <div key={pyramidKey} className="flex flex-col items-center py-1 md:py-2">
      {ROWS.map((positions, rowIndex) => (
        <motion.div
          key={`${pyramidKey}-${rowIndex}`}
          className={`flex justify-center gap-1.5 sm:gap-2 md:gap-2.5 xl:gap-3 2xl:gap-3.5 ${rowIndex > 0 ? ROW_OVERLAP : ''}`}
          style={{ zIndex: ROW_Z[rowIndex] }}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: rowIndex * 0.05 }}
        >
          <AnimatePresence mode="popLayout">
            {positions.map((pos) => {
              const node = pyramid.find((n) => n.position === pos)
              if (!node) return null

              if (node.taken) {
                return (
                  <div
                    key={`${pyramidKey}-empty-${pos}`}
                    className="relative h-[8rem] w-[5.7rem] rounded-[22px] border border-dashed border-slate-300/80 bg-white/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:h-[8.35rem] sm:w-[5.95rem] md:h-[8.85rem] md:w-[6.3rem] lg:h-[9.4rem] lg:w-[6.7rem] xl:h-[10rem] xl:w-[7.1rem] 2xl:h-[10.7rem] 2xl:w-[7.6rem]"
                  >
                    <div className="absolute inset-2 rounded-[14px] border border-white/40 bg-white/18" />
                  </div>
                )
              }

              const available = isAvailable(node.position, pyramid)
              const selected = selectedCard === node.position
              const isFreeViaChain = node.card.chainFrom !== undefined
                ? player.playedCards.includes(node.card.chainFrom)
                : false
              const effectiveCost = getEffectiveCost(node.card)
              const affordable = isFreeViaChain || canAfford(player, effectiveCost)

              return (
                <Card
                  key={`${pyramidKey}-${node.card.id}`}
                  node={node}
                  available={available}
                  selected={selected}
                  affordable={affordable}
                  isFreeViaChain={isFreeViaChain}
                  effectiveCost={effectiveCost}
                  onSelect={selectCard}
                  dropRefs={dropRefs}
                  onPlay={onPlay}
                  onDiscard={onDiscard}
                  onDragOverZone={onDragOverZone}
                />
              )
            })}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  )
}
