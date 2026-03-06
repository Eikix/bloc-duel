import type { ResourceCost } from './cards'

export const RESOURCE_ICONS = {
  energy: '\u26A1',
  materials: '\u26CF\uFE0F',
  compute: '\uD83D\uDDA5\uFE0F',
  capital: '\uD83D\uDCB0',
} as const

/** Format a ResourceCost for display. E.g. "⚡2 🖥️1" or "free" */
export function formatCost(cost: ResourceCost): string {
  const parts: string[] = []
  if (cost.energy) parts.push(`${RESOURCE_ICONS.energy}${cost.energy}`)
  if (cost.materials) parts.push(`${RESOURCE_ICONS.materials}${cost.materials}`)
  if (cost.compute) parts.push(`${RESOURCE_ICONS.compute}${cost.compute}`)
  return parts.length > 0 ? parts.join(' ') : 'free'
}

/** Total resource units in a cost */
export function totalCost(cost: ResourceCost): number {
  return (cost.energy ?? 0) + (cost.materials ?? 0) + (cost.compute ?? 0)
}
