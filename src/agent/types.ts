import type { AccountInterface } from 'starknet'
import type { BlocDuelConfigOverride } from '../dojo/config'
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
  | { mode: 'session-key'; account: AccountInterface; address?: string }

export interface AgentRuntimeOptions extends BlocDuelConfigOverride {
  signer?: AgentSignerConfig
  policy?: AgentPolicy | null
}

export interface StrategyContext {
  actorAddress: string
  gameId: number
  snapshot: GameSnapshot
  legalActions: AgentAction[]
  random: () => number
}

export type AgentStrategy = (context: StrategyContext) => AgentAction

export interface SubmittedActionResult {
  action: AgentAction
  dryRun: boolean
  txHash: string | null
  snapshot: GameSnapshot | null
  version: string | null
}

export interface CreatedGameResult {
  action: Extract<AgentAction, { kind: 'create_game' }>
  dryRun: boolean
  txHash: string | null
  gameId: number | null
  snapshot: GameSnapshot | null
}

export interface JoinedGameResult {
  action: Extract<AgentAction, { kind: 'join_game' }>
  dryRun: boolean
  txHash: string | null
  snapshot: GameSnapshot | null
}

export interface PlayTurnResult {
  action: AgentAction | null
  snapshot: GameSnapshot | null
  txHash: string | null
  dryRun: boolean
}

export interface PlayGameOptions {
  pollIntervalMs?: number
  maxActions?: number
  maxIdlePolls?: number
}

export interface PlayGameResult {
  actions: SubmittedActionResult[]
  finalSnapshot: GameSnapshot | null
}

export interface WaitForGameUpdateOptions {
  attempts?: number
  intervalMs?: number
}

export interface WaitForGameUpdateResult {
  snapshot: GameSnapshot | null
  version: string | null
}

export interface AgentClient {
  readonly address: string | null
  listGames(): Promise<GameSummary[]>
  getGame(gameId: number, actorAddress?: string): Promise<GameSnapshot | null>
  createGame(): Promise<CreatedGameResult>
  joinGame(gameId: number): Promise<JoinedGameResult>
  getLegalActions(gameId: number, actorAddress?: string): Promise<AgentAction[]>
  submitAction(gameId: number, action: AgentAction): Promise<SubmittedActionResult>
  waitForGameUpdate(
    gameId: number,
    previousVersionHint?: string | null,
    options?: WaitForGameUpdateOptions,
  ): Promise<WaitForGameUpdateResult>
  playTurn(gameId: number, strategy: string | AgentStrategy): Promise<PlayTurnResult>
  playGame(
    gameId: number,
    strategy: string | AgentStrategy,
    options?: PlayGameOptions,
  ): Promise<PlayGameResult>
  close(): void
}
