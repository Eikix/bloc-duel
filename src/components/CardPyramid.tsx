import { AnimatePresence } from 'framer-motion'
import { useGameStore, canAfford } from '../store/gameStore'
import { isAvailable } from '../game/pyramid'
import Card from './Card'
import type { DropRefs } from './Card'

const ROWS: number[][] = [
  [0],
  [1, 2],
  [3, 4, 5],
  [6, 7, 8, 9],
]

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
    <div className="flex flex-col items-center gap-1 sm:gap-1.5 md:gap-2">
      {ROWS.map((positions, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1 sm:gap-1.5 md:gap-2">
          <AnimatePresence mode="popLayout">
            {positions.map((pos) => {
              const node = pyramid.find((n) => n.position === pos)
              if (!node) return null

              if (node.taken) {
                return (
                  <div
                    key={`empty-${pos}`}
                    className="w-14 h-[4.75rem] sm:w-16 sm:h-[5.5rem] md:w-[4.75rem] md:h-[6.5rem] rounded-xl border-2 border-dashed border-border/40 opacity-30"
                  />
                )
              }

              const avail = isAvailable(node.position, pyramid)
              const selected = selectedCard === node.position

              const isFreeViaChain = node.card.chainFrom
                ? player.playedCards.includes(node.card.chainFrom)
                : false

              const affordable = isFreeViaChain || canAfford(player, node.card.cost)

              return (
                <Card
                  key={node.card.id}
                  node={node}
                  available={avail}
                  selected={selected}
                  affordable={affordable}
                  isFreeViaChain={isFreeViaChain}
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
