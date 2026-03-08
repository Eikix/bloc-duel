import type { Card, ResourceCost } from './cards'
import type { Hero } from './heroes'
import { isAvailable, type PyramidNode } from './pyramid'

export const AGI_WIN_TARGET = 7
export const HERO_SURCHARGE_STEP = 3

export interface ProductionState {
  energy: number
  materials: number
  compute: number
}

export interface EconomicState {
  capital: number
  production: ProductionState
}

export interface PlayedCardsState {
  playedCards: number[]
}

export interface HeroState {
  heroCount: number
}

export function canAfford(
  player: EconomicState,
  cost: ResourceCost,
  extraCapital: number = 0,
): boolean {
  const energyNeeded = Math.max(0, (cost.energy ?? 0) - player.production.energy)
  const materialsNeeded = Math.max(0, (cost.materials ?? 0) - player.production.materials)
  const computeNeeded = Math.max(0, (cost.compute ?? 0) - player.production.compute)
  return player.capital >= energyNeeded + materialsNeeded + computeNeeded + extraCapital
}

export function estimateCapitalSpend(
  player: EconomicState,
  cost: ResourceCost,
  extraCapital: number = 0,
): number {
  const energyNeeded = Math.max(0, (cost.energy ?? 0) - player.production.energy)
  const materialsNeeded = Math.max(0, (cost.materials ?? 0) - player.production.materials)
  const computeNeeded = Math.max(0, (cost.compute ?? 0) - player.production.compute)
  return energyNeeded + materialsNeeded + computeNeeded + extraCapital
}

export function getEffectiveCost(card: Card): ResourceCost {
  return card.cost
}

export function getSellValue(age: 1 | 2 | 3): number {
  return age
}

export function isFreeViaChain(player: PlayedCardsState, card: Pick<Card, 'chainFrom'>): boolean {
  return card.chainFrom !== undefined && player.playedCards.includes(card.chainFrom)
}

export function getDraftNode(
  pyramid: PyramidNode[],
  position: number,
): { index: number; node: PyramidNode } | null {
  const index = pyramid.findIndex((node) => node.position === position)
  if (index === -1) return null

  const node = pyramid[index]
  if (node.taken || !isAvailable(position, pyramid)) return null

  return { index, node }
}

export function getAvailableDraftNodes(pyramid: PyramidNode[]): PyramidNode[] {
  return pyramid.filter((node) => !node.taken && isAvailable(node.position, pyramid))
}

export function getHeroSurcharge(player: HeroState): number {
  return player.heroCount * HERO_SURCHARGE_STEP
}

export function canAffordHero(
  player: EconomicState & HeroState,
  hero: Pick<Hero, 'cost'>,
): boolean {
  return canAfford(player, hero.cost, getHeroSurcharge(player))
}
