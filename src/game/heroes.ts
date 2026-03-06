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
  id: string
  name: string
  title: string
  cost: ResourceCost
  effect: HeroEffect
  description: string
}

export const HEROES: Hero[] = [
  {
    id: 'hero-turing',
    name: 'Alan Arden',
    title: 'Father of Computing',
    cost: { compute: 3, energy: 1 },
    effect: { agi: 2 },
    description: 'AGI +2',
  },
  {
    id: 'hero-oppenheimer',
    name: 'J.R. Oppen',
    title: 'Destroyer of Worlds',
    cost: { energy: 3, materials: 2 },
    effect: { escalation: 3 },
    description: 'Escalation +3',
  },
  {
    id: 'hero-lovelace',
    name: 'Ada Lovewell',
    title: 'The First Programmer',
    cost: { compute: 2 },
    effect: { computePerTurn: 2, agi: 1 },
    description: 'AGI +1, +2 Compute/turn',
  },
  {
    id: 'hero-vonneumann',
    name: 'Johann Neumann',
    title: 'The Polymath',
    cost: { compute: 2, energy: 1, materials: 1 },
    effect: { agi: 1, capital: 4 },
    description: 'AGI +1, +4 Capital',
  },
  {
    id: 'hero-tesla',
    name: 'Nikola Teslov',
    title: 'The Visionary',
    cost: { energy: 3 },
    effect: { energyPerTurn: 3 },
    description: '+3 Energy/turn',
  },
  {
    id: 'hero-shannon',
    name: 'Claude Shanley',
    title: 'Father of Information',
    cost: { compute: 2, materials: 1 },
    effect: { computePerTurn: 1, symbol: 'CYBER' },
    description: '+1 Compute/turn, gain CYBER',
  },
  {
    id: 'hero-curie',
    name: 'Maria Curev',
    title: 'Pioneer of the Atom',
    cost: { energy: 2, materials: 2 },
    effect: { energyPerTurn: 2, materialsPerTurn: 1 },
    description: '+2 Energy/turn, +1 Materials/turn',
  },
  {
    id: 'hero-dijkstra',
    name: 'Edsger Dahl',
    title: 'Master of Algorithms',
    cost: { compute: 2 },
    effect: { agi: 1, computePerTurn: 1 },
    description: 'AGI +1, +1 Compute/turn',
  },
  {
    id: 'hero-berners-lee',
    name: 'Tim Bernel',
    title: 'Weaver of the Web',
    cost: { compute: 1, materials: 1 },
    effect: { capital: 5 },
    description: '+5 Capital',
  },
  {
    id: 'hero-hopper',
    name: 'Grace Halper',
    title: 'The Admiral',
    cost: { energy: 2 },
    effect: { escalation: 2, energyPerTurn: 1 },
    description: 'Escalation +2, +1 Energy/turn',
  },
]
