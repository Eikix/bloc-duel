import { getHeroSurcharge, isFreeViaChain } from '../game/rules'
import type { Card } from '../game/cards'
import type { Hero } from '../game/heroes'
import type { AgentAction, AgentStrategy, MatchSnapshot, StrategyContext } from './types'

type StrategicLine = 'AGI' | 'ESCALATION' | 'SYSTEMS'
type ScorableDraft = Pick<Card, 'cost' | 'effect' | 'symbol' | 'chainFrom'>
type StrategyMode =
  | 'balanced'
  | 'race-agi'
  | 'race-escalation'
  | 'race-systems'
  | 'deny-agi'
  | 'deny-escalation'
  | 'deny-systems'
  | 'adaptive-race'

interface StrategyPlan {
  line: StrategicLine
  deny: StrategicLine
  selfWeight: number
  denyWeight: number
  discardBias: number
}

interface ActionFeatures {
  selfValue: number
  denyValue: number
  capitalCost: number
  freeChain: boolean
  actionBias: number
}

function pickRandom<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]
}

function getDistinctSystems(snapshot: MatchSnapshot, playerIndex: 0 | 1) {
  return new Set(snapshot.players[playerIndex].systems).size
}

function getPointsProgress(snapshot: MatchSnapshot, playerIndex: 0 | 1) {
  const player = snapshot.players[playerIndex]
  return (snapshot.agiTrack[playerIndex] + getDistinctSystems(snapshot, playerIndex) + player.heroCount) / 10
}

function estimateLineEta(snapshot: MatchSnapshot, playerIndex: 0 | 1, line: StrategicLine) {
  const player = snapshot.players[playerIndex]
  const production = player.production

  switch (line) {
    case 'AGI':
      return Math.max(0, 6 - snapshot.agiTrack[playerIndex]) * 3
        - production.compute * 1.6
        - production.energy * 0.4
    case 'ESCALATION':
      return Math.max(0, 6 - (playerIndex === 0 ? snapshot.escalationTrack : -snapshot.escalationTrack)) * 3
        - production.energy * 1.2
        - production.materials * 0.7
    case 'SYSTEMS':
      return Math.max(0, 4 - getDistinctSystems(snapshot, playerIndex)) * 3
        - production.materials * 1.2
        - production.compute * 0.7
        - production.energy * 0.3
  }
}

function getFastestLine(snapshot: MatchSnapshot, playerIndex: 0 | 1): StrategicLine {
  const ranked = (['AGI', 'ESCALATION', 'SYSTEMS'] as StrategicLine[])
    .map((line) => ({ line, eta: estimateLineEta(snapshot, playerIndex, line) }))
    .sort((left, right) => left.eta - right.eta)

  return ranked[0]?.line ?? 'AGI'
}

function scoreBonus(symbol: string, line: StrategicLine) {
  if (line === 'AGI') return symbol === 'COMPUTE' ? 14 : symbol === 'CYBER' ? 9 : 7
  if (line === 'ESCALATION') return symbol === 'CYBER' ? 14 : symbol === 'FINANCE' ? 9 : 7
  return symbol === 'DIPLOMACY' ? 14 : symbol === 'FINANCE' ? 10 : 8
}

function estimateCapitalCost(
  draft: Pick<ScorableDraft, 'cost'>,
  production: MatchSnapshot['players'][number]['production'],
  extraCapital: number = 0,
) {
  return Math.max(0, (draft.cost.energy ?? 0) - production.energy)
    + Math.max(0, (draft.cost.materials ?? 0) - production.materials)
    + Math.max(0, (draft.cost.compute ?? 0) - production.compute)
    + extraCapital
}

function scoreDraftForLine(
  draft: ScorableDraft,
  snapshot: MatchSnapshot,
  playerIndex: 0 | 1,
  line: StrategicLine,
) {
  const player = snapshot.players[playerIndex]
  const distinctSystems = new Set(player.systems)
  const newSystem = draft.symbol && !distinctSystems.has(draft.symbol) ? 1 : 0
  const duplicateSystem = draft.symbol ? 1 : 0
  const production = (draft.effect.energyPerTurn ?? 0) + (draft.effect.materialsPerTurn ?? 0) + (draft.effect.computePerTurn ?? 0)
  const costPenalty = estimateCapitalCost(draft, player.production)
  const chainValue = isFreeViaChain(player, draft) ? 4 : 0

  switch (line) {
    case 'AGI':
      return (draft.effect.agi ?? 0) * 13
        + (draft.effect.computePerTurn ?? 0) * 7
        + (draft.effect.energyPerTurn ?? 0) * 2
        + (draft.effect.capital ?? 0) * 2
        + newSystem * 2
        + chainValue
        + production
        - costPenalty * 0.8
    case 'ESCALATION':
      return (draft.effect.escalation ?? 0) * 13
        + (draft.effect.energyPerTurn ?? 0) * 6
        + (draft.effect.materialsPerTurn ?? 0) * 3
        + (draft.effect.capital ?? 0) * 3
        + newSystem * 2
        + chainValue
        + production
        - costPenalty * 0.8
    case 'SYSTEMS':
      return newSystem * 16
        + duplicateSystem * 5
        + (draft.effect.materialsPerTurn ?? 0) * 5
        + (draft.effect.computePerTurn ?? 0) * 3
        + (draft.effect.energyPerTurn ?? 0) * 2
        + (draft.effect.capital ?? 0) * 4
        + chainValue
        - costPenalty * 0.7
  }
}

function scoreHeroForLine(
  hero: Hero,
  snapshot: MatchSnapshot,
  playerIndex: 0 | 1,
  line: StrategicLine,
) {
  const player = snapshot.players[playerIndex]
  const surcharge = getHeroSurcharge(player)
  const distinctSystems = new Set(player.systems)
  const newSystem = hero.effect.symbol && !distinctSystems.has(hero.effect.symbol) ? 1 : 0
  const duplicateSystem = hero.effect.symbol ? 1 : 0
  const costPenalty = estimateCapitalCost(hero, player.production, surcharge)

  switch (line) {
    case 'AGI':
      return (hero.effect.agi ?? 0) * 14
        + (hero.effect.computePerTurn ?? 0) * 8
        + (hero.effect.energyPerTurn ?? 0) * 2
        + (hero.effect.capital ?? 0) * 2
        + newSystem * 2
        - costPenalty
    case 'ESCALATION':
      return (hero.effect.escalation ?? 0) * 14
        + (hero.effect.energyPerTurn ?? 0) * 6
        + (hero.effect.materialsPerTurn ?? 0) * 3
        + (hero.effect.capital ?? 0) * 3
        + newSystem * 2
        - costPenalty
    case 'SYSTEMS':
      return newSystem * 16
        + duplicateSystem * 5
        + (hero.effect.materialsPerTurn ?? 0) * 5
        + (hero.effect.computePerTurn ?? 0) * 4
        + (hero.effect.energyPerTurn ?? 0) * 3
        + (hero.effect.capital ?? 0) * 4
        - costPenalty
  }
}

function getStrategyPlan(snapshot: MatchSnapshot, playerIndex: 0 | 1, mode: StrategyMode): StrategyPlan {
  const opponentIndex = playerIndex === 0 ? 1 : 0
  const myFastest = getFastestLine(snapshot, playerIndex)
  const opponentFastest = getFastestLine(snapshot, opponentIndex)

  switch (mode) {
    case 'race-agi':
      return { line: 'AGI', deny: opponentFastest, selfWeight: 1.2, denyWeight: 0.35, discardBias: 0.8 }
    case 'race-escalation':
      return { line: 'ESCALATION', deny: opponentFastest, selfWeight: 1.2, denyWeight: 0.35, discardBias: 0.8 }
    case 'race-systems':
      return { line: 'SYSTEMS', deny: opponentFastest, selfWeight: 1.2, denyWeight: 0.35, discardBias: 0.8 }
    case 'deny-agi':
      return { line: myFastest, deny: 'AGI', selfWeight: 0.8, denyWeight: 1.1, discardBias: 1.35 }
    case 'deny-escalation':
      return { line: myFastest, deny: 'ESCALATION', selfWeight: 0.8, denyWeight: 1.1, discardBias: 1.35 }
    case 'deny-systems':
      return { line: myFastest, deny: 'SYSTEMS', selfWeight: 0.8, denyWeight: 1.1, discardBias: 1.35 }
    case 'adaptive-race': {
      const myEta = estimateLineEta(snapshot, playerIndex, myFastest)
      const opponentEta = estimateLineEta(snapshot, opponentIndex, opponentFastest)
      return myEta <= opponentEta + 0.5
        ? { line: myFastest, deny: opponentFastest, selfWeight: 1.15, denyWeight: 0.45, discardBias: 0.9 }
        : { line: opponentFastest, deny: opponentFastest, selfWeight: 0.55, denyWeight: 1.2, discardBias: 1.4 }
    }
    case 'balanced':
      return { line: myFastest, deny: opponentFastest, selfWeight: 1, denyWeight: 0.5, discardBias: 1 }
  }
}

function scoreActionFeatures(action: AgentAction, context: StrategyContext, mode: StrategyMode): ActionFeatures {
  const actorIndex = context.snapshot.currentPlayer
  const opponentIndex = actorIndex === 0 ? 1 : 0
  const actor = context.snapshot.players[actorIndex]
  const plan = getStrategyPlan(context.snapshot, actorIndex, mode)

  switch (action.kind) {
    case 'create_game':
      return { selfValue: 100, denyValue: 0, capitalCost: 0, freeChain: false, actionBias: 0 }
    case 'join_game':
      return { selfValue: 90, denyValue: 0, capitalCost: 0, freeChain: false, actionBias: 0 }
    case 'next_age':
      return { selfValue: 30, denyValue: 0, capitalCost: 0, freeChain: false, actionBias: 0 }
    case 'choose_system_bonus':
      return {
        selfValue: scoreBonus(action.symbol, plan.line),
        denyValue: 0,
        capitalCost: 0,
        freeChain: false,
        actionBias: 0,
      }
    case 'discard_card': {
      const node = context.snapshot.pyramid.find((entry) => entry.position === action.position)
      if (!node) return { selfValue: Number.NEGATIVE_INFINITY, denyValue: 0, capitalCost: 0, freeChain: false, actionBias: 0 }
      return {
        selfValue: 0,
        denyValue: scoreDraftForLine(node.card, context.snapshot, opponentIndex, plan.deny),
        capitalCost: 0,
        freeChain: false,
        actionBias: plan.discardBias * 4,
      }
    }
    case 'play_card': {
      const node = context.snapshot.pyramid.find((entry) => entry.position === action.position)
      if (!node) return { selfValue: Number.NEGATIVE_INFINITY, denyValue: 0, capitalCost: 0, freeChain: false, actionBias: 0 }
      return {
        selfValue: scoreDraftForLine(node.card, context.snapshot, actorIndex, plan.line),
        denyValue: scoreDraftForLine(node.card, context.snapshot, opponentIndex, plan.deny),
        capitalCost: estimateCapitalCost(node.card, actor.production),
        freeChain: isFreeViaChain(actor, node.card),
        actionBias: 6,
      }
    }
    case 'invoke_hero': {
      const hero = context.snapshot.availableHeroes.find((entry) => entry.slot === action.slot)
      if (!hero) return { selfValue: Number.NEGATIVE_INFINITY, denyValue: 0, capitalCost: 0, freeChain: false, actionBias: 0 }
      return {
        selfValue: scoreHeroForLine(hero, context.snapshot, actorIndex, plan.line),
        denyValue: 0,
        capitalCost: estimateCapitalCost(hero, actor.production, getHeroSurcharge(actor)),
        freeChain: false,
        actionBias: 4,
      }
    }
  }
}

function scoreAction(action: AgentAction, context: StrategyContext, mode: StrategyMode): number {
  const plan = getStrategyPlan(context.snapshot, context.snapshot.currentPlayer, mode)
  const features = scoreActionFeatures(action, context, mode)
  const distinctSystems = getDistinctSystems(context.snapshot, context.snapshot.currentPlayer)
  const pointsProgress = getPointsProgress(context.snapshot, context.snapshot.currentPlayer)

  return features.selfValue * plan.selfWeight
    + features.denyValue * plan.denyWeight
    + features.actionBias
    + (features.freeChain ? 3 : 0)
    + distinctSystems
    + pointsProgress * (mode === 'balanced' ? 4 : 2)
    - features.capitalCost * 0.35
}

function buildStrategy(mode: StrategyMode): AgentStrategy {
  return (context) => {
    const ranked = [...context.legalActions].sort(
      (left, right) => scoreAction(right, context, mode) - scoreAction(left, context, mode),
    )
    return ranked[0] ?? pickRandom(context.legalActions, context.random)
  }
}

export const agentStrategies: Record<string, AgentStrategy> = {
  random: ({ legalActions, random }) => pickRandom(legalActions, random),
  balanced: buildStrategy('balanced'),
  'greedy-agi': buildStrategy('race-agi'),
  'greedy-escalation': buildStrategy('race-escalation'),
  'systems-first': buildStrategy('race-systems'),
  'race-agi': buildStrategy('race-agi'),
  'race-escalation': buildStrategy('race-escalation'),
  'race-systems': buildStrategy('race-systems'),
  'deny-agi': buildStrategy('deny-agi'),
  'deny-escalation': buildStrategy('deny-escalation'),
  'deny-systems': buildStrategy('deny-systems'),
  'adaptive-race': buildStrategy('adaptive-race'),
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
