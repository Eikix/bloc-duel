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

const TYPE_STYLES: Record<CardType, { banner: string; frame: string; tint: string; text: string; chip: string }> = {
  AI: {
    banner: 'bg-blue-500',
    frame: 'border-blue-200/90',
    tint: 'bg-[linear-gradient(180deg,rgba(237,245,255,0.98),rgba(218,233,252,0.94))]',
    text: 'text-blue-800',
    chip: 'bg-blue-500 text-white',
  },
  ECONOMY: {
    banner: 'bg-amber-500',
    frame: 'border-amber-200/90',
    tint: 'bg-[linear-gradient(180deg,rgba(255,250,236,0.98),rgba(251,236,193,0.92))]',
    text: 'text-amber-900',
    chip: 'bg-amber-500 text-white',
  },
  MILITARY: {
    banner: 'bg-red-500',
    frame: 'border-red-200/90',
    tint: 'bg-[linear-gradient(180deg,rgba(255,241,239,0.98),rgba(251,220,214,0.92))]',
    text: 'text-red-800',
    chip: 'bg-red-500 text-white',
  },
  SYSTEM: {
    banner: 'bg-emerald-500',
    frame: 'border-emerald-200/90',
    tint: 'bg-[linear-gradient(180deg,rgba(238,255,247,0.98),rgba(214,245,231,0.92))]',
    text: 'text-emerald-800',
    chip: 'bg-emerald-500 text-white',
  },
}

const DRAG_CLICK_THRESHOLD_PX = 8

function formatEffects(effect: CardEffect, symbol?: SystemSymbol): string[] {
  const parts: string[] = []
  if (effect.agi) parts.push(`AGI +${effect.agi}`)
  if (effect.escalation) {
    const sign = effect.escalation > 0 ? '+' : ''
    parts.push(`ESC ${sign}${effect.escalation}`)
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
  const element = ref.current
  if (!element) return false
  const rect = element.getBoundingClientRect()
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
  const pressStartRef = useRef<{ x: number; y: number } | null>(null)

  const canDrag = available && !!dropRefs

  const handleDrag = (_: unknown, info: { point: { x: number; y: number } }) => {
    if (pressStartRef.current) {
      const dx = info.point.x - pressStartRef.current.x
      const dy = info.point.y - pressStartRef.current.y
      if (Math.hypot(dx, dy) > DRAG_CLICK_THRESHOLD_PX) {
        didDragRef.current = true
      }
    }

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
    pressStartRef.current = null
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
      onDragStart={canDrag ? () => setIsDragging(true) : undefined}
      onDragEnd={canDrag ? handleDragEnd : undefined}
      onPointerDownCapture={(event) => {
        didDragRef.current = false
        pressStartRef.current = { x: event.clientX, y: event.clientY }
      }}
      className={`
        relative h-28 w-[4.9rem] overflow-hidden rounded-[18px] border ${style.frame} ${style.tint}
        flex flex-col select-none transition-shadow duration-150 sm:h-[7rem] sm:w-[5.15rem] md:h-[7.35rem] md:w-[5.3rem] lg:h-[7.75rem] lg:w-[5.55rem] xl:h-[8.1rem] xl:w-[5.8rem]
        ${selected ? 'ring-2 ring-atlantic/60 ring-offset-2 ring-offset-white/70' : ''}
        ${available ? 'cursor-grab shadow-[0_16px_24px_rgba(77,95,121,0.18)]' : 'pointer-events-none opacity-30 grayscale shadow-none'}
        ${isDragging ? 'z-[100] cursor-grabbing shadow-[0_26px_36px_rgba(42,59,83,0.24)]' : ''}
        ${canDrag ? 'draggable-card' : ''}
      `}
      onClick={() => {
        if (didDragRef.current) {
          didDragRef.current = false
          return
        }
        if (available) onSelect(position)
      }}
      whileHover={available && !isDragging ? { scale: 1.05, y: -4 } : undefined}
      whileTap={available && !isDragging ? { scale: 0.98 } : undefined}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={
        shaking
          ? { opacity: 1, scale: 1, x: [0, -8, 8, -6, 6, 0] }
          : isDragging
            ? { opacity: 1, scale: 1.08, rotate: 2 }
            : { opacity: 1, scale: 1, rotate: 0 }
      }
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
    >
      <div className={`absolute inset-x-0 top-0 h-2 ${style.banner}`} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(150deg,rgba(255,255,255,0.36),transparent_45%,rgba(17,32,56,0.08))]" />

      <div className="relative flex items-center justify-between px-2 pb-1 pt-3 md:px-2.5">
        <span className={`rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.16em] ${style.chip}`}>
          {card.type.slice(0, 3)}
        </span>
        <span className="rounded-full bg-white/78 px-1.5 py-0.5 font-mono text-[8px] font-semibold text-ink-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          {isFree ? 'free' : formatCost(displayCost)}
        </span>
      </div>

      <div className="relative flex-1 px-2 md:px-2.5">
        <p className={`font-display text-[11px] font-black leading-[1.02] ${style.text} sm:text-[12px] md:text-[13px] lg:text-[14px] xl:text-[15px]`}>
          {card.name}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1">
          {card.chainTo !== undefined && (
            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 font-mono text-[8px] font-bold text-violet-700">CHAIN</span>
          )}
          {isFreeViaChain && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-mono text-[8px] font-bold text-emerald-700">FREE</span>
          )}
        </div>
      </div>

      <div className="relative mt-auto px-2 pb-2 md:px-2.5 md:pb-2.5">
        <div className="rounded-xl border border-white/70 bg-white/66 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
          <p className="line-clamp-2 font-mono text-[7px] leading-tight text-ink-muted sm:text-[7.5px] md:text-[8px] lg:text-[8.5px] xl:text-[9px]">
            {effects.join(' / ')}
          </p>
        </div>
      </div>

      {!available && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/18 backdrop-blur-[1px]">
          <span className="rounded-full bg-white/80 px-3 py-1 font-mono text-[10px] font-bold tracking-[0.14em] text-ink-faint shadow-sm">
            LOCKED
          </span>
        </div>
      )}
    </motion.div>
  )
}
