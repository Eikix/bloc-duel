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
  AI: {
    stripe: 'bg-blue-500',
    bg: 'bg-[linear-gradient(180deg,rgba(240,247,255,0.98),rgba(217,231,252,0.95))]',
    badge: 'bg-blue-500 text-white',
    text: 'text-blue-800',
  },
  ECONOMY: {
    stripe: 'bg-amber-500',
    bg: 'bg-[linear-gradient(180deg,rgba(255,251,239,0.98),rgba(251,235,189,0.94))]',
    badge: 'bg-amber-500 text-white',
    text: 'text-amber-900',
  },
  MILITARY: {
    stripe: 'bg-red-500',
    bg: 'bg-[linear-gradient(180deg,rgba(255,242,239,0.98),rgba(250,218,212,0.94))]',
    badge: 'bg-red-500 text-white',
    text: 'text-red-800',
  },
  SYSTEM: {
    stripe: 'bg-emerald-500',
    bg: 'bg-[linear-gradient(180deg,rgba(239,255,247,0.98),rgba(213,244,229,0.94))]',
    badge: 'bg-emerald-500 text-white',
    text: 'text-emerald-800',
  },
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
  const effect = card.effect
  if (effect.agi) effects.push({ label: 'AGI gain', value: `+${effect.agi}` })
  if (effect.escalation) effects.push({ label: 'Escalation shift', value: `${effect.escalation > 0 ? '+' : ''}${effect.escalation}` })
  if (effect.capital) effects.push({ label: 'Immediate capital', value: `+${effect.capital}` })
  if (effect.energyPerTurn) effects.push({ label: `${RESOURCE_ICONS.energy} Energy income`, value: `+${effect.energyPerTurn}` })
  if (effect.materialsPerTurn) effects.push({ label: `${RESOURCE_ICONS.materials} Materials income`, value: `+${effect.materialsPerTurn}` })
  if (effect.computePerTurn) effects.push({ label: `${RESOURCE_ICONS.compute} Compute income`, value: `+${effect.computePerTurn}` })
  if (effect.symbol) effects.push({ label: 'System unlocked', value: effect.symbol })
  if (card.symbol) effects.push({ label: 'System unlocked', value: card.symbol })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle,rgba(17,32,56,0.18),rgba(17,32,56,0.52))] px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className={`relative w-full max-w-lg overflow-hidden rounded-[30px] border border-white/75 ${style.bg} shadow-[0_38px_80px_rgba(17,32,56,0.28)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`h-2.5 ${style.stripe}`} />
        <div className="absolute inset-0 bg-[linear-gradient(155deg,rgba(255,255,255,0.3),transparent_45%,rgba(17,32,56,0.05))] pointer-events-none" />

        <div className="relative px-5 py-5 md:px-6 md:py-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="section-label mb-2">Dossier inspection</p>
              <h3 className={`font-display text-3xl font-black leading-[0.98] ${style.text}`}>{card.name}</h3>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] ${style.badge}`}>
                {card.type}
              </span>
              <span className="rounded-full bg-white/78 px-3 py-1 font-mono text-sm font-bold text-ink-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                {isFreeViaChain ? 'FREE via chain' : isFree ? 'Free' : formatCost(displayCost)}
              </span>
            </div>
          </div>

          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {effects.map((fx) => (
              <div
                key={`${fx.label}-${fx.value}`}
                className="rounded-2xl border border-white/76 bg-white/62 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">{fx.label}</p>
                <p className="mt-1 font-display text-lg font-black text-ink">{fx.value}</p>
              </div>
            ))}
          </div>

          {(card.chainFrom !== undefined || card.chainTo !== undefined) && (
            <div className="mb-4 rounded-[22px] border border-violet-200/75 bg-violet-50/78 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
              <p className="section-label mb-2 text-violet-500">Chain protocol</p>
              <div className="space-y-1 font-mono text-xs text-violet-700">
                {chainFromName && <p>Unlock for free if you already deployed {chainFromName}.</p>}
                {chainToName && <p>This dossier discounts into {chainToName} later.</p>}
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={onPlay}
              disabled={!affordable && !isFreeViaChain}
              className={`rounded-2xl px-4 py-3 font-mono text-sm font-semibold text-white transition ${
                affordable || isFreeViaChain
                  ? 'bg-[linear-gradient(135deg,#112038,#274e79)] shadow-[0_18px_28px_rgba(17,32,56,0.2)] hover:-translate-y-0.5 hover:brightness-105'
                  : 'cursor-not-allowed bg-ink-faint/70'
              }`}
            >
              Deploy dossier
            </button>
            <button
              onClick={onDiscard}
              className="rounded-2xl border border-white/78 bg-white/64 px-4 py-3 font-mono text-sm font-semibold text-ink-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] transition hover:-translate-y-0.5 hover:text-ink"
            >
              Salvage for +{sellValue}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
