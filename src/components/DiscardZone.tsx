import { forwardRef } from 'react'

interface DiscardZoneProps {
  sellValue: number
  isHighlighted?: boolean
}

const DiscardZone = forwardRef<HTMLDivElement, DiscardZoneProps>(
  function DiscardZone({ sellValue, isHighlighted }, ref) {
    return (
      <div
        ref={ref}
        className={`
          flex items-center justify-center rounded-lg border-2 border-dashed
          h-11 md:h-9 w-full transition-all duration-200
          ${isHighlighted
            ? 'border-amber-400 bg-amber-50 shadow-[0_0_16px_rgba(245,158,11,0.4)] scale-[1.02]'
            : 'border-border/40 bg-surface/30'
          }
        `}
      >
        <span
          className={`
            font-mono text-xs font-semibold transition-colors
            ${isHighlighted ? 'text-amber-700' : 'text-ink-faint'}
          `}
        >
          💰 Sell +{sellValue}
        </span>
      </div>
    )
  },
)

export default DiscardZone
