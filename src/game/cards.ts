import type { SystemSymbol } from './systems'

export type CardType = 'AI' | 'ECONOMY' | 'MILITARY' | 'SYSTEM'

export interface ResourceCost {
  energy?: number
  materials?: number
  compute?: number
}

export interface CardEffect {
  agi?: number
  escalation?: number
  capital?: number
  energyPerTurn?: number
  materialsPerTurn?: number
  computePerTurn?: number
  capitalPerTurn?: number
  symbol?: SystemSymbol
}

export interface Card {
  id: number
  name: string
  type: CardType
  age: 1 | 2 | 3
  cost: ResourceCost
  effect: CardEffect
  symbol?: SystemSymbol
  chainTo?: number
  chainFrom?: number
}

export const AGE_1_CARDS: Card[] = [
  {
    id: 0,
    name: 'Neural Relay',
    type: 'AI',
    age: 1,
    cost: { compute: 1 },
    effect: { agi: 1 },
    chainTo: 10,
  },
  {
    id: 1,
    name: 'Solar Array',
    type: 'ECONOMY',
    age: 1,
    cost: {},
    effect: { energyPerTurn: 1 },
    chainTo: 11,
  },
  {
    id: 2,
    name: 'Mining Outpost',
    type: 'ECONOMY',
    age: 1,
    cost: {},
    effect: { materialsPerTurn: 1 },
    chainTo: 12,
  },
  {
    id: 3,
    name: 'Recon Drone',
    type: 'MILITARY',
    age: 1,
    cost: { energy: 1 },
    effect: { escalation: 1 },
    chainTo: 13,
  },
  {
    id: 4,
    name: 'Signal Intercept',
    type: 'SYSTEM',
    age: 1,
    cost: { energy: 1 },
    effect: {},
    symbol: 'CYBER',
    chainTo: 14,
  },
  {
    id: 5,
    name: 'Embassy',
    type: 'SYSTEM',
    age: 1,
    cost: {},
    effect: { capital: 1 },
    symbol: 'DIPLOMACY',
    chainTo: 15,
  },
  {
    id: 6,
    name: 'Data Center',
    type: 'ECONOMY',
    age: 1,
    cost: { energy: 1 },
    effect: { computePerTurn: 1 },
  },
  {
    id: 7,
    name: 'Propaganda Hub',
    type: 'MILITARY',
    age: 1,
    cost: { materials: 1 },
    effect: { escalation: 1 },
  },
  {
    id: 8,
    name: 'Supply Depot',
    type: 'ECONOMY',
    age: 1,
    cost: {},
    effect: { capital: 2 },
  },
  {
    id: 9,
    name: 'Research Cluster',
    type: 'ECONOMY',
    age: 1,
    cost: { compute: 1 },
    effect: { computePerTurn: 1 },
  },
]

export const AGE_2_CARDS: Card[] = [
  {
    id: 10,
    name: 'Quantum Lab',
    type: 'AI',
    age: 2,
    cost: { energy: 1, compute: 2 },
    effect: { agi: 2 },
    chainTo: 20,
    chainFrom: 0,
  },
  {
    id: 11,
    name: 'Fusion Plant',
    type: 'ECONOMY',
    age: 2,
    cost: { materials: 2 },
    effect: { energyPerTurn: 2 },
    chainTo: 21,
    chainFrom: 1,
  },
  {
    id: 12,
    name: 'Forge Complex',
    type: 'ECONOMY',
    age: 2,
    cost: { energy: 2 },
    effect: { materialsPerTurn: 2 },
    chainTo: 22,
    chainFrom: 2,
  },
  {
    id: 13,
    name: 'Drone Swarm',
    type: 'MILITARY',
    age: 2,
    cost: { energy: 2, materials: 1 },
    effect: { escalation: 1 },
    chainTo: 23,
    chainFrom: 3,
  },
  {
    id: 14,
    name: 'Cyber Division',
    type: 'SYSTEM',
    age: 2,
    cost: { energy: 2, compute: 1 },
    effect: { escalation: 1 },
    symbol: 'CYBER',
    chainTo: 24,
    chainFrom: 4,
  },
  {
    id: 15,
    name: 'Summit Accord',
    type: 'SYSTEM',
    age: 2,
    cost: { materials: 1 },
    effect: { capital: 2 },
    symbol: 'DIPLOMACY',
    chainTo: 25,
    chainFrom: 5,
  },
  {
    id: 16,
    name: 'Deep Learning',
    type: 'AI',
    age: 2,
    cost: { compute: 3 },
    effect: { agi: 2 },
  },
  {
    id: 17,
    name: 'Biocompute Node',
    type: 'AI',
    age: 2,
    cost: { compute: 2 },
    effect: { agi: 1, computePerTurn: 1 },
  },
  {
    id: 18,
    name: 'Arms Dealer',
    type: 'ECONOMY',
    age: 2,
    cost: { materials: 2 },
    effect: { capital: 2, escalation: 1 },
  },
  {
    id: 19,
    name: 'Orbital Station',
    type: 'SYSTEM',
    age: 2,
    cost: { energy: 1, compute: 1 },
    effect: { computePerTurn: 1 },
    symbol: 'COMPUTE',
  },
]

export const AGE_3_CARDS: Card[] = [
  {
    id: 20,
    name: 'AGI Singularity',
    type: 'AI',
    age: 3,
    cost: { energy: 2, compute: 4 },
    effect: { agi: 3 },
    chainFrom: 10,
  },
  {
    id: 21,
    name: 'Dyson Collector',
    type: 'ECONOMY',
    age: 3,
    cost: { energy: 2, materials: 3 },
    effect: { capital: 1, energyPerTurn: 3 },
    chainFrom: 11,
  },
  {
    id: 22,
    name: 'Synthetic Foundry',
    type: 'ECONOMY',
    age: 3,
    cost: { energy: 3, compute: 1 },
    effect: { capital: 1, materialsPerTurn: 3 },
    chainFrom: 12,
  },
  {
    id: 23,
    name: 'Orbital Strike',
    type: 'MILITARY',
    age: 3,
    cost: { energy: 4, materials: 2 },
    effect: { escalation: 3 },
    chainFrom: 13,
  },
  {
    id: 24,
    name: 'Total Surveillance',
    type: 'SYSTEM',
    age: 3,
    cost: { energy: 2, compute: 3 },
    effect: { agi: 1 },
    symbol: 'CYBER',
    chainFrom: 14,
  },
  {
    id: 25,
    name: 'World Treaty',
    type: 'SYSTEM',
    age: 3,
    cost: { materials: 2 },
    effect: { capital: 3 },
    symbol: 'DIPLOMACY',
    chainFrom: 15,
  },
  {
    id: 26,
    name: 'Neural Sovereign',
    type: 'AI',
    age: 3,
    cost: { compute: 4 },
    effect: { agi: 3 },
  },
  {
    id: 27,
    name: 'Nuclear Deterrent',
    type: 'MILITARY',
    age: 3,
    cost: { energy: 3, materials: 3 },
    effect: { escalation: 2, capital: 2 },
  },
  {
    id: 28,
    name: 'Global Exchange',
    type: 'SYSTEM',
    age: 3,
    cost: { materials: 3, compute: 1 },
    effect: { capital: 3 },
    symbol: 'FINANCE',
  },
  {
    id: 29,
    name: 'Space Command',
    type: 'SYSTEM',
    age: 3,
    cost: { energy: 3, materials: 1, compute: 2 },
    effect: { energyPerTurn: 2 },
    symbol: 'COMPUTE',
  },
]

export const ALL_CARDS: Card[] = [...AGE_1_CARDS, ...AGE_2_CARDS, ...AGE_3_CARDS]

export const CARD_BY_ID = new Map(ALL_CARDS.map((card) => [card.id, card]))

export function getCardById(id: number): Card {
  return CARD_BY_ID.get(id) ?? {
    id,
    name: `Unknown Card #${id}`,
    type: 'SYSTEM',
    age: 1,
    cost: {},
    effect: {},
  }
}

export function getCardIdsFromMask(mask: number): number[] {
  return ALL_CARDS
    .filter((card) => ((mask >> card.id) & 1) === 1)
    .map((card) => card.id)
}
