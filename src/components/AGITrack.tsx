import { motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'

const STEPS = [0, 1, 2, 3, 4, 5, 6]

export default function AGITrack() {
  const agiTrack = useGameStore((s) => s.agiTrack)
  const players = useGameStore((s) => s.players)

  return (
    <div className="flex flex-col gap-2.5">
      {([0, 1] as const).map((playerIndex) => {
        const agi = agiTrack[playerIndex]
        const isAtlantic = playerIndex === 0
        const color = isAtlantic ? 'bg-atlantic' : 'bg-continental'
        const textColor = isAtlantic ? 'text-atlantic' : 'text-continental'

        return (
          <div key={playerIndex} className="grid grid-cols-[84px_minmax(0,1fr)_38px] items-center gap-2">
            <div>
              <p className={`font-mono text-[11px] font-semibold ${textColor}`}>{players[playerIndex].name.split(' ')[0]}</p>
              <p className="font-mono text-[10px] text-ink-faint">AGI race</p>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {STEPS.map((step) => (
                <div
                  key={step}
                  className="relative flex h-8 items-center justify-center rounded-xl border border-white/75 bg-white/62 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]"
                >
                  <span className="font-mono text-[10px] text-ink-faint">{step}</span>
                  {agi === step && (
                    <motion.div
                      layoutId={`agi-${playerIndex}`}
                      className={`absolute inset-0 rounded-xl ${color} shadow-[0_10px_16px_rgba(17,32,56,0.15)]`}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    >
                      <span className="flex h-full items-center justify-center font-mono text-[10px] font-bold text-white">
                        {step}
                      </span>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>

            <span className={`font-mono text-[11px] font-semibold ${textColor}`}>{agi}/6</span>
          </div>
        )
      })}
    </div>
  )
}
