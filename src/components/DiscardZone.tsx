import { forwardRef } from 'react'

interface DiscardZoneProps {
  sellValue: number
  isHighlighted?: boolean
  compact?: boolean
}

const DiscardZone = forwardRef<HTMLDivElement, DiscardZoneProps>(
  function DiscardZone({ sellValue, isHighlighted, compact = false }, ref) {
    return (
      <div
        ref={ref}
        className={`panel-glass rounded-[24px] px-4 py-4 ${
          isHighlighted
            ? 'border-amber-300 bg-[linear-gradient(135deg,rgba(255,248,220,0.96),rgba(255,238,194,0.94))] shadow-[0_18px_34px_rgba(245,158,11,0.16)]'
            : ''
        } ${compact ? 'rounded-[22px] px-3 py-2.5 md:px-4 md:py-3' : ''}`}
      >
        <div className={`flex items-center justify-between gap-2 ${compact ? 'mb-1.5' : 'mb-2'}`}>
          <p className="section-label">Salvage bay</p>
          <span className={`rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${
            isHighlighted ? 'text-amber-800' : 'text-amber-700'
          }`}>
            Drop to sell
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`font-display font-black text-ink ${compact ? 'text-base' : 'text-lg'}`}>Liquidate a dossier</p>
            <p className={`text-ink-muted ${compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'}`}>Trade a draft pick for instant war funds.</p>
          </div>
          <div className={`rounded-2xl border border-amber-200 bg-amber-50 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-700">Payout</p>
            <p className={`mt-1 font-display font-black text-amber-900 ${compact ? 'text-lg' : 'text-xl'}`}>Sell +{sellValue}</p>
          </div>
        </div>
      </div>
    )
  },
)

export default DiscardZone
