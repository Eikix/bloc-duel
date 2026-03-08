#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { logger, LogLevelIndex } from 'starknet'
import { createAgentClient, resolveStrategy, type AgentAction, type AgentClientOptions, type MatchSnapshot } from './index'
import { formatAgentAction } from './runtime'
import { getHeroById } from '../game/heroes'
import { AGI_WIN_TARGET, isFreeViaChain } from '../game/rules'

type KnownWinCondition = 'AgiBreakthrough' | 'EscalationDominance' | 'SystemsDominance' | 'Points'
type RunStatus = 'completed' | 'stalled' | 'failed'

interface BalanceCliOptions {
  json: boolean
  output?: string
  input?: string
  games?: number
  seed?: string
  strategies?: string[]
  maxActions?: number
  maxIdlePolls?: number
  pollIntervalMs?: number
  matchTimeoutMs?: number
  rpcUrl?: string
  toriiUrl?: string
  worldAddress?: string
  burnerA?: number
  burnerB?: number
}

interface BalancePlayerStats {
  finalAgi: number
  finalCapital: number
  finalDistinctSystems: number
  finalHeroCount: number
  cardsPlayed: number
  cardsDiscarded: number
  heroInvokes: number
  earlyHeroInvokes: number
  chainPlays: number
}

interface MatchTraceStep {
  turn: number
  actorIndex: 0 | 1
  strategy: string
  actionKind: AgentAction['kind']
  actionLabel: string
  ageBefore: number
  ageAfter: number | null
  agiBefore: [number, number]
  agiAfter: [number, number] | null
  escalationBefore: number
  escalationAfter: number | null
  systemsBefore: [number, number]
  systemsAfter: [number, number] | null
  heroCountsBefore: [number, number]
  heroCountsAfter: [number, number] | null
  chainPlay: boolean
}

interface MatchRecord {
  matchId: number | null
  status: RunStatus
  error: string | null
  strategyA: string
  strategyB: string
  turns: number
  ageEnded: number | null
  phase: string | null
  winner: MatchSnapshot['winner']
  winnerStrategy: string | null
  winCondition: MatchSnapshot['winCondition'] | null
  firstPlayerWon: boolean | null
  abruptEnding: boolean
  loserProgress: number | null
  players: [BalancePlayerStats, BalancePlayerStats]
  trace: MatchTraceStep[]
}

interface ScorecardEntry {
  status: 'pass' | 'warn' | 'fail' | 'manual'
  value: string
  detail: string
}

interface RepresentativeSample {
  label: string
  matchId: number | null
  strategies: string
  winCondition: MatchRecord['winCondition']
  turns: number
  note: string
}

interface BalanceAnalysis {
  totals: {
    games: number
    completed: number
    stalled: number
    failed: number
  }
  winConditions: Record<string, { count: number; share: number }>
  ages: Record<string, { count: number; share: number }>
  averageTurns: number
  averageTurnsByWinCondition: Record<string, number>
  firstPlayerWinRate: number
  discardUsageRate: number
  chainUsageRate: number
  heroUsageRate: number
  heroWinContribution: number
  abruptEndingRate: number
  stallRate: number
  matchupMatrix: Record<string, {
    games: number
    strategyAWins: number
    strategyBWins: number
    ties: number
  }>
  alerts: string[]
  scorecard: Record<string, ScorecardEntry>
  samples: RepresentativeSample[]
  rubric: string[]
}

interface BalanceBatch {
  generatedAt: string
  config: {
    games: number
    seed: string
    strategies: string[]
    maxActions: number
    maxIdlePolls: number
    pollIntervalMs: number
    output: string
    rpcUrl: string
    toriiUrl: string
    worldAddress: string
    burnerA: number
    burnerB: number
    matchTimeoutMs: number
  }
  runs: MatchRecord[]
  analysis: BalanceAnalysis
}

const DEFAULT_OUTPUT = '.data/balance/latest.json'
const DEFAULT_STRATEGIES = [
  'race-agi',
  'race-escalation',
  'race-systems',
  'deny-agi',
  'deny-escalation',
  'deny-systems',
  'adaptive-race',
]

function configureStarknetLogging() {
  const level = (process.env.BLOCDUEL_AGENT_LOG_LEVEL ?? 'OFF').toUpperCase()
  logger.setLogLevel(level in LogLevelIndex ? level as keyof typeof LogLevelIndex : 'OFF')
}

function fail(message: string): never {
  throw new Error(message)
}

function parseNumber(value: string | undefined, label: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) fail(`${label} must be a number`)
  return parsed
}

function parseOptions(args: string[]) {
  const options: BalanceCliOptions = { json: false }
  const positionals: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }

    const value = args[index + 1]
    switch (token) {
      case '--json':
        options.json = true
        break
      case '--output':
        options.output = value
        index += 1
        break
      case '--input':
        options.input = value
        index += 1
        break
      case '--games':
        options.games = parseNumber(value, 'games')
        index += 1
        break
      case '--seed':
        options.seed = value
        index += 1
        break
      case '--strategies':
        options.strategies = value?.split(',').map((entry) => entry.trim()).filter(Boolean)
        index += 1
        break
      case '--max-actions':
        options.maxActions = parseNumber(value, 'max-actions')
        index += 1
        break
      case '--max-idle-polls':
        options.maxIdlePolls = parseNumber(value, 'max-idle-polls')
        index += 1
        break
      case '--poll-interval-ms':
        options.pollIntervalMs = parseNumber(value, 'poll-interval-ms')
        index += 1
        break
      case '--match-timeout-ms':
        options.matchTimeoutMs = parseNumber(value, 'match-timeout-ms')
        index += 1
        break
      case '--rpc-url':
        options.rpcUrl = value
        index += 1
        break
      case '--torii-url':
        options.toriiUrl = value
        index += 1
        break
      case '--world-address':
        options.worldAddress = value
        index += 1
        break
      case '--burner-a':
        options.burnerA = parseNumber(value, 'burner-a')
        index += 1
        break
      case '--burner-b':
        options.burnerB = parseNumber(value, 'burner-b')
        index += 1
        break
      default:
        fail(`Unknown option: ${token}`)
    }
  }

  return { options, positionals }
}

function pickEnv(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0)
}

function sleep(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

function logProgress(message: string) {
  console.error(`[balance-lab] ${message}`)
}

function readWorldAddress(explicit?: string) {
  if (explicit) return explicit
  const envValue = pickEnv(process.env.BLOCDUEL_AGENT_WORLD_ADDRESS)
  if (envValue) return envValue
  return readFileSync('.data/world_address.txt', 'utf8').trim()
}

function normalizeSeed(seed: string) {
  let hash = 1779033703 ^ seed.length
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353)
    hash = (hash << 13) | (hash >>> 19)
  }
  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507)
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909)
    return (hash ^= hash >>> 16) >>> 0
  }
}

function createRandom(seed: string) {
  const seedFn = normalizeSeed(seed)
  let state = seedFn()
  return () => {
    state += 0x6d2b79f5
    let next = Math.imul(state ^ (state >>> 15), 1 | state)
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

function getDistinctSystems(snapshot: MatchSnapshot, playerIndex: 0 | 1) {
  return new Set(snapshot.players[playerIndex].systems).size
}

function getEscalationProgress(snapshot: MatchSnapshot, playerIndex: 0 | 1) {
  return playerIndex === 0
    ? Math.max(0, snapshot.escalationTrack) / 6
    : Math.max(0, -snapshot.escalationTrack) / 6
}

function getBestLineProgress(snapshot: MatchSnapshot, playerIndex: 0 | 1) {
  const player = snapshot.players[playerIndex]
  return Math.max(
    snapshot.agiTrack[playerIndex] / AGI_WIN_TARGET,
    getEscalationProgress(snapshot, playerIndex),
    getDistinctSystems(snapshot, playerIndex) / 4,
    (snapshot.agiTrack[playerIndex] + getDistinctSystems(snapshot, playerIndex) + player.heroCount) / 10,
  )
}

function createEmptyPlayerStats(): BalancePlayerStats {
  return {
    finalAgi: 0,
    finalCapital: 0,
    finalDistinctSystems: 0,
    finalHeroCount: 0,
    cardsPlayed: 0,
    cardsDiscarded: 0,
    heroInvokes: 0,
    earlyHeroInvokes: 0,
    chainPlays: 0,
  }
}

function getActionDraft(snapshot: MatchSnapshot, action: AgentAction) {
  if (action.kind === 'play_card' || action.kind === 'discard_card') {
    return snapshot.pyramid.find((node) => node.position === action.position)?.card ?? null
  }

  if (action.kind === 'invoke_hero') {
    const hero = snapshot.availableHeroes.find((entry) => entry.slot === action.slot)
    return hero ? getHeroById(hero.id) : null
  }

  return null
}

function isAbruptEnding(before: MatchSnapshot, after: MatchSnapshot, action: AgentAction, actorIndex: 0 | 1) {
  if (after.phase !== 'GAME_OVER') return false

  if (after.winCondition === 'EscalationDominance') {
    return Math.abs(after.escalationTrack - before.escalationTrack) >= 2 || after.age <= 2
  }

  if (after.winCondition === 'AgiBreakthrough') {
    return after.agiTrack[actorIndex] - before.agiTrack[actorIndex] >= 2 || after.age <= 2
  }

  if (after.winCondition === 'SystemsDominance') {
    return getDistinctSystems(before, actorIndex) <= 2
  }

  return after.age <= 2 && action.kind !== 'next_age'
}

function buildMatchups(strategies: string[], games: number, random: () => number) {
  const pairs = strategies.flatMap((strategyA) => strategies.map((strategyB) => ({ strategyA, strategyB })))
  const order = shuffle(pairs, random)
  return Array.from({ length: games }, (_, index) => order[index % order.length])
}

function getThresholds(totalCompleted: number) {
  const read = (key: string, fallback: number) => Number(process.env[key] ?? fallback)
  return {
    dominanceMax: read('BLOCDUEL_BALANCE_DOMINANCE_MAX', 0.45),
    deadPathMin: read('BLOCDUEL_BALANCE_DEAD_PATH_MIN', 0.1),
    firstPlayerWarn: read('BLOCDUEL_BALANCE_FIRST_PLAYER_WARN', 0.58),
    ageThreeMin: read('BLOCDUEL_BALANCE_AGE_THREE_MIN', 0.2),
    pointsMin: read('BLOCDUEL_BALANCE_POINTS_MIN', 0.1),
    heroWarn: read('BLOCDUEL_BALANCE_HERO_WARN', 1),
    abruptWarn: read('BLOCDUEL_BALANCE_ABRUPT_WARN', 0.35),
    minimumSampleSize: read('BLOCDUEL_BALANCE_MIN_SAMPLE', 12),
    totalCompleted,
  }
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function pickRepresentativeRuns(runs: MatchRecord[]) {
  const completed = runs.filter((run) => run.status === 'completed')
  const picked = new Set<number | null>()
  const samples: RepresentativeSample[] = []

  function add(label: string, predicate: (run: MatchRecord) => boolean, note: string) {
    const match = completed.find((run) => !picked.has(run.matchId) && predicate(run))
    if (!match) return
    picked.add(match.matchId)
    samples.push({
      label,
      matchId: match.matchId,
      strategies: `${match.strategyA} vs ${match.strategyB}`,
      winCondition: match.winCondition,
      turns: match.turns,
      note,
    })
  }

  add('AGI sample', (run) => run.winCondition === 'AgiBreakthrough', 'Check whether compute buildup and AGI tempo both felt contestable.')
  add('Escalation sample', (run) => run.winCondition === 'EscalationDominance', 'Check whether the losing side had a realistic answer window before the kill turn.')
  add('Systems sample', (run) => run.winCondition === 'SystemsDominance', 'Check whether symbol denial and chain timing mattered.')
  add('Points sample', (run) => run.winCondition === 'Points', 'Check whether the game built to a readable Age III finish.')

  const closeLoss = [...completed]
    .filter((run) => run.loserProgress !== null)
    .sort((left, right) => (right.loserProgress ?? 0) - (left.loserProgress ?? 0))[0]
  if (closeLoss && !picked.has(closeLoss.matchId)) {
    picked.add(closeLoss.matchId)
    samples.push({
      label: 'Close loss / comeback',
      matchId: closeLoss.matchId,
      strategies: `${closeLoss.strategyA} vs ${closeLoss.strategyB}`,
      winCondition: closeLoss.winCondition,
      turns: closeLoss.turns,
      note: 'Check whether both sides still had credible lines late into the game.',
    })
  }

  const fastEnd = [...completed].sort((left, right) => left.turns - right.turns)[0]
  if (fastEnd && !picked.has(fastEnd.matchId)) {
    picked.add(fastEnd.matchId)
    samples.push({
      label: 'Suspiciously fast ending',
      matchId: fastEnd.matchId,
      strategies: `${fastEnd.strategyA} vs ${fastEnd.strategyB}`,
      winCondition: fastEnd.winCondition,
      turns: fastEnd.turns,
      note: 'Check whether the ending felt interactive or like a non-response spike.',
    })
  }

  return samples
}

function analyzeRuns(runs: MatchRecord[]): BalanceAnalysis {
  const completed = runs.filter((run) => run.status === 'completed')
  const thresholds = getThresholds(completed.length)
  const totalActions = completed.reduce((sum, run) => sum + run.trace.length, 0)
  const totalDiscards = completed.reduce((sum, run) => sum + run.players[0].cardsDiscarded + run.players[1].cardsDiscarded, 0)
  const totalPlays = completed.reduce((sum, run) => sum + run.players[0].cardsPlayed + run.players[1].cardsPlayed, 0)
  const totalChains = completed.reduce((sum, run) => sum + run.players[0].chainPlays + run.players[1].chainPlays, 0)
  const heroMatches = completed.filter((run) => run.players[0].heroInvokes + run.players[1].heroInvokes > 0)
  const winnerWithHero = completed.filter((run) => {
    if (run.winner === 'tie' || run.winner === null) return false
    return run.players[run.winner].heroInvokes > 0
  })
  const completedWithWinner = completed.filter((run) => run.winner === 0 || run.winner === 1)
  const winConditions = Object.fromEntries(
    (['AgiBreakthrough', 'EscalationDominance', 'SystemsDominance', 'Points'] as KnownWinCondition[]).map((condition) => {
      const count = completed.filter((run) => run.winCondition === condition).length
      return [condition, { count, share: completed.length === 0 ? 0 : count / completed.length }]
    }),
  )
  const ages = Object.fromEntries(
    [1, 2, 3].map((age) => {
      const count = completed.filter((run) => run.ageEnded === age).length
      return [String(age), { count, share: completed.length === 0 ? 0 : count / completed.length }]
    }),
  )

  const averageTurnsByWinCondition = Object.fromEntries(
    Object.keys(winConditions).map((condition) => {
      const turns = completed.filter((run) => run.winCondition === condition).map((run) => run.turns)
      return [condition, average(turns)]
    }),
  )

  const matchupMatrix = Object.fromEntries(
    [...new Set(completed.map((run) => `${run.strategyA} vs ${run.strategyB}`))].map((key) => {
      const matchupRuns = completed.filter((run) => `${run.strategyA} vs ${run.strategyB}` === key)
      return [key, {
        games: matchupRuns.length,
        strategyAWins: matchupRuns.filter((run) => run.winner === 0).length,
        strategyBWins: matchupRuns.filter((run) => run.winner === 1).length,
        ties: matchupRuns.filter((run) => run.winner === 'tie').length,
      }]
    }),
  )

  const alerts: string[] = []
  for (const [condition, stats] of Object.entries(winConditions)) {
    if (stats.share > thresholds.dominanceMax) alerts.push(`${condition} dominance alert: ${(stats.share * 100).toFixed(1)}%`)
    if (thresholds.totalCompleted >= thresholds.minimumSampleSize && stats.share < thresholds.deadPathMin) {
      alerts.push(`${condition} dead-path alert: ${(stats.share * 100).toFixed(1)}%`)
    }
  }
  if ((ages['3']?.share ?? 0) < thresholds.ageThreeMin || winConditions.Points.share < thresholds.pointsMin) {
    alerts.push('Engine alert: too few Age III / points finishes.')
  }
  if ((ages['1']?.share ?? 0) > 0 || (ages['2']?.share ?? 0) > 0.8) {
    alerts.push('Tempo alert: too many games end before Age III.')
  }
  if (runs.some((run) => run.status !== 'completed')) {
    alerts.push(`Reliability alert: ${runs.filter((run) => run.status !== 'completed').length} matches stalled or failed.`)
  }

  const winnerEarlyHeroes = completedWithWinner.map((run) => run.players[run.winner as 0 | 1].earlyHeroInvokes)
  const abruptEndingRate = completed.length === 0 ? 0 : completed.filter((run) => run.abruptEnding).length / completed.length
  const firstPlayerWinRate = completedWithWinner.length === 0
    ? 0
    : completedWithWinner.filter((run) => run.firstPlayerWon).length / completedWithWinner.length
  const noCompleted = completed.length === 0

  const scorecard: Record<string, ScorecardEntry> = {
    winConditionMix: noCompleted
      ? {
          status: 'fail',
          value: '0 completed games',
          detail: 'No balance conclusion is valid until at least one match completes.',
        }
      : Object.values(winConditions).every((stats) => stats.share <= thresholds.dominanceMax
      && (thresholds.totalCompleted < thresholds.minimumSampleSize || stats.share >= thresholds.deadPathMin))
      ? {
          status: 'pass',
          value: Object.entries(winConditions).map(([key, stats]) => `${key} ${(stats.share * 100).toFixed(0)}%`).join(', '),
          detail: 'No win line is dominating or completely dead.',
        }
      : {
          status: 'warn',
          value: Object.entries(winConditions).map(([key, stats]) => `${key} ${(stats.share * 100).toFixed(0)}%`).join(', '),
          detail: 'One or more win lines are outside the mixed-win target band.',
        },
    endingAgeMix: noCompleted
      ? {
          status: 'fail',
          value: '0 completed games',
          detail: 'Ending-age mix cannot be evaluated without finished matches.',
        }
      : (ages['2']?.share ?? 0) >= 0.2 && (ages['3']?.share ?? 0) >= thresholds.ageThreeMin
      ? {
          status: 'pass',
          value: `Age II ${((ages['2']?.share ?? 0) * 100).toFixed(0)}%, Age III ${((ages['3']?.share ?? 0) * 100).toFixed(0)}%`,
          detail: 'Games are spread across mid and late endings.',
        }
      : {
          status: 'warn',
          value: `Age I ${((ages['1']?.share ?? 0) * 100).toFixed(0)}%, Age II ${((ages['2']?.share ?? 0) * 100).toFixed(0)}%, Age III ${((ages['3']?.share ?? 0) * 100).toFixed(0)}%`,
          detail: 'Ending-age mix is too concentrated.',
        },
    firstPlayerAdvantage: noCompleted
      ? {
          status: 'fail',
          value: '0 completed games',
          detail: 'Seat advantage cannot be evaluated without winners.',
        }
      : firstPlayerWinRate <= thresholds.firstPlayerWarn
      ? {
          status: 'pass',
          value: `${(firstPlayerWinRate * 100).toFixed(1)}%`,
          detail: 'Seat advantage is within the target band.',
        }
      : {
          status: 'warn',
          value: `${(firstPlayerWinRate * 100).toFixed(1)}%`,
          detail: 'Seat advantage looks too high.',
        },
    heroPressure: noCompleted
      ? {
          status: 'fail',
          value: '0 completed games',
          detail: 'Hero pressure cannot be evaluated without finished winners.',
        }
      : average(winnerEarlyHeroes) <= thresholds.heroWarn
      ? {
          status: 'pass',
          value: `${average(winnerEarlyHeroes).toFixed(2)} early heroes on winners`,
          detail: 'Heroes are not obviously crowding out normal card lines.',
        }
      : {
          status: 'warn',
          value: `${average(winnerEarlyHeroes).toFixed(2)} early heroes on winners`,
          detail: 'Winning lines may be leaning too hard on early heroes.',
        },
    abruptEndings: noCompleted
      ? {
          status: 'fail',
          value: '0 completed games',
          detail: 'Abrupt-ending rate cannot be evaluated without finished matches.',
        }
      : abruptEndingRate <= thresholds.abruptWarn
      ? {
          status: 'pass',
          value: `${(abruptEndingRate * 100).toFixed(1)}%`,
          detail: 'Abrupt endings are within the target band.',
        }
      : {
          status: 'warn',
          value: `${(abruptEndingRate * 100).toFixed(1)}%`,
          detail: 'Too many games end immediately after a major spike.',
        },
    replayability: {
      status: 'manual',
      value: `${pickRepresentativeRuns(runs).length} sampled matches`,
      detail: 'Manual checklist required: confirm at least 3 distinct victory stories.',
    },
  }

  return {
    totals: {
      games: runs.length,
      completed: completed.length,
      stalled: runs.filter((run) => run.status === 'stalled').length,
      failed: runs.filter((run) => run.status === 'failed').length,
    },
    winConditions,
    ages,
    averageTurns: average(completed.map((run) => run.turns)),
    averageTurnsByWinCondition,
    firstPlayerWinRate,
    discardUsageRate: totalActions === 0 ? 0 : totalDiscards / totalActions,
    chainUsageRate: totalPlays === 0 ? 0 : totalChains / totalPlays,
    heroUsageRate: completed.length === 0 ? 0 : heroMatches.length / completed.length,
    heroWinContribution: completedWithWinner.length === 0 ? 0 : winnerWithHero.length / completedWithWinner.length,
    abruptEndingRate,
    stallRate: runs.length === 0 ? 0 : runs.filter((run) => run.status !== 'completed').length / runs.length,
    matchupMatrix,
    alerts,
    scorecard,
    samples: pickRepresentativeRuns(runs),
    rubric: [
      'Tension: did both players have a plausible path for most of the game?',
      'Counterplay: were there meaningful denial, discard, or timing windows?',
      'Payoff: did saving for a hero or chain feel worth it?',
      'Readability: was the winner legible before the ending, but not trivial too early?',
      'Replayability: did this victory story feel meaningfully different from the other sampled games?',
      'Feel-bad check: did the loser get locked out too early or lose to a non-interactive spike?',
    ],
  }
}

function renderRate(rate: number) {
  return `${(rate * 100).toFixed(1)}%`
}

function renderReport(batch: BalanceBatch) {
  const analysis = batch.analysis
  const lines = [
    'Bloc Duel Balance Lab',
    `Generated: ${batch.generatedAt}`,
    `Games: ${analysis.totals.games} total, ${analysis.totals.completed} completed, ${analysis.totals.stalled} stalled, ${analysis.totals.failed} failed`,
    '',
    'Win conditions:',
    ...Object.entries(analysis.winConditions).map(([condition, stats]) => `- ${condition}: ${stats.count} (${renderRate(stats.share)})`),
    '',
    'Ending ages:',
    ...Object.entries(analysis.ages).map(([age, stats]) => `- Age ${age}: ${stats.count} (${renderRate(stats.share)})`),
    '',
    `Average turns: ${analysis.averageTurns.toFixed(2)}`,
    `First-player win rate: ${renderRate(analysis.firstPlayerWinRate)}`,
    `Discard usage rate: ${renderRate(analysis.discardUsageRate)}`,
    `Chain usage rate: ${renderRate(analysis.chainUsageRate)}`,
    `Hero usage rate: ${renderRate(analysis.heroUsageRate)}`,
    `Hero win contribution: ${renderRate(analysis.heroWinContribution)}`,
    `Abrupt ending rate: ${renderRate(analysis.abruptEndingRate)}`,
    `Stall rate: ${renderRate(analysis.stallRate)}`,
    '',
    'Matchups:',
    ...Object.entries(analysis.matchupMatrix).map(([key, stats]) =>
      `- ${key}: ${stats.games} games, A ${stats.strategyAWins}, B ${stats.strategyBWins}, ties ${stats.ties}`,
    ),
    '',
    'Scorecard:',
    ...Object.entries(analysis.scorecard).map(([label, entry]) =>
      `- ${label}: ${entry.status.toUpperCase()} | ${entry.value} | ${entry.detail}`,
    ),
    '',
    'Alerts:',
    ...(analysis.alerts.length === 0 ? ['- none'] : analysis.alerts.map((alert) => `- ${alert}`)),
    '',
    'Representative samples:',
    ...analysis.samples.map((sample) =>
      `- ${sample.label}: #${sample.matchId ?? 'n/a'} | ${sample.strategies} | ${sample.winCondition ?? 'n/a'} | ${sample.turns} turns | ${sample.note}`,
    ),
    '',
    'Manual rubric:',
    ...analysis.rubric.map((item) => `- ${item}`),
  ]

  return lines.join('\n')
}

async function runMatch(
  clientA: Awaited<ReturnType<typeof createAgentClient>>,
  clientB: Awaited<ReturnType<typeof createAgentClient>>,
  strategyA: string,
  strategyB: string,
  seed: string,
  maxActions: number,
  maxIdlePolls: number,
  pollIntervalMs: number,
  matchTimeoutMs: number,
): Promise<MatchRecord> {
  const random = createRandom(seed)
  const playerStats: [BalancePlayerStats, BalancePlayerStats] = [createEmptyPlayerStats(), createEmptyPlayerStats()]
  const trace: MatchTraceStep[] = []
  const startedAt = Date.now()

  try {
    const created = await clientA.createMatch()
    if (!created.matchId) {
      return {
        matchId: null,
        status: 'failed',
        error: 'createMatch did not return a match id',
        strategyA,
        strategyB,
        turns: 0,
        ageEnded: null,
        phase: null,
        winner: null,
        winnerStrategy: null,
        winCondition: null,
        firstPlayerWon: null,
        abruptEnding: false,
        loserProgress: null,
        players: playerStats,
        trace,
      }
    }

    await clientB.joinMatch(created.matchId)
    let snapshot = await clientA.getMatch(created.matchId)
    let idlePolls = 0
    let abruptEnding = false

    while (
      snapshot
      && snapshot.phase !== 'GAME_OVER'
      && trace.length < maxActions
      && idlePolls < maxIdlePolls
      && Date.now() - startedAt < matchTimeoutMs
    ) {
      const actorIndex = snapshot.currentPlayer
      const activeClient = actorIndex === 0 ? clientA : clientB
      const strategyName = actorIndex === 0 ? strategyA : strategyB
      const legalActions = await activeClient.getLegalActions(snapshot.gameId)

      if (legalActions.length === 0) {
        idlePolls += 1
        await sleep(pollIntervalMs)
        snapshot = await activeClient.getMatch(snapshot.gameId)
        continue
      }

      const choose = resolveStrategy(strategyName)
      const beforeSnapshot = snapshot
      const action = choose({
        actorAddress: activeClient.address ?? '0x0',
        matchId: beforeSnapshot.gameId,
        snapshot: beforeSnapshot,
        legalActions,
        random,
      })
      const draft = getActionDraft(beforeSnapshot, action)
      const chainPlay = action.kind === 'play_card'
        && !!draft
        && 'chainFrom' in draft
        && isFreeViaChain(beforeSnapshot.players[actorIndex], draft)
      const result = await activeClient.submitAction(beforeSnapshot.gameId, action)
      snapshot = result.snapshot ?? await activeClient.getMatch(beforeSnapshot.gameId)

      if (action.kind === 'play_card') {
        playerStats[actorIndex].cardsPlayed += 1
        if (chainPlay) playerStats[actorIndex].chainPlays += 1
      } else if (action.kind === 'discard_card') {
        playerStats[actorIndex].cardsDiscarded += 1
      } else if (action.kind === 'invoke_hero') {
        playerStats[actorIndex].heroInvokes += 1
        if (beforeSnapshot.age === 1 || trace.length < 6) {
          playerStats[actorIndex].earlyHeroInvokes += 1
        }
      }

      if (snapshot) {
        abruptEnding = abruptEnding || isAbruptEnding(beforeSnapshot, snapshot, action, actorIndex)
      }

      trace.push({
        turn: trace.length + 1,
        actorIndex,
        strategy: strategyName,
        actionKind: action.kind,
        actionLabel: formatAgentAction(action),
        ageBefore: beforeSnapshot.age,
        ageAfter: snapshot?.age ?? null,
        agiBefore: beforeSnapshot.agiTrack,
        agiAfter: snapshot?.agiTrack ?? null,
        escalationBefore: beforeSnapshot.escalationTrack,
        escalationAfter: snapshot?.escalationTrack ?? null,
        systemsBefore: [getDistinctSystems(beforeSnapshot, 0), getDistinctSystems(beforeSnapshot, 1)],
        systemsAfter: snapshot ? [getDistinctSystems(snapshot, 0), getDistinctSystems(snapshot, 1)] : null,
        heroCountsBefore: [beforeSnapshot.players[0].heroCount, beforeSnapshot.players[1].heroCount],
        heroCountsAfter: snapshot ? [snapshot.players[0].heroCount, snapshot.players[1].heroCount] : null,
        chainPlay,
      })

      idlePolls = 0
    }

    if (snapshot) {
      for (const playerIndex of [0, 1] as const) {
        playerStats[playerIndex].finalAgi = snapshot.agiTrack[playerIndex]
        playerStats[playerIndex].finalCapital = snapshot.players[playerIndex].capital
        playerStats[playerIndex].finalDistinctSystems = getDistinctSystems(snapshot, playerIndex)
        playerStats[playerIndex].finalHeroCount = snapshot.players[playerIndex].heroCount
      }
    }

    if (!snapshot) {
      return {
        matchId: created.matchId,
        status: 'failed',
        error: 'match snapshot disappeared',
        strategyA,
        strategyB,
        turns: trace.length,
        ageEnded: null,
        phase: null,
        winner: null,
        winnerStrategy: null,
        winCondition: null,
        firstPlayerWon: null,
        abruptEnding,
        loserProgress: null,
        players: playerStats,
        trace,
      }
    }

    if (snapshot.phase !== 'GAME_OVER') {
      return {
        matchId: created.matchId,
        status: 'stalled',
        error: Date.now() - startedAt >= matchTimeoutMs
          ? 'match timeout reached'
          : trace.length >= maxActions
            ? 'max actions reached'
            : 'max idle polls reached',
        strategyA,
        strategyB,
        turns: trace.length,
        ageEnded: snapshot.age,
        phase: snapshot.phase,
        winner: snapshot.winner,
        winnerStrategy: snapshot.winner === 0 ? strategyA : snapshot.winner === 1 ? strategyB : null,
        winCondition: snapshot.winCondition,
        firstPlayerWon: snapshot.winner === 0 ? true : snapshot.winner === 1 ? false : null,
        abruptEnding,
        loserProgress: snapshot.winner === 0 || snapshot.winner === 1 ? getBestLineProgress(snapshot, snapshot.winner === 0 ? 1 : 0) : null,
        players: playerStats,
        trace,
      }
    }

    return {
      matchId: created.matchId,
      status: 'completed',
      error: null,
      strategyA,
      strategyB,
      turns: trace.length,
      ageEnded: snapshot.age,
      phase: snapshot.phase,
      winner: snapshot.winner,
      winnerStrategy: snapshot.winner === 0 ? strategyA : snapshot.winner === 1 ? strategyB : null,
      winCondition: snapshot.winCondition,
      firstPlayerWon: snapshot.winner === 0 ? true : snapshot.winner === 1 ? false : null,
      abruptEnding,
      loserProgress: snapshot.winner === 0 || snapshot.winner === 1 ? getBestLineProgress(snapshot, snapshot.winner === 0 ? 1 : 0) : null,
      players: playerStats,
      trace,
    }
  } catch (error) {
    return {
      matchId: null,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      strategyA,
      strategyB,
      turns: trace.length,
      ageEnded: null,
      phase: null,
      winner: null,
      winnerStrategy: null,
      winCondition: null,
      firstPlayerWon: null,
      abruptEnding: false,
      loserProgress: null,
      players: playerStats,
      trace,
    }
  }
}

async function runBalanceLab(options: BalanceCliOptions) {
  const seed = options.seed ?? process.env.BLOCDUEL_BALANCE_SEED ?? 'bloc-duel-balance'
  const strategies = options.strategies ?? pickEnv(process.env.BLOCDUEL_BALANCE_STRATEGIES)
    ?.split(',').map((entry) => entry.trim()).filter(Boolean) ?? DEFAULT_STRATEGIES
  const games = options.games ?? Number(process.env.BLOCDUEL_BALANCE_GAMES ?? 24)
  const maxActions = options.maxActions ?? Number(process.env.BLOCDUEL_BALANCE_MAX_ACTIONS ?? 200)
  const maxIdlePolls = options.maxIdlePolls ?? Number(process.env.BLOCDUEL_BALANCE_MAX_IDLE_POLLS ?? 120)
  const pollIntervalMs = options.pollIntervalMs ?? Number(process.env.BLOCDUEL_BALANCE_POLL_INTERVAL_MS ?? 500)
  const matchTimeoutMs = options.matchTimeoutMs ?? Number(process.env.BLOCDUEL_BALANCE_MATCH_TIMEOUT_MS ?? 300_000)
  const rpcUrl = options.rpcUrl ?? process.env.BLOCDUEL_AGENT_RPC_URL ?? 'http://127.0.0.1:5050'
  const toriiUrl = options.toriiUrl ?? process.env.BLOCDUEL_AGENT_TORII_URL ?? 'http://127.0.0.1:8080'
  const worldAddress = readWorldAddress(options.worldAddress)
  const output = options.output ?? process.env.BLOCDUEL_BALANCE_OUTPUT ?? DEFAULT_OUTPUT
  const burnerA = options.burnerA ?? Number(process.env.BLOCDUEL_BALANCE_BURNER_A ?? 0)
  const burnerB = options.burnerB ?? Number(process.env.BLOCDUEL_BALANCE_BURNER_B ?? 1)
  const random = createRandom(seed)
  const matchups = buildMatchups(strategies, games, random)

  const clientOptions: AgentClientOptions = { network: 'katana', rpcUrl, toriiUrl, worldAddress }
  const clientA = await createAgentClient({ ...clientOptions, signer: { mode: 'katana-burner', burnerIndex: burnerA } })
  const clientB = await createAgentClient({ ...clientOptions, signer: { mode: 'katana-burner', burnerIndex: burnerB } })

  try {
    const runs: MatchRecord[] = []
    for (let index = 0; index < matchups.length; index += 1) {
      const matchup = matchups[index]
      logProgress(`match ${index + 1}/${matchups.length}: ${matchup.strategyA} vs ${matchup.strategyB}`)
      const record = await runMatch(
        clientA,
        clientB,
        matchup.strategyA,
        matchup.strategyB,
        `${seed}:${index}:${matchup.strategyA}:${matchup.strategyB}`,
        maxActions,
        maxIdlePolls,
        pollIntervalMs,
        matchTimeoutMs,
      )
      runs.push(record)
      logProgress(
        `${record.matchId ?? 'n/a'} -> ${record.status}${record.winCondition ? ` (${record.winCondition})` : ''}${record.error ? ` | ${record.error}` : ''}`,
      )
    }

    const batch: BalanceBatch = {
      generatedAt: new Date().toISOString(),
      config: {
        games,
        seed,
        strategies,
        maxActions,
        maxIdlePolls,
        pollIntervalMs,
        output,
        rpcUrl,
        toriiUrl,
        worldAddress,
        burnerA,
        burnerB,
        matchTimeoutMs,
      },
      runs,
      analysis: analyzeRuns(runs),
    }

    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, JSON.stringify(batch, null, 2))

    return batch
  } finally {
    clientA.close()
    clientB.close()
  }
}

function readBatch(input?: string) {
  const source = input ?? process.env.BLOCDUEL_BALANCE_INPUT ?? DEFAULT_OUTPUT
  if (!existsSync(source)) fail(`Missing balance batch file: ${source}`)
  return JSON.parse(readFileSync(source, 'utf8')) as BalanceBatch
}

async function main() {
  configureStarknetLogging()

  const { options, positionals } = parseOptions(process.argv.slice(2))
  const command = positionals[0] ?? 'run'

  if (command === 'run') {
    const batch = await runBalanceLab(options)
    if (options.json) {
      console.log(JSON.stringify(batch, null, 2))
    } else {
      console.log(renderReport(batch))
      console.log(`\nSaved JSON: ${batch.config.output}`)
    }

    if (batch.analysis.totals.failed > 0 || batch.analysis.totals.stalled > 0) {
      process.exitCode = 1
    }
    return
  }

  if (command === 'report') {
    const stored = readBatch(options.input ?? options.output)
    const batch = {
      ...stored,
      analysis: analyzeRuns(stored.runs),
    }
    if (options.json) {
      console.log(JSON.stringify(batch.analysis, null, 2))
    } else {
      console.log(renderReport(batch))
    }
    return
  }

  fail('Usage: balance <run|report> [--games N] [--strategies a,b,c] [--seed seed] [--output path] [--match-timeout-ms N] [--json]')
}

await main()
