import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { RefObject } from 'react'
import type { ResourceCost } from '../game/cards'
import type { PyramidNode } from '../game/pyramid'
import { formatCost, totalCost } from '../game/format'
import { TYPE_STYLES, formatCardEffects } from '../game/cardVisuals'
import CardArtwork from './CardArtwork'

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

const DRAG_CLICK_THRESHOLD_PX = 8

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
  const effects = formatCardEffects(card.effect, card.symbol)
  const compactEffects = effects.slice(0, 2).map((effect) => effect
    .replace(/^AGI \+/, 'AGI+')
    .replace(/^ESC \+/, 'ESC+')
    .replace(/^ESC -/, 'ESC-'))
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
        relative h-[8rem] w-[5.7rem] overflow-hidden rounded-[22px] border ${style.frame} bg-slate-950
        flex flex-col select-none transition-shadow duration-150 sm:h-[8.35rem] sm:w-[5.95rem] md:h-[8.85rem] md:w-[6.3rem] lg:h-[9.4rem] lg:w-[6.7rem] xl:h-[10rem] xl:w-[7.1rem] 2xl:h-[10.7rem] 2xl:w-[7.6rem]
        ${selected ? 'ring-2 ring-atlantic/70 ring-offset-2 ring-offset-slate-900/75' : ''}
        ${available ? `cursor-grab ${style.glow}` : 'pointer-events-none opacity-70 saturate-75 brightness-90 shadow-none'}
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
      <div className={`absolute inset-x-0 top-0 h-1.5 ${style.accent}`} />
      <CardArtwork
        card={card}
        className="absolute inset-0"
        imgClassName="scale-[1.08] object-center brightness-[1.18] saturate-[1.08] contrast-[1.05]"
        fallbackClassName={style.fallback}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-[linear-gradient(180deg,rgba(3,9,18,0.34),rgba(3,9,18,0.08)_60%,transparent)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] bg-[linear-gradient(180deg,transparent,rgba(3,9,18,0.1)_10%,rgba(3,9,18,0.52)_68%,rgba(3,9,18,0.82)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.14),transparent_30%,rgba(5,10,18,0.16)_100%)]" />

      <div className="relative flex h-full flex-col p-1.5 sm:p-2 md:p-2.5">
        <div className="flex items-start justify-between gap-2">
          <span className={`rounded-full px-1.5 py-0.5 font-mono text-[7px] font-bold uppercase tracking-[0.14em] shadow-[0_4px_12px_rgba(0,0,0,0.16)] sm:text-[7.5px] ${style.chip}`}>
            {card.type.slice(0, 3)}
          </span>
          <span className="rounded-full border border-white/12 bg-black/28 px-1.5 py-0.5 font-mono text-[7px] font-semibold text-white/88 backdrop-blur-[4px] shadow-[0_4px_12px_rgba(0,0,0,0.14)] sm:text-[7.5px]">
            {isFree ? 'FREE' : formatCost(displayCost)}
          </span>
        </div>

        <div className="mt-auto px-0.5 pb-0.5 sm:px-1 sm:pb-1">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <div className="min-w-0">
              <p className={`font-display text-[9px] font-black leading-[0.96] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] ${style.text} sm:text-[10px] md:text-[11px] lg:text-[12px] xl:text-[13px] 2xl:text-[14px]`}>
                {card.name}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-1">
                {card.chainTo !== undefined && (
                  <span className="rounded-full border border-violet-200/24 bg-violet-400/12 px-1 py-0.5 font-mono text-[6px] font-bold tracking-[0.08em] text-violet-50/92 sm:text-[6.5px]">CHAIN</span>
                )}
                {isFreeViaChain && (
                  <span className="rounded-full border border-emerald-200/24 bg-emerald-400/12 px-1 py-0.5 font-mono text-[6px] font-bold tracking-[0.08em] text-emerald-50/92 sm:text-[6.5px]">FREE</span>
                )}
              </div>
            </div>

            {compactEffects.length > 0 && (
              <div className="mb-0.5 flex shrink-0 flex-col items-end gap-1">
                {compactEffects.map((effect) => (
                  <span
                    key={effect}
                    className="rounded-full border border-white/12 bg-black/26 px-1.5 py-0.5 font-mono text-[6px] font-bold leading-none text-white/86 backdrop-blur-[4px] sm:text-[6.5px] md:text-[7px]"
                  >
                    {effect}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!available && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/24 backdrop-blur-[0.5px]">
          <span className="rounded-full border border-white/12 bg-black/55 px-3 py-1 font-mono text-[10px] font-bold tracking-[0.14em] text-white/88 shadow-sm">
            LOCKED
          </span>
        </div>
      )}
    </motion.div>
  )
}
