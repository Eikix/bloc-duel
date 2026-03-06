import type { Card } from './cards'

export interface PyramidNode {
  position: number
  row: number
  card: Card
  taken: boolean
}

/** Map from position to positions that cover it. */
export const COVERING: Record<number, number[]> = {
  0: [1, 2],
  1: [3, 4],
  2: [4, 5],
  3: [6, 7],
  4: [7, 8],
  5: [8, 9],
  6: [],
  7: [],
  8: [],
  9: [],
}

/**
 * Returns true if the card at the given position is available to be taken.
 * A card is available when ALL cards that cover it have already been taken.
 * Bottom-row cards (6-9) are always available since nothing covers them.
 */
export function isAvailable(position: number, nodes: PyramidNode[]): boolean {
  const coveringPositions = COVERING[position]
  if (!coveringPositions || coveringPositions.length === 0) {
    return true
  }
  return coveringPositions.every((pos) => {
    const node = nodes.find((n) => n.position === pos)
    return node !== undefined && node.taken
  })
}

/** Compute the row for a given pyramid position (0-9). */
function rowForPosition(position: number): number {
  if (position === 0) return 0
  if (position <= 2) return 1
  if (position <= 5) return 2
  return 3
}

/**
 * Build a pyramid from exactly 10 cards, assigning each to positions 0-9.
 * Cards are assigned in order: cards[0] -> position 0, cards[1] -> position 1, etc.
 */
export function buildPyramid(cards: Card[]): PyramidNode[] {
  if (cards.length !== 10) {
    throw new Error(`buildPyramid requires exactly 10 cards, received ${cards.length}`)
  }

  return cards.map((card, index) => ({
    position: index,
    row: rowForPosition(index),
    card,
    taken: false,
  }))
}
