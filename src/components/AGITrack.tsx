import { motion } from 'framer-motion'
import { AGI_WIN_TARGET } from '../game/rules'
import { useGameStore } from '../store/gameStore'

const STEPS = Array.from({ length: AGI_WIN_TARGET + 1 }, (_, index) => index)

export default function AGITrack() {
  const agiTrack = useGameStore((s) => s.agiTrack)
  const players = useGameStore((s) => s.players)

  return (
    <div className="flex flex-col gap-3">
      {([0, 1] as const).map((playerIndex) => {
        const agi = agiTrack[playerIndex]
        const isAtlantic = playerIndex === 0
        const color = isAtlantic ? 'bg-atlantic' : 'bg-continental'
        const textColor = isAtlantic ? 'text-atlantic' : 'text-continental'

        return (
          <div
            key={playerIndex}
            className="rounded-[22px] border border-white/75 bg-white/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)]"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className={`font-mono text-xs font-semibold uppercase tracking-[0.14em] ${textColor}`}>
                  {players[playerIndex].name}
                </p>
                <p className="font-mono text-[10px] text-ink-faint">Push to {AGI_WIN_TARGET} for an instant AGI victory.</p>
              </div>
              <span className={`font-display text-xl font-black ${textColor}`}>{agi}/{AGI_WIN_TARGET}</span>
            </div>

            <div className={`grid gap-1.5 ${STEPS.length > 7 ? 'grid-cols-8' : 'grid-cols-7'}`}>
              {STEPS.map((step) => (
                <div
                  key={step}
                  className="relative flex h-9 items-center justify-center rounded-[14px] border border-white/75 bg-white/68 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] md:h-10"
                >
                  <span className="font-mono text-[10px] text-ink-faint">{step}</span>
                  {agi === step && (
                    <motion.div
                      layoutId={`agi-${playerIndex}`}
                      className={`absolute inset-0 rounded-[14px] ${color} shadow-[0_10px_16px_rgba(17,32,56,0.15)]`}
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
          </div>
        )
      })}
    </div>
  )
}
