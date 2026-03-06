import { SYSTEM_BONUS_LABELS } from '../game/systems'
import type { SystemSymbol } from '../game/systems'

interface SystemsPanelProps {
  systems: SystemSymbol[]
  activeSystemBonuses: SystemSymbol[]
}

const SYMBOL_INFO: Record<SystemSymbol, { color: string; label: string }> = {
  COMPUTE: { color: 'bg-blue-500', label: 'COM' },
  FINANCE: { color: 'bg-amber-500', label: 'FIN' },
  CYBER: { color: 'bg-emerald-500', label: 'CYB' },
  DIPLOMACY: { color: 'bg-violet-500', label: 'DIP' },
}

export default function SystemsPanel({ systems, activeSystemBonuses }: SystemsPanelProps) {
  // Group by symbol and count
  const counts = new Map<SystemSymbol, number>()
  for (const s of systems) {
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }

  if (counts.size === 0) {
    return <span className="font-mono text-[9px] text-ink-faint italic">no systems</span>
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {[...counts.entries()].map(([sym, count]) => {
        const info = SYMBOL_INFO[sym]
        const isActive = activeSystemBonuses.includes(sym)
        return (
          <div
            key={sym}
            className="flex items-center gap-0.5"
            title={`${sym}: ${count} card${count > 1 ? 's' : ''}${isActive ? ' \u2014 BONUS: ' + SYSTEM_BONUS_LABELS[sym] : ''}`}
          >
            <span className={`${info.color} rounded px-1 py-0.5 font-mono text-[9px] font-bold text-white leading-none ${isActive ? 'ring-1 ring-yellow-400' : ''}`}>
              {info.label}
            </span>
            {count > 1 && (
              <span className="font-mono text-[9px] font-bold text-ink-muted">
                x{count}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
