import { motion } from 'framer-motion'
import { SYSTEM_BONUS_LABELS } from '../game/systems'
import type { SystemSymbol } from '../game/systems'

interface SystemBonusChoiceProps {
  playerName: string
  options: SystemSymbol[]
  onChoose: (symbol: SystemSymbol) => void
}

const SYMBOL_STYLES: Record<SystemSymbol, { bg: string; border: string; text: string; icon: string }> = {
  COMPUTE: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', icon: '\uD83D\uDDA5\uFE0F' },
  FINANCE: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', icon: '\uD83D\uDCB0' },
  CYBER: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', icon: '\u2694\uFE0F' },
  DIPLOMACY: { bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700', icon: '\uD83D\uDD4A\uFE0F' },
}

export default function SystemBonusChoice({ playerName, options, onChoose }: SystemBonusChoiceProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className="rounded-2xl bg-surface-raised p-6 text-center shadow-2xl border border-border max-w-sm mx-4"
      >
        <h2 className="font-display text-xl font-black text-ink mb-1">
          System Bonus
        </h2>
        <p className="text-sm text-ink-muted mb-4">
          {playerName} has 3 different systems! Choose a bonus:
        </p>
        <div className="flex flex-col gap-2">
          {options.map((sym) => {
            const style = SYMBOL_STYLES[sym]
            return (
              <button
                key={sym}
                onClick={() => onChoose(sym)}
                className={`
                  flex items-center gap-3 rounded-xl border-2 ${style.border} ${style.bg} px-4 py-3 transition
                  hover:shadow-md hover:scale-[1.02] active:scale-[0.98]
                `}
              >
                <span className="text-2xl">{style.icon}</span>
                <div className="text-left flex-1">
                  <p className={`font-display text-sm font-bold ${style.text}`}>{sym}</p>
                  <p className="font-mono text-[11px] text-ink-muted">{SYSTEM_BONUS_LABELS[sym]}</p>
                </div>
              </button>
            )
          })}
        </div>
      </motion.div>
    </motion.div>
  )
}
