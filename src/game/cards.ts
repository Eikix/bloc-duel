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
// Age I — Foundations (max +1 anything, costs 0-1)
// Free economy = +1 single resource. Paid economy = convert resource type.
// 8 chains: 4 system, 1 AI, 2 economy, 1 military
// ---------------------------------------------------------------------------

export const AGE_1_CARDS: Card[] = [
  // Chain starters (8)
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
    effect: {},
    symbol: 'CYBER',
    chainTo: 'cyber-division',
  },
  {
    id: 'solar-array',
    name: 'Solar Array',
    type: 'ECONOMY',
    age: 1,
    cost: {},
    effect: { energyPerTurn: 1 },
    chainTo: 'fusion-plant',
  },
  {
    id: 'trade-post',
    name: 'Trade Post',
    type: 'SYSTEM',
    age: 1,
    cost: { materials: 1 },
    effect: {},
    symbol: 'FINANCE',
    chainTo: 'trade-network',
  },
  {
    id: 'launch-pad',
    name: 'Launch Pad',
    type: 'SYSTEM',
    age: 1,
    cost: { materials: 1 },
    effect: {},
    symbol: 'COMPUTE',
    chainTo: 'orbital-station',
  },
  {
    id: 'embassy',
    name: 'Embassy',
    type: 'SYSTEM',
    age: 1,
    cost: {},
    effect: {},
    symbol: 'DIPLOMACY',
    chainTo: 'summit-accord',
  },
  {
    id: 'recon-drone',
    name: 'Recon Drone',
    type: 'MILITARY',
    age: 1,
    cost: { energy: 1 },
    effect: { escalation: 1 },
    chainTo: 'drone-swarm',
  },
  {
    id: 'mining-outpost',
    name: 'Mining Outpost',
    type: 'ECONOMY',
    age: 1,
    cost: {},
    effect: { materialsPerTurn: 1 },
    chainTo: 'forge-complex',
  },
  // Standalone (2)
  {
    id: 'data-center',
    name: 'Data Center',
    type: 'ECONOMY',
    age: 1,
    cost: { energy: 1 },
    effect: { computePerTurn: 1 },
  },
  {
    id: 'propaganda-hub',
    name: 'Propaganda Hub',
    type: 'MILITARY',
    age: 1,
    cost: { materials: 1 },
    effect: { escalation: 1 },
  },
]

// ---------------------------------------------------------------------------
// Age II — Competition (max +2, costs 1-3)
// ---------------------------------------------------------------------------

export const AGE_2_CARDS: Card[] = [
  // Chain mid-points (8)
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
    type: 'SYSTEM',
    age: 2,
    cost: { energy: 2, compute: 1 },
    effect: {},
    symbol: 'CYBER',
    chainTo: 'total-surveillance',
    chainFrom: 'signal-intercept',
  },
  {
    id: 'fusion-plant',
    name: 'Fusion Plant',
    type: 'ECONOMY',
    age: 2,
    cost: { materials: 2 },
    effect: { energyPerTurn: 2 },
    chainTo: 'dyson-collector',
    chainFrom: 'solar-array',
  },
  {
    id: 'trade-network',
    name: 'Trade Network',
    type: 'SYSTEM',
    age: 2,
    cost: { materials: 2 },
    effect: {},
    symbol: 'FINANCE',
    chainTo: 'global-exchange',
    chainFrom: 'trade-post',
  },
  {
    id: 'orbital-station',
    name: 'Orbital Station',
    type: 'SYSTEM',
    age: 2,
    cost: { energy: 2, compute: 1 },
    effect: {},
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
    effect: {},
    symbol: 'DIPLOMACY',
    chainTo: 'world-treaty',
    chainFrom: 'embassy',
  },
  {
    id: 'drone-swarm',
    name: 'Drone Swarm',
    type: 'MILITARY',
    age: 2,
    cost: { energy: 2, materials: 1 },
    effect: { escalation: 2 },
    chainTo: 'orbital-strike',
    chainFrom: 'recon-drone',
  },
  {
    id: 'forge-complex',
    name: 'Forge Complex',
    type: 'ECONOMY',
    age: 2,
    cost: { energy: 2 },
    effect: { materialsPerTurn: 2 },
    chainTo: 'mega-foundry',
    chainFrom: 'mining-outpost',
  },
  // Standalone (2)
  {
    id: 'deep-learning',
    name: 'Deep Learning',
    type: 'AI',
    age: 2,
    cost: { compute: 3 },
    effect: { agi: 2 },
  },
  {
    id: 'biocompute-node',
    name: 'Biocompute Node',
    type: 'AI',
    age: 2,
    cost: { compute: 2 },
    effect: { agi: 1, computePerTurn: 1 },
  },
]

// ---------------------------------------------------------------------------
// Age III — Resolution (max +3/+4, costs 2-6)
// ---------------------------------------------------------------------------

export const AGE_3_CARDS: Card[] = [
  // Chain endpoints (8)
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
    type: 'SYSTEM',
    age: 3,
    cost: { compute: 3, energy: 2 },
    effect: {},
    symbol: 'CYBER',
    chainFrom: 'cyber-division',
  },
  {
    id: 'dyson-collector',
    name: 'Dyson Collector',
    type: 'ECONOMY',
    age: 3,
    cost: { materials: 3, energy: 2 },
    effect: { energyPerTurn: 3, capital: 1 },
    chainFrom: 'fusion-plant',
  },
  {
    id: 'global-exchange',
    name: 'Global Exchange',
    type: 'SYSTEM',
    age: 3,
    cost: { materials: 3, compute: 1 },
    effect: {},
    symbol: 'FINANCE',
    chainFrom: 'trade-network',
  },
  {
    id: 'space-command',
    name: 'Space Command',
    type: 'SYSTEM',
    age: 3,
    cost: { energy: 3, compute: 2, materials: 1 },
    effect: {},
    symbol: 'COMPUTE',
    chainFrom: 'orbital-station',
  },
  {
    id: 'world-treaty',
    name: 'World Treaty',
    type: 'SYSTEM',
    age: 3,
    cost: { materials: 2 },
    effect: {},
    symbol: 'DIPLOMACY',
    chainFrom: 'summit-accord',
  },
  {
    id: 'orbital-strike',
    name: 'Orbital Strike',
    type: 'MILITARY',
    age: 3,
    cost: { energy: 4, materials: 2 },
    effect: { escalation: 4 },
    chainFrom: 'drone-swarm',
  },
  {
    id: 'mega-foundry',
    name: 'Mega Foundry',
    type: 'ECONOMY',
    age: 3,
    cost: { energy: 3, compute: 1 },
    effect: { materialsPerTurn: 3, capital: 1 },
    chainFrom: 'forge-complex',
  },
  // Standalone (2)
  {
    id: 'neural-sovereign',
    name: 'Neural Sovereign',
    type: 'AI',
    age: 3,
    cost: { compute: 4 },
    effect: { agi: 3 },
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
