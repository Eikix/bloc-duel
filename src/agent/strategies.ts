import { getCardById } from '../game/cards'
import { getHeroById } from '../game/heroes'
import { getHeroSurcharge, isFreeViaChain } from '../game/rules'
import type { AgentAction, AgentStrategy, StrategyContext } from './types'

function pickRandom<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]
}

function scoreAction(action: AgentAction, context: StrategyContext, mode: string): number {
  const currentPlayer = context.snapshot.players[context.snapshot.currentPlayer]

  switch (action.kind) {
    case 'create_game':
      return 100
    case 'join_game':
      return 90
    case 'next_age':
      return 80
    case 'choose_system_bonus':
      return mode === 'systems-first'
        ? (action.symbol === 'COMPUTE' ? 12 : action.symbol === 'CYBER' ? 11 : 10)
        : action.symbol === 'COMPUTE'
          ? 9
          : action.symbol === 'CYBER'
            ? 8
            : 7
    case 'discard_card':
      return mode === 'random' ? 1 : context.snapshot.age
    case 'play_card': {
      const node = context.snapshot.pyramid.find((entry) => entry.position === action.position)
      if (!node) return Number.NEGATIVE_INFINITY

      const card = getCardById(node.card.id)
      const production = (card.effect.energyPerTurn ?? 0) + (card.effect.materialsPerTurn ?? 0) + (card.effect.computePerTurn ?? 0)
      const symbol = card.symbol ? 1 : 0
      const freeChain = isFreeViaChain(currentPlayer, card) ? 1 : 0

      if (mode === 'greedy-agi') {
        return (card.effect.agi ?? 0) * 10 + production * 2 + symbol + freeChain
      }

      if (mode === 'greedy-escalation') {
        return (card.effect.escalation ?? 0) * 10 + production * 2 + symbol + freeChain
      }

      if (mode === 'systems-first') {
        return symbol * 12 + production * 3 + (card.effect.capital ?? 0) + freeChain
      }

      return (card.effect.agi ?? 0) * 7
        + (card.effect.escalation ?? 0) * 6
        + production * 5
        + (card.effect.capital ?? 0) * 3
        + symbol * 7
        + freeChain * 2
    }
    case 'invoke_hero': {
      const hero = getHeroById(context.snapshot.availableHeroes.find((entry) => entry.slot === action.slot)?.id ?? -1)
      const production = (hero.effect.energyPerTurn ?? 0) + (hero.effect.materialsPerTurn ?? 0) + (hero.effect.computePerTurn ?? 0)
      const symbol = hero.effect.symbol ? 1 : 0
      const surcharge = getHeroSurcharge(currentPlayer)

      if (mode === 'greedy-agi') {
        return (hero.effect.agi ?? 0) * 10 + production * 2 + symbol - surcharge
      }

      if (mode === 'greedy-escalation') {
        return (hero.effect.escalation ?? 0) * 10 + production * 2 + symbol - surcharge
      }

      if (mode === 'systems-first') {
        return symbol * 12 + production * 3 + (hero.effect.capital ?? 0) - surcharge
      }

      return (hero.effect.agi ?? 0) * 7
        + (hero.effect.escalation ?? 0) * 6
        + production * 5
        + (hero.effect.capital ?? 0) * 3
        + symbol * 7
        - surcharge
    }
  }
}

function buildStrategy(name: string): AgentStrategy {
  if (name === 'random') {
    return ({ legalActions, random }) => pickRandom(legalActions, random)
  }

  return (context) => {
    const ranked = [...context.legalActions].sort(
      (left, right) => scoreAction(right, context, name) - scoreAction(left, context, name),
    )
    return ranked[0] ?? pickRandom(context.legalActions, context.random)
  }
}

export const agentStrategies: Record<string, AgentStrategy> = {
  random: buildStrategy('random'),
  'greedy-agi': buildStrategy('greedy-agi'),
  'greedy-escalation': buildStrategy('greedy-escalation'),
  'systems-first': buildStrategy('systems-first'),
  balanced: buildStrategy('balanced'),
}

export const agentStrategyNames = Object.keys(agentStrategies)

export function resolveStrategy(strategy: string | AgentStrategy): AgentStrategy {
  if (typeof strategy !== 'string') return strategy

  const resolved = agentStrategies[strategy]
  if (!resolved) {
    throw new Error(`Unknown strategy "${strategy}"`)
  }

  return resolved
}
