import { SYSTEM_BONUS_LABELS } from '../game/systems'
import type { SystemSymbol } from '../game/systems'

interface SystemsPanelProps {
  systems: SystemSymbol[]
  activeSystemBonuses: SystemSymbol[]
}

const SYMBOL_INFO: Record<SystemSymbol, { chip: string; label: string }> = {
  COMPUTE: { chip: 'bg-blue-500/90 text-white', label: 'COM' },
  FINANCE: { chip: 'bg-amber-500/90 text-white', label: 'FIN' },
  CYBER: { chip: 'bg-emerald-500/90 text-white', label: 'CYB' },
  DIPLOMACY: { chip: 'bg-rose-500/90 text-white', label: 'DIP' },
}

export default function SystemsPanel({ systems, activeSystemBonuses }: SystemsPanelProps) {
  const counts = new Map<SystemSymbol, number>()
  for (const system of systems) {
    counts.set(system, (counts.get(system) ?? 0) + 1)
  }

  if (counts.size === 0) {
    return <span className="font-mono text-[10px] italic text-ink-faint">No systems online</span>
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[...counts.entries()].map(([symbol, count]) => {
        const info = SYMBOL_INFO[symbol]
        const isActive = activeSystemBonuses.includes(symbol)

        return (
          <div
            key={symbol}
            className="flex items-center gap-1"
            title={`${symbol}: ${count} card${count > 1 ? 's' : ''}${isActive ? ' - BONUS: ' + SYSTEM_BONUS_LABELS[symbol] : ''}`}
          >
            <span
              className={`rounded-lg px-2 py-1 font-mono text-[10px] font-bold leading-none ${info.chip} ${
                isActive ? 'ring-2 ring-amber-300 ring-offset-1 ring-offset-white/80' : ''
              }`}
            >
              {info.label}
            </span>
            {count > 1 && <span className="font-mono text-[10px] font-semibold text-ink-muted">x{count}</span>}
          </div>
        )
      })}
    </div>
  )
}
