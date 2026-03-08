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
    <div className="rounded-[22px] border border-white/75 bg-white/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Shared escalation track</p>
          <p className="font-mono text-[10px] text-ink-faint">Atlantic wins at -6 on the left. Continental wins at +6 on the right.</p>
        </div>
        <span className="font-display text-xl font-black text-ink">
          {escalation > 0 ? `+${escalation}` : escalation}
        </span>
      </div>

      <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
        <span className="text-atlantic">Atlantic pressure</span>
        <span className="text-ink-faint">Zero line</span>
        <span className="text-continental">Continental pressure</span>
      </div>

      <div className="grid grid-cols-13 gap-1.5">
        {STEPS.map((step) => {
          const segmentClass = step < 0
            ? 'bg-atlantic-light/75'
            : step > 0
              ? 'bg-continental-light/72'
              : 'bg-white/82'

          return (
            <div
              key={step}
              className={`relative flex h-10 items-center justify-center rounded-[14px] border border-white/70 ${segmentClass} shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:h-11`}
            >
              {(step === -6 || step === 0 || step === 6) && (
                <span className="font-mono text-[10px] text-ink-faint">{step > 0 ? `+${step}` : step}</span>
              )}
              {escalation === step && (
                <motion.div
                  layoutId="esc-marker"
                  className={`absolute inset-0 rounded-[14px] ${markerColor} shadow-[0_10px_18px_rgba(17,32,56,0.16)]`}
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
