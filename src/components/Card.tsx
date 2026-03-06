import { useState } from 'react'
import { motion } from 'framer-motion'
import type { RefObject } from 'react'
import type { CardType, CardEffect } from '../game/cards'
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
  onSelect: (pos: number) => void
  dropRefs?: DropRefs
  onPlay?: (pos: number) => void
  onDiscard?: (pos: number) => void
  onDragOverZone?: (zone: 'play' | 'discard' | null) => void
}

const TYPE_STYLES: Record<CardType, { border: string; bg: string; badge: string; text: string }> = {
  AI: {
    border: 'border-blue-400',
    bg: 'bg-gradient-to-b from-blue-50 to-white',
    badge: 'bg-blue-500',
    text: 'text-blue-600',
  },
  ECONOMY: {
    border: 'border-amber-400',
    bg: 'bg-gradient-to-b from-amber-50 to-white',
    badge: 'bg-amber-500',
    text: 'text-amber-600',
  },
  MILITARY: {
    border: 'border-red-400',
    bg: 'bg-gradient-to-b from-red-50 to-white',
    badge: 'bg-red-500',
    text: 'text-red-600',
  },
  SYSTEM: {
    border: 'border-emerald-400',
    bg: 'bg-gradient-to-b from-emerald-50 to-white',
    badge: 'bg-emerald-500',
    text: 'text-emerald-600',
  },
}

function formatEffects(effect: CardEffect, symbol?: SystemSymbol): string[] {
  const parts: string[] = []
  if (effect.agi) parts.push(`AGI +${effect.agi}`)
  if (effect.escalation) {
    const sign = effect.escalation > 0 ? '+' : ''
    parts.push(`ESC ${sign}${effect.escalation}`)
  }
  if (effect.capital) parts.push(`${RESOURCE_ICONS.capital}+${effect.capital}`)
  if (effect.energyPerTurn) parts.push(`${RESOURCE_ICONS.energy}+${effect.energyPerTurn}/turn`)
  if (effect.materialsPerTurn) parts.push(`${RESOURCE_ICONS.materials}+${effect.materialsPerTurn}/turn`)
  if (effect.computePerTurn) parts.push(`${RESOURCE_ICONS.compute}+${effect.computePerTurn}/turn`)
  if (effect.capitalPerTurn) parts.push(`${RESOURCE_ICONS.capital}+${effect.capitalPerTurn}/turn`)
  if (effect.symbol) parts.push(effect.symbol)
  if (symbol) parts.push(symbol)
  return parts
}

function isPointInRect(ref: RefObject<HTMLElement | null>, point: { x: number; y: number }): boolean {
  const el = ref.current
  if (!el) return false
  const rect = el.getBoundingClientRect()
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
}

export default function Card({
  node, available, selected, affordable, isFreeViaChain,
  onSelect, dropRefs, onPlay, onDiscard, onDragOverZone,
}: CardProps) {
  const { card, position } = node
  const style = TYPE_STYLES[card.type]
  const effects = formatEffects(card.effect, card.symbol)
  const isFree = totalCost(card.cost) === 0
  const [isDragging, setIsDragging] = useState(false)
  const [shaking, setShaking] = useState(false)

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
        // Can't afford — shake
        setShaking(true)
        setTimeout(() => setShaking(false), 400)
      }
    } else if (isPointInRect(dropRefs.discard, info.point)) {
      onDiscard?.(position)
    }
  }

  return (
    <motion.div
      layout
      drag={canDrag}
      dragSnapToOrigin
      dragElastic={0.15}
      onDrag={canDrag ? handleDrag : undefined}
      onDragStart={canDrag ? () => setIsDragging(true) : undefined}
      onDragEnd={canDrag ? handleDragEnd : undefined}
      className={`
        relative w-14 h-[4.75rem] sm:w-16 sm:h-[5.5rem] md:w-[4.75rem] md:h-[6.5rem]
        rounded-xl border-2 ${style.border} ${style.bg}
        flex flex-col overflow-hidden select-none
        transition-shadow duration-150
        ${selected ? 'ring-3 ring-blue-400/60 ring-offset-2' : ''}
        ${available ? 'cursor-grab shadow-md' : 'opacity-40 grayscale pointer-events-none shadow-none'}
        ${isDragging ? 'z-50 shadow-2xl cursor-grabbing' : ''}
        ${canDrag ? 'draggable-card' : ''}
      `}
      onClick={() => available && onSelect(position)}
      whileHover={available && !isDragging ? { y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.12)' } : undefined}
      whileTap={available && !isDragging ? { scale: 0.97 } : undefined}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={
        shaking
          ? { opacity: 1, scale: 1, x: [0, -8, 8, -6, 6, 0] }
          : isDragging
            ? { opacity: 1, scale: 1.05, x: 0 }
            : { opacity: 1, scale: 1, x: 0 }
      }
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
    >
      {/* Header with type badge + cost */}
      <div className="flex items-center justify-between px-1.5 md:px-2 pt-1.5 pb-0.5">
        <span className={`${style.badge} rounded px-1 md:px-1.5 py-0.5 font-mono text-[8px] md:text-[10px] font-medium tracking-wide text-white uppercase leading-none`}>
          {card.type.slice(0, 3)}
        </span>
        {isFree ? (
          <span className="font-mono text-[8px] md:text-[10px] text-ink-faint">free</span>
        ) : (
          <span className="font-mono text-[9px] md:text-xs font-semibold text-ink-muted">
            {formatCost(card.cost)}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="px-1.5 md:px-2 pt-0.5 pb-1">
        <p className={`font-display text-[10px] sm:text-xs md:text-sm font-bold leading-tight ${style.text}`}>
          {card.name}
        </p>
      </div>

      {/* Effects — hidden on smallest, shown on md+ */}
      <div className="mt-auto border-t border-border px-1.5 md:px-2 py-1 md:py-1.5 hidden sm:flex flex-wrap gap-0.5">
        {effects.map((e, i) => (
          <span key={i} className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[8px] md:text-[10px] font-medium text-ink-muted leading-none">
            {e}
          </span>
        ))}
      </div>

      {/* Chain indicator */}
      {card.chainTo && (
        <div className="border-t border-border/50 px-1.5 py-0.5 bg-violet-50/50 hidden sm:block">
          <span className="font-mono text-[8px] md:text-[9px] text-violet-500">
            ⛓ chains
          </span>
        </div>
      )}

      {/* FREE badge when dragging a chain-free card */}
      {isDragging && isFreeViaChain && (
        <div className="absolute -top-2 -right-2 rounded-full bg-green-500 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow-lg">
          FREE
        </div>
      )}
    </motion.div>
  )
}
