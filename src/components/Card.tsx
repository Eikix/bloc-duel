import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { RefObject } from 'react'
import type { CardType, CardEffect, ResourceCost } from '../game/cards'
import type { SystemSymbol } from '../game/systems'
import type { PyramidNode } from '../game/pyramid'
import { formatCost, totalCost, RESOURCE_ICONS } from '../game/format'

export interface DropRefs {
  playField: RefObject<HTMLDivElement | null>
  discard: RefObject<HTMLDivElement | null>
}

interface CardProps {
  node: PyramidNode
  available: boolean
  selected: boolean
  affordable: boolean
  isFreeViaChain: boolean
  effectiveCost?: ResourceCost
  onSelect: (pos: number) => void
  dropRefs?: DropRefs
  onPlay?: (pos: number) => void
  onDiscard?: (pos: number) => void
  onDragOverZone?: (zone: 'play' | 'discard' | null) => void
}

const TYPE_STYLES: Record<CardType, { stripe: string; bg: string; text: string }> = {
  AI: { stripe: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  ECONOMY: { stripe: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  MILITARY: { stripe: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
  SYSTEM: { stripe: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

function formatEffects(effect: CardEffect, symbol?: SystemSymbol): string[] {
  const parts: string[] = []
  if (effect.agi) parts.push(`AGI+${effect.agi}`)
  if (effect.escalation) {
    const sign = effect.escalation > 0 ? '+' : ''
    parts.push(`ESC${sign}${effect.escalation}`)
  }
  if (effect.capital) parts.push(`${RESOURCE_ICONS.capital}${effect.capital}`)
  if (effect.energyPerTurn) parts.push(`${RESOURCE_ICONS.energy}+${effect.energyPerTurn}`)
  if (effect.materialsPerTurn) parts.push(`${RESOURCE_ICONS.materials}+${effect.materialsPerTurn}`)
  if (effect.computePerTurn) parts.push(`${RESOURCE_ICONS.compute}+${effect.computePerTurn}`)
  if (effect.symbol) parts.push(effect.symbol.slice(0, 3))
  if (symbol) parts.push(symbol.slice(0, 3))
  return parts
}

function isPointInRect(ref: RefObject<HTMLElement | null>, point: { x: number; y: number }): boolean {
  const el = ref.current
  if (!el) return false
  const rect = el.getBoundingClientRect()
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}

export default function Card({
  node, available, selected, affordable, isFreeViaChain, effectiveCost,
  onSelect, dropRefs, onPlay, onDiscard, onDragOverZone,
}: CardProps) {
  const { card, position } = node
  const style = TYPE_STYLES[card.type]
  const effects = formatEffects(card.effect, card.symbol)
  const displayCost = effectiveCost ?? card.cost
  const isFree = totalCost(displayCost) === 0
  const [isDragging, setIsDragging] = useState(false)
  const [shaking, setShaking] = useState(false)
  const didDragRef = useRef(false)

  const canDrag = available && !!dropRefs

  const handleDrag = (_: unknown, info: { point: { x: number; y: number } }) => {
    if (!dropRefs || !onDragOverZone) return
    if (isPointInRect(dropRefs.playField, info.point)) {
      onDragOverZone('play')
    } else if (isPointInRect(dropRefs.discard, info.point)) {
      onDragOverZone('discard')
    } else {
      onDragOverZone(null)
    }
  }

  const handleDragEnd = (_: unknown, info: { point: { x: number; y: number } }) => {
    setIsDragging(false)
    onDragOverZone?.(null)
    if (!dropRefs) return

    if (isPointInRect(dropRefs.playField, info.point)) {
      if (affordable || isFreeViaChain) {
        onPlay?.(position)
      } else {
        setShaking(true)
        setTimeout(() => setShaking(false), 400)
      }
    } else if (isPointInRect(dropRefs.discard, info.point)) {
      onDiscard?.(position)
    }
  }

  return (
    <motion.div
      drag={canDrag}
      dragSnapToOrigin
      dragElastic={0.8}
      dragMomentum={false}
      onDrag={canDrag ? handleDrag : undefined}
      onDragStart={canDrag ? () => { setIsDragging(true); didDragRef.current = true } : undefined}
      onDragEnd={canDrag ? handleDragEnd : undefined}
      className={`
        relative w-[4.5rem] h-24 sm:w-[5rem] sm:h-[6.75rem] md:w-24 md:h-[8.5rem]
        rounded-lg border ${style.bg}
        flex flex-col overflow-hidden select-none
        transition-shadow duration-150
        ${selected ? 'ring-2 ring-blue-400/60 ring-offset-1' : 'border-border/60'}
        ${available ? 'cursor-grab shadow-md' : 'opacity-35 grayscale pointer-events-none shadow-none'}
        ${isDragging ? 'z-[100] shadow-2xl cursor-grabbing' : ''}
        ${canDrag ? 'draggable-card' : ''}
      `}
      onClick={() => {
        if (didDragRef.current) { didDragRef.current = false; return }
        if (available) onSelect(position)
      }}
      whileHover={available && !isDragging ? { scale: 1.05, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' } : undefined}
      whileTap={available && !isDragging ? { scale: 0.97 } : undefined}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={
        shaking
          ? { opacity: 1, scale: 1, x: [0, -8, 8, -6, 6, 0] }
          : isDragging
            ? { opacity: 1, scale: 1.1 }
            : { opacity: 1, scale: 1 }
      }
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
    >
      {/* Type color stripe */}
      <div className={`${style.stripe} h-1.5 md:h-2 shrink-0`} />

      {/* Cost — top right corner */}
      <div className="flex items-center justify-between px-1.5 md:px-2 pt-1">
        {card.chainTo && <span className="text-[9px] md:text-[10px] text-violet-500">⛓</span>}
        <span className="ml-auto font-mono text-[9px] md:text-[10px] font-semibold text-ink-muted leading-none">
          {isFree ? 'free' : formatCost(displayCost)}
        </span>
      </div>

      {/* Name */}
      <div className="px-1.5 md:px-2 pt-0.5 flex-1 min-h-0">
        <p className={`font-display text-[10px] sm:text-xs md:text-sm font-bold leading-tight ${style.text} line-clamp-2`}>
          {card.name}
        </p>
      </div>

      {/* Effects — compact, wraps on larger sizes */}
      <div className="px-1.5 md:px-2 pb-1 md:pb-1.5 shrink-0">
        <p className="font-mono text-[7px] sm:text-[8px] md:text-[9px] text-ink-muted leading-tight truncate md:whitespace-normal md:line-clamp-2">
          {effects.join(' ')}
        </p>
      </div>

      {/* FREE badge when dragging a chain-free card */}
      {isDragging && isFreeViaChain && (
        <div className="absolute -top-2 -right-2 rounded-full bg-green-500 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow-lg z-10">
          FREE
        </div>
      )}

      {/* Lock overlay for blocked cards */}
      {!available && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg opacity-60">🔒</span>
        </div>
      )}
    </motion.div>
  )
}
