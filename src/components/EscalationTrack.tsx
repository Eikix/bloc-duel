import { motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'

const STEPS = Array.from({ length: 13 }, (_, index) => index - 6)

export default function EscalationTrack() {
  const escalation = useGameStore((s) => s.escalationTrack)

  const markerColor =
    escalation < -2 ? 'bg-atlantic' :
    escalation < 0 ? 'bg-blue-400' :
    escalation === 0 ? 'bg-ink-muted' :
    escalation <= 2 ? 'bg-orange-400' :
    'bg-continental'

  return (
    <div>
      <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
        <span className="text-atlantic">Atlantic pressure</span>
        <span className="text-ink-faint">Zero line</span>
        <span className="text-continental">Continental pressure</span>
      </div>

      <div className="grid grid-cols-13 gap-1">
        {STEPS.map((step) => {
          const segmentClass = step < 0
            ? 'bg-atlantic-light/75'
            : step > 0
              ? 'bg-continental-light/72'
              : 'bg-white/82'

          return (
            <div
              key={step}
              className={`relative flex h-9 items-center justify-center rounded-xl border border-white/70 ${segmentClass} shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]`}
            >
              {(step === -6 || step === 0 || step === 6) && (
                <span className="font-mono text-[10px] text-ink-faint">{step > 0 ? `+${step}` : step}</span>
              )}
              {escalation === step && (
                <motion.div
                  layoutId="esc-marker"
                  className={`absolute inset-0 rounded-xl ${markerColor} shadow-[0_10px_18px_rgba(17,32,56,0.16)]`}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                >
                  <span className="flex h-full items-center justify-center font-mono text-[10px] font-bold text-white">
                    {step > 0 ? `+${step}` : step}
                  </span>
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
