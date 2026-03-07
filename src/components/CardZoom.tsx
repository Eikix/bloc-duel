import { motion } from 'framer-motion'
import type { Card, CardType, ResourceCost } from '../game/cards'
import { getCardById } from '../game/cards'
import { formatCost, totalCost, RESOURCE_ICONS } from '../game/format'

interface CardZoomProps {
  card: Card
  affordable: boolean
  isFreeViaChain: boolean
  effectiveCost?: ResourceCost
  sellValue: number
  onPlay: () => void
  onDiscard: () => void
  onClose: () => void
}

const TYPE_STYLES: Record<CardType, { stripe: string; bg: string; badge: string; text: string }> = {
  AI: { stripe: 'bg-blue-500', bg: 'bg-gradient-to-b from-blue-50 to-white', badge: 'bg-blue-500', text: 'text-blue-700' },
  ECONOMY: { stripe: 'bg-amber-500', bg: 'bg-gradient-to-b from-amber-50 to-white', badge: 'bg-amber-500', text: 'text-amber-700' },
  MILITARY: { stripe: 'bg-red-500', bg: 'bg-gradient-to-b from-red-50 to-white', badge: 'bg-red-500', text: 'text-red-700' },
  SYSTEM: { stripe: 'bg-emerald-500', bg: 'bg-gradient-to-b from-emerald-50 to-white', badge: 'bg-emerald-500', text: 'text-emerald-700' },
}

export default function CardZoom({
  card, affordable, isFreeViaChain, effectiveCost, sellValue,
  onPlay, onDiscard, onClose,
}: CardZoomProps) {
  const style = TYPE_STYLES[card.type]
  const displayCost = effectiveCost ?? card.cost
  const isFree = totalCost(displayCost) === 0
  const chainFromName = card.chainFrom !== undefined ? getCardById(card.chainFrom).name : null
  const chainToName = card.chainTo !== undefined ? getCardById(card.chainTo).name : null

  const effects: { label: string; value: string }[] = []
  const e = card.effect
  if (e.agi) effects.push({ label: 'AGI', value: `+${e.agi}` })
  if (e.escalation) effects.push({ label: 'Escalation', value: `${e.escalation > 0 ? '+' : ''}${e.escalation}` })
  if (e.capital) effects.push({ label: 'Capital', value: `+${e.capital}` })
  if (e.energyPerTurn) effects.push({ label: `${RESOURCE_ICONS.energy} Energy/turn`, value: `+${e.energyPerTurn}` })
  if (e.materialsPerTurn) effects.push({ label: `${RESOURCE_ICONS.materials} Materials/turn`, value: `+${e.materialsPerTurn}` })
  if (e.computePerTurn) effects.push({ label: `${RESOURCE_ICONS.compute} Compute/turn`, value: `+${e.computePerTurn}` })
  if (e.symbol) effects.push({ label: 'System', value: e.symbol })
  if (card.symbol) effects.push({ label: 'System', value: card.symbol })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className={`w-56 rounded-2xl border border-border/60 ${style.bg} shadow-2xl overflow-hidden`}
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* Color bar */}
        <div className={`${style.stripe} h-2`} />

        <div className="px-4 pt-3 pb-4">
          {/* Type badge + cost */}
          <div className="flex items-center justify-between mb-2">
            <span className={`${style.badge} rounded-md px-2 py-0.5 font-mono text-[10px] font-medium tracking-wide text-white uppercase`}>
              {card.type}
            </span>
            <span className="font-mono text-sm font-bold text-ink-muted">
              {isFreeViaChain ? (
                <span className="text-green-600">FREE</span>
              ) : isFree ? 'free' : formatCost(displayCost)}
            </span>
          </div>

          {/* Name */}
          <h3 className={`font-display text-lg font-bold leading-tight ${style.text} mb-3`}>
            {card.name}
          </h3>

          {/* Effects list */}
          <div className="space-y-1.5 mb-3">
            {effects.map((fx, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="font-body text-xs text-ink-muted">{fx.label}</span>
                <span className="font-mono text-sm font-bold text-ink">{fx.value}</span>
              </div>
            ))}
          </div>

          {/* Chain info */}
          {(card.chainFrom !== undefined || card.chainTo !== undefined) && (
            <div className="rounded-lg bg-violet-50 border border-violet-200/60 px-2.5 py-1.5 mb-3">
              {chainFromName && (
                <p className="font-mono text-[10px] text-violet-600">
                  ⛓ Chains from: <span className="font-semibold">{chainFromName}</span>
                </p>
              )}
              {chainToName && (
                <p className="font-mono text-[10px] text-violet-600">
                  ⛓ Chains to: <span className="font-semibold">{chainToName}</span>
                </p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={onPlay}
              disabled={!affordable && !isFreeViaChain}
              className={`flex-1 rounded-lg py-2 font-mono text-xs font-semibold text-white transition ${
                affordable || isFreeViaChain
                  ? 'bg-ink hover:bg-ink/80 shadow-sm'
                  : 'bg-ink-faint cursor-not-allowed'
              }`}
            >
              Play
            </button>
            <button
              onClick={onDiscard}
              className="flex-1 rounded-lg border border-border py-2 font-mono text-xs font-medium text-ink-muted transition hover:bg-surface hover:text-ink"
            >
              Sell +{sellValue}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
