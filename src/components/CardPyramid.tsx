import { AnimatePresence } from 'framer-motion'
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

// Row 3 (bottom, most available) gets highest z-index
// Available cards within a row get boosted further
const ROW_Z: Record<number, number> = { 0: 10, 1: 20, 2: 30, 3: 40 }

// Overlap: each row pulls up into the one above it
// Negative margin eats into the previous row's space
const ROW_OVERLAP = '-mt-6 sm:-mt-7 md:-mt-9'

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

  return (
    <div className="flex flex-col items-center">
      {ROWS.map((positions, rowIndex) => (
        <div
          key={rowIndex}
          className={`flex justify-center gap-1 sm:gap-1.5 md:gap-2 ${rowIndex > 0 ? ROW_OVERLAP : ''}`}
          style={{ zIndex: ROW_Z[rowIndex] }}
        >
          <AnimatePresence mode="popLayout">
            {positions.map((pos) => {
              const node = pyramid.find((n) => n.position === pos)
              if (!node) return null

              if (node.taken) {
                return (
                  <div
                    key={`empty-${pos}`}
                    className="w-[4.5rem] h-24 sm:w-[5rem] sm:h-[6.75rem] md:w-24 md:h-[8.5rem] rounded-lg border border-dashed border-border/30 opacity-15"
                  />
                )
              }

              const avail = isAvailable(node.position, pyramid)
              const selected = selectedCard === node.position

              const isFreeViaChain = node.card.chainFrom
                ? player.playedCards.includes(node.card.chainFrom)
                : false

              const effectiveCost = getEffectiveCost(node.card, player)
              const affordable = isFreeViaChain || canAfford(player, effectiveCost)

              return (
                <Card
                  key={node.card.id}
                  node={node}
                  available={avail}
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
        </div>
      ))}
    </div>
  )
}
