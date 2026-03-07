import type { ResourceCost } from './cards'
import type { SystemSymbol } from './systems'

export interface HeroEffect {
  agi?: number
  escalation?: number
  capital?: number
  energyPerTurn?: number
  materialsPerTurn?: number
  computePerTurn?: number
  symbol?: SystemSymbol
}

export interface Hero {
  id: number
  name: string
  title: string
  cost: ResourceCost
  effect: HeroEffect
  description: string
}

export const HEROES: Hero[] = [
  {
    id: 0,
    name: 'Alan Arden',
    title: 'Father of Computing',
    cost: { compute: 3, energy: 1 },
    effect: { agi: 2 },
    description: 'AGI +2',
  },
  {
    id: 1,
    name: 'J.R. Oppen',
    title: 'Destroyer of Worlds',
    cost: { energy: 3, materials: 2 },
    effect: { escalation: 3 },
    description: 'Escalation +3',
  },
  {
    id: 2,
    name: 'Ada Lovewell',
    title: 'The First Programmer',
    cost: { compute: 2 },
    effect: { computePerTurn: 2, agi: 1 },
    description: 'AGI +1, +2 Compute/turn',
  },
  {
    id: 3,
    name: 'Johann Neumann',
    title: 'The Polymath',
    cost: { compute: 2, energy: 1, materials: 1 },
    effect: { agi: 1, capital: 4 },
    description: 'AGI +1, +4 Capital',
  },
  {
    id: 4,
    name: 'Nikola Teslov',
    title: 'The Visionary',
    cost: { energy: 3 },
    effect: { energyPerTurn: 3 },
    description: '+3 Energy/turn',
  },
  {
    id: 5,
    name: 'Claude Shanley',
    title: 'Father of Information',
    cost: { compute: 2, materials: 1 },
    effect: { computePerTurn: 1, symbol: 'CYBER' },
    description: '+1 Compute/turn, gain CYBER',
  },
  {
    id: 6,
    name: 'Maria Curev',
    title: 'Pioneer of the Atom',
    cost: { energy: 2, materials: 2 },
    effect: { energyPerTurn: 2, materialsPerTurn: 1 },
    description: '+2 Energy/turn, +1 Materials/turn',
  },
  {
    id: 7,
    name: 'Edsger Dahl',
    title: 'Master of Algorithms',
    cost: { compute: 2 },
    effect: { agi: 1, computePerTurn: 1 },
    description: 'AGI +1, +1 Compute/turn',
  },
  {
    id: 8,
    name: 'Tim Bernel',
    title: 'Weaver of the Web',
    cost: { compute: 1, materials: 1 },
    effect: { capital: 5 },
    description: '+5 Capital',
  },
  {
    id: 9,
    name: 'Grace Halper',
    title: 'The Admiral',
    cost: { energy: 2 },
    effect: { escalation: 2, energyPerTurn: 1 },
    description: 'Escalation +2, +1 Energy/turn',
  },
]

export const HERO_BY_ID = new Map(HEROES.map((hero) => [hero.id, hero]))

export function getHeroById(id: number): Hero {
  return HERO_BY_ID.get(id) ?? {
    id,
    name: `Unknown Hero #${id}`,
    title: 'Uncatalogued',
    cost: {},
    effect: {},
    description: 'Unknown effect',
  }
}
