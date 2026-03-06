import { SystemSymbol } from '../game/systems'
import type { Faction } from '../store/gameStore'

interface SystemsPanelProps {
  systems: SystemSymbol[]
  faction: Faction
}

const ALL_SYMBOLS: SystemSymbol[] = [
  SystemSymbol.COMPUTE,
  SystemSymbol.FINANCE,
  SystemSymbol.CYBER,
  SystemSymbol.DIPLOMACY,
  SystemSymbol.RESOURCES,
  SystemSymbol.INDUSTRY,
]

const SYMBOL_COLORS: Record<SystemSymbol, { active: string; icon: string }> = {
  COMPUTE: { active: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'C' },
  FINANCE: { active: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'F' },
  CYBER: { active: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'Y' },
  DIPLOMACY: { active: 'bg-violet-100 text-violet-700 border-violet-200', icon: 'D' },
  RESOURCES: { active: 'bg-orange-100 text-orange-700 border-orange-200', icon: 'R' },
  INDUSTRY: { active: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'I' },
}

export default function SystemsPanel({ systems }: SystemsPanelProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_SYMBOLS.map((sym) => {
        const count = systems.filter((s) => s === sym).length
        const owned = count > 0
        const colors = SYMBOL_COLORS[sym]

        return (
          <div
            key={sym}
            className={`
              rounded-lg border px-2 py-1 font-mono text-[10px] font-medium transition-all
              ${owned
                ? `${colors.active} shadow-sm`
                : 'border-border bg-surface text-ink-faint'
              }
            `}
          >
            {sym.slice(0, 3)}
            {count > 1 && <span className="ml-0.5 font-bold">x{count}</span>}
          </div>
        )
      })}
    </div>
  )
}
