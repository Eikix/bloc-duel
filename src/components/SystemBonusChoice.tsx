import { motion } from 'framer-motion'
import { SYSTEM_BONUS_LABELS } from '../game/systems'
import type { SystemSymbol } from '../game/systems'

interface SystemBonusChoiceProps {
  playerName: string
  options: SystemSymbol[]
  onChoose: (symbol: SystemSymbol) => void
}

const SYMBOL_STYLES: Record<SystemSymbol, { bg: string; border: string; text: string; icon: string }> = {
  COMPUTE: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', icon: '[C]' },
  FINANCE: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', icon: '[$]' },
  CYBER: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', icon: '[X]' },
  DIPLOMACY: { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', icon: '[D]' },
}

export default function SystemBonusChoice({ playerName, options, onChoose }: SystemBonusChoiceProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle,rgba(17,32,56,0.18),rgba(17,32,56,0.55))] px-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 430, damping: 30 }}
        className="panel-steel w-full max-w-xl rounded-[30px] px-5 py-6 text-center md:px-6"
      >
        <p className="section-label mb-2">System threshold reached</p>
        <h2 className="font-display text-3xl font-black text-ink">Choose a permanent doctrine</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
          {playerName} now controls three different systems. Select one doctrine to permanently amplify.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          {options.map((symbol) => {
            const style = SYMBOL_STYLES[symbol]

            return (
              <button
                key={symbol}
                onClick={() => onChoose(symbol)}
                className={`flex items-center gap-4 rounded-[24px] border-2 ${style.border} ${style.bg} px-4 py-4 text-left shadow-[0_14px_24px_rgba(17,32,56,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_26px_rgba(17,32,56,0.12)]`}
              >
                <span className="rounded-2xl bg-white/80 px-3 py-2 font-mono text-sm font-bold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
                  {style.icon}
                </span>
                <div className="flex-1">
                  <p className={`font-display text-lg font-black ${style.text}`}>{symbol}</p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-ink-muted">{SYSTEM_BONUS_LABELS[symbol]}</p>
                </div>
              </button>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
