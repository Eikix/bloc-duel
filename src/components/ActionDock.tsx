import { forwardRef } from 'react'

interface ActionDockProps {
  label: string
  value: string
  variant: 'deploy' | 'sell'
  isHighlighted?: boolean
}

const VARIANT_STYLES = {
  deploy: {
    border: 'border-blue-200/90',
    bg: 'bg-blue-50/55',
    text: 'text-blue-700',
    shadow: 'shadow-[0_18px_28px_rgba(59,130,246,0.12)]',
    chip: 'bg-blue-100 text-blue-700 border-blue-200/90',
  },
  sell: {
    border: 'border-amber-200/90',
    bg: 'bg-amber-50/55',
    text: 'text-amber-700',
    shadow: 'shadow-[0_18px_28px_rgba(245,158,11,0.12)]',
    chip: 'bg-amber-100 text-amber-700 border-amber-200/90',
  },
} as const

const ActionDock = forwardRef<HTMLDivElement, ActionDockProps>(function ActionDock(
  { label, value, variant, isHighlighted = false },
  ref,
) {
  const style = VARIANT_STYLES[variant]

  return (
    <div
      ref={ref}
      className={`
        flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-[30px] border-2 border-dashed
        bg-white/62 text-center backdrop-blur-sm transition-all duration-200
        ${style.border}
        ${isHighlighted ? `${style.bg} ${style.shadow} scale-[1.04]` : 'shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]'}
      `}
    >
      <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${style.chip}`}>
        {label}
      </span>
      <span className={`mt-2 font-display text-xl font-black ${style.text}`}>{value}</span>
    </div>
  )
})

export default ActionDock
