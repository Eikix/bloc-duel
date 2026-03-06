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
  id: string
  name: string
  type: CardType
  age: 1 | 2 | 3
  cost: ResourceCost
  effect: CardEffect
  symbol?: SystemSymbol
  chainTo?: string
  chainFrom?: string
}

// ---------------------------------------------------------------------------
// Age I — Foundations (costs 0-2, production focus, chain starters)
// ---------------------------------------------------------------------------

export const AGE_1_CARDS: Card[] = [
  // Chain starters
  {
    id: 'neural-relay',
    name: 'Neural Relay',
    type: 'AI',
    age: 1,
    cost: { compute: 1 },
    effect: { agi: 1 },
    chainTo: 'quantum-lab',
  },
  {
    id: 'signal-intercept',
    name: 'Signal Intercept',
    type: 'SYSTEM',
    age: 1,
    cost: { energy: 1 },
    effect: { escalation: 1 },
    symbol: 'CYBER',
    chainTo: 'cyber-division',
  },
  {
    id: 'solar-array',
    name: 'Solar Array',
    type: 'ECONOMY',
    age: 1,
    cost: {},
    effect: { energyPerTurn: 2 },
    chainTo: 'fusion-plant',
  },
  {
    id: 'trade-relay',
    name: 'Trade Relay',
    type: 'ECONOMY',
    age: 1,
    cost: { materials: 1 },
    effect: { capitalPerTurn: 1 },
    symbol: 'FINANCE',
    chainTo: 'supply-network',
  },
  {
    id: 'launch-pad',
    name: 'Launch Pad',
    type: 'SYSTEM',
    age: 1,
    cost: { energy: 1, materials: 1 },
    effect: { computePerTurn: 1 },
    symbol: 'COMPUTE',
    chainTo: 'orbital-station',
  },
  {
    id: 'embassy',
    name: 'Embassy',
    type: 'SYSTEM',
    age: 1,
    cost: {},
    effect: { escalation: -1 },
    symbol: 'DIPLOMACY',
    chainTo: 'summit-accord',
  },
  // Standalone
  {
    id: 'mining-outpost',
    name: 'Mining Outpost',
    type: 'ECONOMY',
    age: 1,
    cost: {},
    effect: { materialsPerTurn: 2 },
  },
  {
    id: 'data-center',
    name: 'Data Center',
    type: 'ECONOMY',
    age: 1,
    cost: { compute: 1 },
    effect: { computePerTurn: 1 },
    symbol: 'COMPUTE',
  },
  {
    id: 'recon-drone',
    name: 'Recon Drone',
    type: 'MILITARY',
    age: 1,
    cost: { energy: 1 },
    effect: { escalation: 1 },
  },
  {
    id: 'propaganda-hub',
    name: 'Propaganda Hub',
    type: 'MILITARY',
    age: 1,
    cost: { materials: 1 },
    effect: { escalation: 1 },
    symbol: 'INDUSTRY',
  },
]

// ---------------------------------------------------------------------------
// Age II — Competition (costs 2-4, chain mid-points, military pressure)
// ---------------------------------------------------------------------------

export const AGE_2_CARDS: Card[] = [
  // Chain mid-points
  {
    id: 'quantum-lab',
    name: 'Quantum Lab',
    type: 'AI',
    age: 2,
    cost: { compute: 2, energy: 1 },
    effect: { agi: 2 },
    chainTo: 'agi-singularity',
    chainFrom: 'neural-relay',
  },
  {
    id: 'cyber-division',
    name: 'Cyber Division',
    type: 'MILITARY',
    age: 2,
    cost: { energy: 2, compute: 1 },
    effect: { escalation: 2 },
    symbol: 'CYBER',
    chainTo: 'total-surveillance',
    chainFrom: 'signal-intercept',
  },
  {
    id: 'fusion-plant',
    name: 'Fusion Plant',
    type: 'ECONOMY',
    age: 2,
    cost: { energy: 1, materials: 2 },
    effect: { energyPerTurn: 3 },
    chainTo: 'dyson-collector',
    chainFrom: 'solar-array',
  },
  {
    id: 'supply-network',
    name: 'Supply Network',
    type: 'ECONOMY',
    age: 2,
    cost: { materials: 2 },
    effect: { capitalPerTurn: 2 },
    symbol: 'FINANCE',
    chainTo: 'global-exchange',
    chainFrom: 'trade-relay',
  },
  {
    id: 'orbital-station',
    name: 'Orbital Station',
    type: 'SYSTEM',
    age: 2,
    cost: { energy: 2, compute: 1 },
    effect: { agi: 1, computePerTurn: 1 },
    symbol: 'COMPUTE',
    chainTo: 'space-command',
    chainFrom: 'launch-pad',
  },
  {
    id: 'summit-accord',
    name: 'Summit Accord',
    type: 'SYSTEM',
    age: 2,
    cost: { materials: 1 },
    effect: { escalation: -2 },
    symbol: 'DIPLOMACY',
    chainTo: 'world-treaty',
    chainFrom: 'embassy',
  },
  // Standalone
  {
    id: 'deep-learning',
    name: 'Deep Learning',
    type: 'AI',
    age: 2,
    cost: { compute: 3 },
    effect: { agi: 2 },
  },
  {
    id: 'drone-swarm',
    name: 'Drone Swarm',
    type: 'MILITARY',
    age: 2,
    cost: { energy: 2, materials: 1 },
    effect: { escalation: 2 },
  },
  {
    id: 'biocompute-node',
    name: 'Biocompute Node',
    type: 'AI',
    age: 2,
    cost: { compute: 2 },
    effect: { agi: 1, computePerTurn: 1 },
  },
  {
    id: 'arms-dealer',
    name: 'Arms Dealer',
    type: 'ECONOMY',
    age: 2,
    cost: { materials: 2 },
    effect: { capital: 3, escalation: 1 },
  },
]

// ---------------------------------------------------------------------------
// Age III — Resolution (costs 3-6, chain endpoints, decisive plays)
// ---------------------------------------------------------------------------

export const AGE_3_CARDS: Card[] = [
  // Chain endpoints
  {
    id: 'agi-singularity',
    name: 'AGI Singularity',
    type: 'AI',
    age: 3,
    cost: { compute: 4, energy: 2 },
    effect: { agi: 3 },
    chainFrom: 'quantum-lab',
  },
  {
    id: 'total-surveillance',
    name: 'Total Surveillance',
    type: 'MILITARY',
    age: 3,
    cost: { compute: 3, energy: 2 },
    effect: { escalation: 3 },
    symbol: 'CYBER',
    chainFrom: 'cyber-division',
  },
  {
    id: 'dyson-collector',
    name: 'Dyson Collector',
    type: 'ECONOMY',
    age: 3,
    cost: { energy: 3, materials: 3 },
    effect: { energyPerTurn: 4, capital: 2 },
    chainFrom: 'fusion-plant',
  },
  {
    id: 'global-exchange',
    name: 'Global Exchange',
    type: 'ECONOMY',
    age: 3,
    cost: { materials: 3, compute: 1 },
    effect: { capitalPerTurn: 4 },
    chainFrom: 'supply-network',
  },
  {
    id: 'space-command',
    name: 'Space Command',
    type: 'SYSTEM',
    age: 3,
    cost: { energy: 3, compute: 2, materials: 1 },
    effect: { agi: 2, escalation: 2 },
    symbol: 'COMPUTE',
    chainFrom: 'orbital-station',
  },
  {
    id: 'world-treaty',
    name: 'World Treaty',
    type: 'SYSTEM',
    age: 3,
    cost: { materials: 2 },
    effect: { escalation: -3 },
    symbol: 'DIPLOMACY',
    chainFrom: 'summit-accord',
  },
  // Standalone
  {
    id: 'neural-sovereign',
    name: 'Neural Sovereign',
    type: 'AI',
    age: 3,
    cost: { compute: 4 },
    effect: { agi: 3 },
  },
  {
    id: 'orbital-strike',
    name: 'Orbital Strike',
    type: 'MILITARY',
    age: 3,
    cost: { energy: 4, materials: 2 },
    effect: { escalation: 4 },
  },
  {
    id: 'quantum-supremacy',
    name: 'Quantum Supremacy',
    type: 'AI',
    age: 3,
    cost: { compute: 5 },
    effect: { agi: 2, computePerTurn: 2 },
  },
  {
    id: 'nuclear-deterrent',
    name: 'Nuclear Deterrent',
    type: 'MILITARY',
    age: 3,
    cost: { energy: 3, materials: 3 },
    effect: { escalation: 3, capital: 2 },
  },
]

export const ALL_CARDS: Card[] = [...AGE_1_CARDS, ...AGE_2_CARDS, ...AGE_3_CARDS]
