import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore, canAfford } from '../store/gameStore'
import { formatCost } from '../game/format'

export default function HeroPicker() {
  const open = useGameStore((s) => s.heroPickerOpen)
  const heroes = useGameStore((s) => s.availableHeroes)
  const current = useGameStore((s) => s.players[s.currentPlayer])
  const invokeHero = useGameStore((s) => s.invokeHero)
  const toggle = useGameStore((s) => s.toggleHeroPicker)

  const surcharge = current.heroes.length * 2

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/25 backdrop-blur-sm"
          onClick={toggle}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <div className="text-center mb-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint mb-1">
                Invoke a Hero
              </p>
              <p className="font-body text-xs text-ink-muted">
                Replaces your draft pick this turn.
                {surcharge > 0 && (
                  <span className="ml-1 text-amber-600 font-semibold">
                    Surcharge: 💰+{surcharge}
                  </span>
                )}
              </p>
            </div>

            {/* Hero cards */}
            <div className="flex gap-4 justify-center">
              {heroes.map((hero, i) => {
                const affordable = canAfford(current, hero.cost, surcharge)
                return (
                  <motion.button
                    key={hero.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    disabled={!affordable}
                    onClick={() => invokeHero(hero.id)}
                    className={`
                      group relative w-52 rounded-2xl border-2 bg-surface-raised text-left
                      transition-all duration-200
                      ${affordable
                        ? 'border-amber-300 shadow-lg hover:shadow-xl hover:border-amber-400 cursor-pointer'
                        : 'border-border opacity-50 cursor-not-allowed'
                      }
                    `}
                  >
                    {/* Gold accent bar */}
                    <div className="h-1.5 rounded-t-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />

                    <div className="px-4 pt-3 pb-4">
                      {/* Cost badge */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                          Hero
                        </span>
                        <span className={`
                          rounded-full px-2 py-0.5 font-mono text-xs font-bold
                          ${affordable
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-400'
                          }
                        `}>
                          {formatCost(hero.cost)}
                          {surcharge > 0 && ` +${surcharge}`}
                        </span>
                      </div>

                      {/* Name */}
                      <h4 className="font-display text-base font-bold text-ink leading-tight mb-0.5">
                        {hero.name}
                      </h4>

                      {/* Title */}
                      <p className="font-body text-[11px] font-medium text-amber-600 italic mb-2">
                        {hero.title}
                      </p>

                      {/* Mechanical description */}
                      <p className="font-mono text-xs text-ink-muted leading-relaxed">
                        {hero.description}
                      </p>
                    </div>

                    {/* Hover glow */}
                    {affordable && (
                      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ring-2 ring-amber-300/40" />
                    )}
                  </motion.button>
                )
              })}
            </div>

            {/* Close hint */}
            <p className="text-center mt-5 font-mono text-[10px] text-ink-faint">
              Click outside to close
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
