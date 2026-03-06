import type { Hero } from '../game/heroes'
import type { Faction } from '../store/gameStore'

interface HeroesPanelProps {
  heroes: Hero[]
  faction: Faction
}

export default function HeroesPanel({ heroes }: HeroesPanelProps) {
  if (heroes.length === 0) {
    return <p className="text-xs italic text-ink-faint">No heroes</p>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {heroes.map((hero) => (
        <div
          key={hero.id}
          className="rounded-lg border border-amber-200 bg-amber-50/50 px-2.5 py-1.5"
        >
          <span className="text-xs font-bold text-ink">{hero.name}</span>
          <span className="ml-1.5 text-[10px] italic text-amber-600">{hero.title}</span>
        </div>
      ))}
    </div>
  )
}
