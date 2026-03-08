import type { AccountInterface } from 'starknet'
import type { BlocDuelConfigOverride } from '../dojo/config'
import type { BlocDuelSessionPolicies } from '../dojo/policies'
import type { GameSnapshot, GameSummary } from '../dojo/torii'
import type { SystemSymbol } from '../game/systems'

export type AgentAction =
  | { kind: 'create_game' }
  | { kind: 'join_game'; gameId: number }
  | { kind: 'play_card'; gameId: number; position: number }
  | { kind: 'discard_card'; gameId: number; position: number }
  | { kind: 'invoke_hero'; gameId: number; slot: 0 | 1 | 2 }
  | { kind: 'choose_system_bonus'; gameId: number; symbol: SystemSymbol }
  | { kind: 'next_age'; gameId: number }

export interface AgentPolicy {
  allowedGameIds?: number[]
  allowedOpponentAddresses?: string[]
  maxCapitalSpendPerAction?: number
  dryRun?: boolean
  allowMainnet?: boolean
  cooldownMs?: number
  waitForIndexingAttempts?: number
  waitForIndexingIntervalMs?: number
}

export type AgentSignerConfig =
  | { mode: 'katana-burner'; burnerIndex?: number; address?: string }
  | { mode: 'private-key'; address: string; privateKey: string }
  | { mode: 'controller-session'; basePath?: string; keychainUrl?: string; policies?: BlocDuelSessionPolicies }
  | { mode: 'session-key'; account: AccountInterface; address?: string }

export interface AgentClientOptions extends BlocDuelConfigOverride {
  signer?: AgentSignerConfig
  policy?: AgentPolicy | null
}

export interface StrategyContext {
  actorAddress: string
  matchId: number
  snapshot: MatchSnapshot
  legalActions: AgentAction[]
  random: () => number
}

export type AgentStrategy = (context: StrategyContext) => AgentAction
export type MatchSummary = GameSummary
export type MatchSnapshot = GameSnapshot

export interface SubmittedActionResult {
  action: AgentAction
  dryRun: boolean
  txHash: string | null
  snapshot: MatchSnapshot | null
  version: string | null
}

export interface CreatedMatchResult {
  action: Extract<AgentAction, { kind: 'create_game' }>
  dryRun: boolean
  txHash: string | null
  matchId: number | null
  snapshot: MatchSnapshot | null
}

export interface JoinedMatchResult {
  action: Extract<AgentAction, { kind: 'join_game' }>
  dryRun: boolean
  txHash: string | null
  snapshot: MatchSnapshot | null
}

export interface PlayTurnResult {
  action: AgentAction | null
  snapshot: MatchSnapshot | null
  txHash: string | null
  dryRun: boolean
}

export interface PlayMatchOptions {
  pollIntervalMs?: number
  maxActions?: number
  maxIdlePolls?: number
}

export interface PlayMatchResult {
  actions: SubmittedActionResult[]
  finalSnapshot: MatchSnapshot | null
}

export interface SelfPlayOptions extends PlayMatchOptions {
  strategyA?: string | AgentStrategy
  strategyB?: string | AgentStrategy
  burnerA?: number
  burnerB?: number
}

export interface SelfPlayResult {
  matchId: number | null
  turns: number
  finalSnapshot: MatchSnapshot | null
}

export interface WaitForMatchUpdateOptions {
  attempts?: number
  intervalMs?: number
}

export interface WaitForMatchUpdateResult {
  snapshot: MatchSnapshot | null
  version: string | null
}

export interface BlocDuelAgent {
  readonly address: string | null
  listMatches(): Promise<MatchSummary[]>
  listJoinableMatches(actorAddress?: string): Promise<MatchSummary[]>
  getMatch(matchId: number, actorAddress?: string): Promise<MatchSnapshot | null>
  createMatch(): Promise<CreatedMatchResult>
  joinMatch(matchId: number): Promise<JoinedMatchResult>
  getLegalActions(matchId: number, actorAddress?: string): Promise<AgentAction[]>
  submitAction(matchId: number, action: AgentAction): Promise<SubmittedActionResult>
  waitForMatchUpdate(
    matchId: number,
    previousVersionHint?: string | null,
    options?: WaitForMatchUpdateOptions,
  ): Promise<WaitForMatchUpdateResult>
  playTurn(matchId: number, strategy: string | AgentStrategy): Promise<PlayTurnResult>
  playMatch(
    matchId: number,
    strategy: string | AgentStrategy,
    options?: PlayMatchOptions,
  ): Promise<PlayMatchResult>
  selfPlay(options?: SelfPlayOptions): Promise<SelfPlayResult>
  close(): void
}
