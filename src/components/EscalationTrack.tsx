import { motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'

const STEPS = Array.from({ length: 13 }, (_, i) => i - 6)

export default function EscalationTrack() {
  const esc = useGameStore((s) => s.escalationTrack)

  const markerColor =
    esc < -2 ? 'bg-atlantic' :
    esc < 0 ? 'bg-blue-400' :
    esc === 0 ? 'bg-ink-faint' :
    esc <= 2 ? 'bg-purple-400' :
    'bg-continental'

  return (
    <div>
      <div className="flex gap-px rounded bg-border/30 p-px">
        {STEPS.map((step) => {
          const isNeg = step < 0
          const isPos = step > 0
          let segBg = 'bg-white/50'
          if (isNeg) segBg = 'bg-atlantic-light/60'
          if (isPos) segBg = 'bg-continental-light/60'
          if (step === 0) segBg = 'bg-white/80'

          return (
            <div
              key={step}
              className={`relative flex-1 h-4 rounded-sm ${segBg} flex items-center justify-center`}
            >
              {(step === -6 || step === 0 || step === 6) && (
                <span className="font-mono text-[7px] text-ink-faint">
                  {step > 0 ? `+${step}` : step}
                </span>
              )}
              {esc === step && (
                <motion.div
                  layoutId="esc-marker"
                  className={`absolute inset-0 rounded-sm ${markerColor}`}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  <span className="flex items-center justify-center h-full font-mono text-[8px] font-bold text-white">
                    {step > 0 ? `+${step}` : step}
                  </span>
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="font-mono text-[8px] text-atlantic">Atlantic</span>
        <span className="font-mono text-[8px] text-continental">Continental</span>
      </div>
    </div>
  )
}
