import { motion } from 'framer-motion'
import { useGameStore } from '../store/gameStore'

const STEPS = [0, 1, 2, 3, 4, 5, 6]

export default function AGITrack() {
  const agiTrack = useGameStore((s) => s.agiTrack)
  const players = useGameStore((s) => s.players)

  return (
    <div className="flex flex-col gap-1">
      {([0, 1] as const).map((pi) => {
        const agi = agiTrack[pi]
        const isAtlantic = pi === 0
        const color = isAtlantic ? 'bg-atlantic' : 'bg-continental'
        const dotColor = isAtlantic ? 'bg-atlantic' : 'bg-continental'
        const textColor = isAtlantic ? 'text-atlantic' : 'text-continental'

        return (
          <div key={pi} className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
            <span className={`font-mono text-[9px] font-medium ${textColor} w-6 shrink-0 truncate`}>
              {players[pi].name.split(' ')[0]}
            </span>
            <div className="flex gap-px flex-1">
              {STEPS.map((step) => (
                <div
                  key={step}
                  className="relative flex-1 h-4 rounded-sm bg-border/30 flex items-center justify-center"
                >
                  {agi === step && (
                    <motion.div
                      layoutId={`agi-${pi}`}
                      className={`absolute inset-0 rounded-sm ${color}`}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    >
                      <span className="flex items-center justify-center h-full font-mono text-[9px] font-bold text-white">
                        {step}
                      </span>
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
            <span className={`font-mono text-[9px] font-medium ${textColor} w-5 text-right shrink-0`}>
              {agi}/6
            </span>
          </div>
        )
      })}
    </div>
  )
}
