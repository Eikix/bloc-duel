import { motion } from 'framer-motion'
import type { Card, ResourceCost } from '../game/cards'
import { getCardById } from '../game/cards'
import { formatCost, totalCost } from '../game/format'
import { buildCardEffectEntries, TYPE_STYLES } from '../game/cardVisuals'
import CardArtwork from './CardArtwork'

interface CardZoomProps {
  card: Card
  affordable: boolean
  isFreeViaChain: boolean
  effectiveCost?: ResourceCost
  sellValue: number
  onPlay?: () => void
  onDiscard?: () => void
  onClose: () => void
  inspectionOnly?: boolean
}

export default function CardZoom({
  card, affordable, isFreeViaChain, effectiveCost, sellValue,
  onPlay, onDiscard, onClose, inspectionOnly = false,
}: CardZoomProps) {
  const style = TYPE_STYLES[card.type]
  const displayCost = effectiveCost ?? card.cost
  const isFree = totalCost(displayCost) === 0
  const chainFromName = card.chainFrom !== undefined ? getCardById(card.chainFrom).name : null
  const chainToName = card.chainTo !== undefined ? getCardById(card.chainTo).name : null
  const effects = buildCardEffectEntries(card)

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
        className={`relative w-full max-w-xl overflow-hidden rounded-[30px] border ${style.frame} bg-slate-950 shadow-[0_38px_80px_rgba(17,32,56,0.28)]`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`h-2.5 ${style.accent}`} />

        <div className="relative h-[23rem] overflow-hidden sm:h-[26rem]">
          <CardArtwork
            card={card}
            className="h-full w-full"
            imgClassName="brightness-[1.1] saturate-[1.06] contrast-[1.03]"
            fallbackClassName={style.fallback}
            loading="eager"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(4,10,18,0.54),rgba(4,10,18,0.14)_58%,transparent)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] bg-[linear-gradient(180deg,transparent,rgba(4,10,18,0.18)_18%,rgba(4,10,18,0.74)_62%,rgba(4,10,18,0.92)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.18),transparent_28%,rgba(4,10,18,0.24)_100%)]" />

          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-5 py-5 md:px-6 md:py-6">
            <div>
              <p className="section-label mb-2 text-white/68">Dossier inspection</p>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] shadow-[0_6px_16px_rgba(0,0,0,0.22)] ${style.chip}`}>
                  {card.type}
                </span>
                <span className="rounded-full border border-white/14 bg-black/45 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white/88 backdrop-blur-md">
                  Age {card.age}
                </span>
              </div>
            </div>

            <span className="rounded-full border border-white/14 bg-black/45 px-3 py-1 font-mono text-sm font-bold text-white/92 backdrop-blur-md shadow-[0_6px_16px_rgba(0,0,0,0.22)]">
              {isFreeViaChain ? 'FREE via chain' : isFree ? 'FREE' : formatCost(displayCost)}
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 px-5 pb-5 md:px-6 md:pb-6">
            <div className="rounded-[24px] border border-white/14 bg-black/24 p-4 backdrop-blur-[10px] shadow-[0_18px_32px_rgba(0,0,0,0.2)]">
              <h3 className={`font-display text-3xl font-black leading-[0.98] drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] ${style.text}`}>{card.name}</h3>

              <div className="mt-3 flex flex-wrap gap-2">
                {card.chainFrom !== undefined && (
                  <span className="rounded-full border border-violet-200/30 bg-violet-400/18 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-violet-50">Chain upgrade</span>
                )}
                {card.chainTo !== undefined && (
                  <span className="rounded-full border border-cyan-200/30 bg-cyan-400/18 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-50">Future link</span>
                )}
                {isFreeViaChain && (
                  <span className="rounded-full border border-emerald-200/30 bg-emerald-400/18 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-50">Deploy free</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={`relative px-5 py-5 md:px-6 md:py-6 ${style.surface}`}>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {effects.map((fx) => (
              <div
                key={`${fx.label}-${fx.value}`}
                className="rounded-2xl border border-white/76 bg-white/68 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]"
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

          {inspectionOnly ? (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="rounded-[22px] border border-white/76 bg-white/56 px-4 py-3 font-mono text-xs text-ink-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]">
                Observation only. You can inspect this dossier even when it is already deployed or not currently actionable.
              </div>
              <button
                onClick={onClose}
                className="rounded-2xl border border-white/78 bg-white/64 px-4 py-3 font-mono text-sm font-semibold text-ink-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] transition hover:-translate-y-0.5 hover:text-ink"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={onPlay}
                disabled={!onPlay || (!affordable && !isFreeViaChain)}
                className={`rounded-2xl px-4 py-3 font-mono text-sm font-semibold text-white transition ${
                  onPlay && (affordable || isFreeViaChain)
                    ? 'bg-[linear-gradient(135deg,#112038,#274e79)] shadow-[0_18px_28px_rgba(17,32,56,0.2)] hover:-translate-y-0.5 hover:brightness-105'
                    : 'cursor-not-allowed bg-ink-faint/70'
                }`}
              >
                Deploy dossier
              </button>
              <button
                onClick={onDiscard}
                disabled={!onDiscard}
                className={`rounded-2xl border px-4 py-3 font-mono text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] transition ${
                  onDiscard
                    ? 'border-white/78 bg-white/64 text-ink-muted hover:-translate-y-0.5 hover:text-ink'
                    : 'cursor-not-allowed border-white/60 bg-white/36 text-ink-faint'
                }`}
              >
                Salvage for +{sellValue}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
