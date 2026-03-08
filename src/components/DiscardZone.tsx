import { forwardRef } from 'react'

interface DiscardZoneProps {
  sellValue: number
  isHighlighted?: boolean
  compact?: boolean
  immersive?: boolean
}

const DiscardZone = forwardRef<HTMLDivElement, DiscardZoneProps>(
  function DiscardZone({ sellValue, isHighlighted, compact = false, immersive = false }, ref) {
    if (immersive) {
      return (
        <div
          ref={ref}
          className={`panel-glass panel-battle-glass rounded-[24px] px-3 py-3 transition ${
            isHighlighted
              ? 'border-amber-300/60 bg-[linear-gradient(135deg,rgba(116,68,18,0.52),rgba(64,38,9,0.34))] shadow-[0_18px_34px_rgba(245,158,11,0.18)]'
              : ''
          } ${compact ? 'rounded-[22px] min-h-[108px]' : 'min-h-[128px]'}`}
        >
          <div className="pointer-events-none flex h-full items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`font-display text-base font-black leading-none ${
                isHighlighted ? 'text-amber-50' : 'text-white/74'
              }`}>
                Sell draft
              </p>
              <p className={`mt-1 max-w-[7rem] font-mono text-[10px] leading-tight ${
                isHighlighted ? 'text-amber-100/82' : 'text-white/42'
              }`}>
                Convert the card into instant capital.
              </p>
            </div>
            <div className={`flex shrink-0 items-center justify-center rounded-full border ${
              isHighlighted
                ? 'h-16 w-16 border-amber-200/60 bg-amber-300/16 text-amber-50'
                : 'h-14 w-14 border-white/16 bg-white/8 text-white/64'
            } font-display text-3xl font-black shadow-[0_18px_28px_rgba(245,158,11,0.14)]`}>
              +{sellValue}
            </div>
          </div>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={`panel-glass ${immersive ? 'panel-battle-glass' : ''} rounded-[24px] px-4 py-4 ${
          isHighlighted
            ? immersive
              ? 'border-amber-300/60 bg-[linear-gradient(135deg,rgba(116,68,18,0.52),rgba(64,38,9,0.34))] shadow-[0_18px_34px_rgba(245,158,11,0.18)]'
              : 'border-amber-300 bg-[linear-gradient(135deg,rgba(255,248,220,0.96),rgba(255,238,194,0.94))] shadow-[0_18px_34px_rgba(245,158,11,0.16)]'
            : ''
        } ${compact ? 'rounded-[22px] px-3 py-2.5 md:px-4 md:py-3' : ''}`}
      >
        <div className={`flex items-center justify-between gap-2 ${compact ? 'mb-1.5' : 'mb-2'}`}>
          <p className={`section-label ${immersive ? 'text-white/45' : ''}`}>Salvage bay</p>
          <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${
            immersive
              ? isHighlighted
                ? 'border-amber-300/60 bg-amber-400/18 text-amber-100'
                : 'border-white/14 bg-white/8 text-white/66'
              : `border-amber-200 bg-amber-50 ${isHighlighted ? 'text-amber-800' : 'text-amber-700'}`
          }`}>
            Drop to sell
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`font-display font-black ${immersive ? 'text-white' : 'text-ink'} ${compact ? 'text-base' : 'text-lg'}`}>Liquidate a dossier</p>
            <p className={`${immersive ? 'text-white/54' : 'text-ink-muted'} ${compact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'}`}>Trade a draft pick for instant war funds.</p>
          </div>
          <div className={`rounded-2xl border text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${
            immersive
              ? 'border-amber-200/26 bg-[linear-gradient(180deg,rgba(255,190,92,0.18),rgba(92,52,10,0.26))]'
              : 'border-amber-200 bg-amber-50'
          } ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
            <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${immersive ? 'text-amber-100/80' : 'text-amber-700'}`}>Payout</p>
            <p className={`mt-1 font-display font-black ${immersive ? 'text-amber-50' : 'text-amber-900'} ${compact ? 'text-lg' : 'text-xl'}`}>Sell +{sellValue}</p>
          </div>
        </div>
      </div>
    )
  },
)

export default DiscardZone
