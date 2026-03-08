import { CairoCustomEnum, type AccountInterface, type RpcProvider } from 'starknet'
import { createBlocDuelRuntime, type BlocDuelWorld } from '../dojo/client'
import { getTransactionExplorerUrl, resolveDojoConfig, type BlocDuelConfig } from '../dojo/config'
import {
  fetchGameSnapshot,
  fetchGameSummaries,
  normalizeAddress,
  type GameSnapshot,
} from '../dojo/torii'
import {
  canAfford,
  canAffordHero,
  estimateCapitalSpend,
  getAvailableDraftNodes,
  getDraftNode,
  getHeroSurcharge,
  isFreeViaChain,
} from '../game/rules'
import { resolveAgentSigner } from './signer'
import { resolveStrategy } from './strategies'
import type {
  AgentAction,
  AgentClientOptions,
  AgentPolicy,
  AgentStrategy,
  BlocDuelAgent,
  CreatedMatchResult,
  JoinedMatchResult,
  PlayMatchOptions,
  PlayMatchResult,
  PlayTurnResult,
  SelfPlayOptions,
  SelfPlayResult,
  SubmittedActionResult,
  WaitForMatchUpdateOptions,
  WaitForMatchUpdateResult,
} from './types'

type ChooseSystemBonusAction = Extract<AgentAction, { kind: 'choose_system_bonus' }>

interface RuntimeState {
  account: AccountInterface | null
  address: string | null
  config: BlocDuelConfig
  policy: AgentPolicy | null
  rpcProvider: RpcProvider
  world: BlocDuelWorld
  toriiClient: Awaited<ReturnType<typeof createBlocDuelRuntime>>['toriiClient']
}

function sleep(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

function versionSnapshot(snapshot: GameSnapshot | null): string | null {
  return snapshot ? JSON.stringify(snapshot) : null
}

function actionKey(action: AgentAction): string {
  switch (action.kind) {
    case 'create_game':
      return action.kind
    case 'join_game':
      return `${action.kind}:${action.gameId}`
    case 'play_card':
    case 'discard_card':
      return `${action.kind}:${action.gameId}:${action.position}`
    case 'invoke_hero':
      return `${action.kind}:${action.gameId}:${action.slot}`
    case 'choose_system_bonus':
      return `${action.kind}:${action.gameId}:${action.symbol}`
    case 'next_age':
      return `${action.kind}:${action.gameId}`
  }
}

function toCairoSystemSymbol(symbol: ChooseSystemBonusAction['symbol']) {
  return new CairoCustomEnum({
    None: undefined,
    Compute: symbol === 'COMPUTE' ? '' : undefined,
    Finance: symbol === 'FINANCE' ? '' : undefined,
    Cyber: symbol === 'CYBER' ? '' : undefined,
    Diplomacy: symbol === 'DIPLOMACY' ? '' : undefined,
  })
}

function requireSigner(state: RuntimeState) {
  if (!state.account || !state.address) {
    throw new Error('A signer is required for this command')
  }

  return {
    account: state.account,
    address: state.address,
  }
}

async function waitForTransaction(rpcProvider: RpcProvider, transactionHash: string) {
  try {
    await rpcProvider.waitForTransaction(transactionHash)
  } catch {
    await sleep(1500)
  }
}

function getActorIndex(snapshot: GameSnapshot, actorAddress: string): 0 | 1 | null {
  const normalized = normalizeAddress(actorAddress)
  if (normalized === '0x0') return null
  if (snapshot.players[0].address === normalized) return 0
  if (snapshot.players[1].address === normalized) return 1
  return null
}

function getOpponentAddress(snapshot: GameSnapshot, actorIndex: 0 | 1 | null): string | null {
  if (actorIndex === null) return null
  return snapshot.players[actorIndex === 0 ? 1 : 0].address
}

function estimateCapitalCost(snapshot: GameSnapshot, actorIndex: 0 | 1, action: AgentAction): number {
  const player = snapshot.players[actorIndex]

  switch (action.kind) {
    case 'create_game':
    case 'join_game':
    case 'discard_card':
    case 'choose_system_bonus':
    case 'next_age':
      return 0
    case 'play_card': {
      const node = getDraftNode(snapshot.pyramid, action.position)
      if (!node) return Number.POSITIVE_INFINITY
      if (isFreeViaChain(player, node.node.card)) return 0
      return estimateCapitalSpend(player, node.node.card.cost)
    }
    case 'invoke_hero': {
      const hero = snapshot.availableHeroes.find((entry) => entry.slot === action.slot)
      if (!hero) return Number.POSITIVE_INFINITY
      return estimateCapitalSpend(player, hero.cost, getHeroSurcharge(player))
    }
  }
}

function assertPolicy(
  state: RuntimeState,
  snapshot: GameSnapshot | null,
  actorAddress: string,
  action: AgentAction,
) {
  if (state.config.network === 'mainnet' && !state.policy) {
    throw new Error('Mainnet mutations require an explicit policy')
  }

  if (!state.policy) return

  if (state.config.network === 'mainnet' && !state.policy.allowMainnet) {
    throw new Error('Policy blocks mainnet mutations')
  }

  if (state.policy.allowedGameIds && 'gameId' in action && !state.policy.allowedGameIds.includes(action.gameId)) {
    throw new Error(`Policy blocks game #${action.gameId}`)
  }

  if (!snapshot) return

  const actorIndex = getActorIndex(snapshot, actorAddress)
  const opponentAddress = getOpponentAddress(snapshot, actorIndex)
  if (
    opponentAddress
    && state.policy.allowedOpponentAddresses
    && !state.policy.allowedOpponentAddresses.includes(opponentAddress)
  ) {
    throw new Error(`Policy blocks opponent ${opponentAddress}`)
  }

  if (actorIndex !== null && state.policy.maxCapitalSpendPerAction !== undefined) {
    const capitalCost = estimateCapitalCost(snapshot, actorIndex, action)
    if (capitalCost > state.policy.maxCapitalSpendPerAction) {
      throw new Error(`Policy blocks capital spend ${capitalCost} > ${state.policy.maxCapitalSpendPerAction}`)
    }
  }
}

function buildLegalActions(snapshot: GameSnapshot, actorAddress: string): AgentAction[] {
  const actorIndex = getActorIndex(snapshot, actorAddress)

  if (snapshot.phase === 'LOBBY') {
    return actorIndex === null && snapshot.players[1].address === '0x0'
      ? [{ kind: 'join_game', gameId: snapshot.gameId }]
      : []
  }

  if (snapshot.phase === 'GAME_OVER' || actorIndex === null) {
    return []
  }

  if (snapshot.phase === 'AGE_TRANSITION') {
    return snapshot.currentPlayer === actorIndex
      ? [{ kind: 'next_age', gameId: snapshot.gameId }]
      : []
  }

  if (snapshot.systemBonusChoice) {
    return snapshot.currentPlayer === actorIndex && snapshot.systemBonusChoice.playerIndex === actorIndex
      ? snapshot.systemBonusChoice.options.map((symbol) => ({
          kind: 'choose_system_bonus' as const,
          gameId: snapshot.gameId,
          symbol,
        }))
      : []
  }

  if (snapshot.currentPlayer !== actorIndex) {
    return []
  }

  const player = snapshot.players[actorIndex]
  const actions: AgentAction[] = getAvailableDraftNodes(snapshot.pyramid).map((node) => ({
    kind: 'discard_card',
    gameId: snapshot.gameId,
    position: node.position,
  }))

  for (const node of getAvailableDraftNodes(snapshot.pyramid)) {
    if (isFreeViaChain(player, node.card) || canAfford(player, node.card.cost)) {
      actions.push({
        kind: 'play_card',
        gameId: snapshot.gameId,
        position: node.position,
      })
    }
  }

  for (const hero of snapshot.availableHeroes) {
    if (canAffordHero(player, hero)) {
      actions.push({
        kind: 'invoke_hero',
        gameId: snapshot.gameId,
        slot: hero.slot,
      })
    }
  }

  return actions
}

async function submitWorldAction(
  state: RuntimeState,
  action: Exclude<AgentAction, { kind: 'create_game' }>,
) {
  const { account } = requireSigner(state)

  switch (action.kind) {
    case 'join_game':
      return state.world.actions.joinGame(account, action.gameId)
    case 'play_card':
      return state.world.actions.playCard(account, action.gameId, action.position)
    case 'discard_card':
      return state.world.actions.discardCard(account, action.gameId, action.position)
    case 'invoke_hero':
      return state.world.actions.invokeHero(account, action.gameId, action.slot)
    case 'choose_system_bonus':
      return state.world.actions.chooseSystemBonus(account, action.gameId, toCairoSystemSymbol(action.symbol))
    case 'next_age':
      return state.world.actions.nextAge(account, action.gameId)
  }
}

class BlocDuelAgentClient implements BlocDuelAgent {
  readonly address: string | null
  private readonly state: RuntimeState

  constructor(state: RuntimeState) {
    this.state = state
    this.address = state.address
  }

  async listMatches() {
    return fetchGameSummaries(
      this.state.toriiClient,
      this.state.config.worldAddress,
      this.state.config.namespace,
    )
  }

  async listJoinableMatches(actorAddress?: string) {
    const address = normalizeAddress(actorAddress ?? this.address ?? '0x0')
    return (await this.listMatches()).filter(
      (match) => normalizeAddress(match.playerTwo) === '0x0' && normalizeAddress(match.playerOne) !== address,
    )
  }

  async getMatch(matchId: number, actorAddress?: string) {
    return fetchGameSnapshot(
      this.state.toriiClient,
      matchId,
      actorAddress ?? this.address ?? undefined,
      this.state.config.worldAddress,
      this.state.config.namespace,
    )
  }

  async createMatch(): Promise<CreatedMatchResult> {
    const { account, address } = requireSigner(this.state)
    const action: AgentAction = { kind: 'create_game' }
    assertPolicy(this.state, null, address, action)

    if (this.state.policy?.dryRun) {
      return { action, dryRun: true, txHash: null, matchId: null, snapshot: null }
    }

    const knownMatchIds = new Set((await this.listMatches()).map((match) => match.gameId))
    if (this.state.policy?.cooldownMs) {
      await sleep(this.state.policy.cooldownMs)
    }

    const result = await this.state.world.actions.createGame(account)
    await waitForTransaction(this.state.rpcProvider, result.transaction_hash)

    const attempts = this.state.policy?.waitForIndexingAttempts ?? 40
    const intervalMs = this.state.policy?.waitForIndexingIntervalMs ?? 500
    let matchId: number | null = null

    for (let attempt = 0; attempt < attempts && matchId === null; attempt += 1) {
      const matches = await this.listMatches()
      matchId = matches.find(
        (match) => !knownMatchIds.has(match.gameId) && normalizeAddress(match.playerOne) === address,
      )?.gameId ?? null

      if (matchId === null) {
        await sleep(intervalMs)
      }
    }

    return {
      action,
      dryRun: false,
      txHash: result.transaction_hash,
      matchId,
      snapshot: matchId === null ? null : await this.getMatch(matchId),
    }
  }

  async joinMatch(matchId: number): Promise<JoinedMatchResult> {
    const action: AgentAction = { kind: 'join_game', gameId: matchId }
    const result = await this.submitAction(matchId, action)
    return {
      action,
      dryRun: result.dryRun,
      txHash: result.txHash,
      snapshot: result.snapshot,
    }
  }

  async getLegalActions(matchId: number, actorAddress?: string) {
    const snapshot = await this.getMatch(matchId, actorAddress)
    if (!snapshot) return []
    return buildLegalActions(snapshot, actorAddress ?? this.address ?? '0x0')
  }

  async waitForMatchUpdate(
    matchId: number,
    previousVersionHint?: string | null,
    options: WaitForMatchUpdateOptions = {},
  ): Promise<WaitForMatchUpdateResult> {
    const attempts = options.attempts ?? this.state.policy?.waitForIndexingAttempts ?? 40
    const intervalMs = options.intervalMs ?? this.state.policy?.waitForIndexingIntervalMs ?? 500

    let latestSnapshot: GameSnapshot | null = null
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      latestSnapshot = await this.getMatch(matchId)
      const version = versionSnapshot(latestSnapshot)
      if (version !== previousVersionHint) {
        return { snapshot: latestSnapshot, version }
      }
      await sleep(intervalMs)
    }

    return {
      snapshot: latestSnapshot,
      version: versionSnapshot(latestSnapshot),
    }
  }

  async submitAction(matchId: number, action: AgentAction): Promise<SubmittedActionResult> {
    if (action.kind === 'create_game') {
      throw new Error('Use createMatch() for create_game')
    }

    const { address } = requireSigner(this.state)
    const snapshot = await this.getMatch(matchId, address)
    if (!snapshot) {
      throw new Error(`Match #${matchId} not found`)
    }

    const legalActions = buildLegalActions(snapshot, address)
    if (!legalActions.some((entry) => actionKey(entry) === actionKey(action))) {
      throw new Error(`Illegal action: ${actionKey(action)}`)
    }

    assertPolicy(this.state, snapshot, address, action)
    const previousVersion = versionSnapshot(snapshot)

    if (this.state.policy?.dryRun) {
      return {
        action,
        dryRun: true,
        txHash: null,
        snapshot,
        version: previousVersion,
      }
    }

    if (this.state.policy?.cooldownMs) {
      await sleep(this.state.policy.cooldownMs)
    }

    const result = await submitWorldAction(this.state, action)
    await waitForTransaction(this.state.rpcProvider, result.transaction_hash)
    const updated = await this.waitForMatchUpdate(matchId, previousVersion)

    return {
      action,
      dryRun: false,
      txHash: result.transaction_hash,
      snapshot: updated.snapshot,
      version: updated.version,
    }
  }

  async playTurn(matchId: number, strategy: string | AgentStrategy): Promise<PlayTurnResult> {
    const actorAddress = this.address
    if (!actorAddress) {
      throw new Error('A signer is required for autoplay')
    }

    const snapshot = await this.getMatch(matchId, actorAddress)
    if (!snapshot) {
      throw new Error(`Match #${matchId} not found`)
    }

    const legalActions = buildLegalActions(snapshot, actorAddress)
    if (legalActions.length === 0) {
      return {
        action: null,
        snapshot,
        txHash: null,
        dryRun: false,
      }
    }

    const choose = resolveStrategy(strategy)
    const action = choose({
      actorAddress,
      matchId,
      snapshot,
      legalActions,
      random: Math.random,
    })

    const result = await this.submitAction(matchId, action)
    return {
      action,
      snapshot: result.snapshot,
      txHash: result.txHash,
      dryRun: result.dryRun,
    }
  }

  async playMatch(
    matchId: number,
    strategy: string | AgentStrategy,
    options: PlayMatchOptions = {},
  ): Promise<PlayMatchResult> {
    const pollIntervalMs = options.pollIntervalMs ?? 1000
    const maxActions = options.maxActions ?? 200
    const maxIdlePolls = options.maxIdlePolls ?? 600
    const actions: SubmittedActionResult[] = []

    let idlePolls = 0
    while (actions.length < maxActions && idlePolls < maxIdlePolls) {
      const turn = await this.playTurn(matchId, strategy)
      if (turn.snapshot?.phase === 'GAME_OVER') {
        return { actions, finalSnapshot: turn.snapshot }
      }

      if (!turn.action) {
        idlePolls += 1
        await sleep(pollIntervalMs)
        continue
      }

      idlePolls = 0
      actions.push({
        action: turn.action,
        dryRun: turn.dryRun,
        txHash: turn.txHash,
        snapshot: turn.snapshot,
        version: versionSnapshot(turn.snapshot),
      })
    }

    return {
      actions,
      finalSnapshot: await this.getMatch(matchId),
    }
  }

  async selfPlay(options: SelfPlayOptions = {}): Promise<SelfPlayResult> {
    const strategyA = options.strategyA ?? 'balanced'
    const strategyB = options.strategyB ?? 'balanced'
    const burnerA = options.burnerA ?? 0
    const burnerB = options.burnerB ?? 1

    const clientA = await createAgentClient({
      ...this.state.config,
      signer: { mode: 'katana-burner', burnerIndex: burnerA },
      policy: this.state.policy,
    })
    const clientB = await createAgentClient({
      ...this.state.config,
      signer: { mode: 'katana-burner', burnerIndex: burnerB },
      policy: this.state.policy,
    })

    try {
      const created = await clientA.createMatch()
      if (!created.matchId) {
        return { matchId: null, turns: 0, finalSnapshot: null }
      }

      await clientB.joinMatch(created.matchId)
      let snapshot = await clientA.getMatch(created.matchId)
      let turns = 0

      while (snapshot && snapshot.phase !== 'GAME_OVER' && turns < (options.maxActions ?? 200)) {
        const active = snapshot.currentPlayer === 0 ? clientA : clientB
        const strategy = snapshot.currentPlayer === 0 ? strategyA : strategyB
        await active.playTurn(snapshot.gameId, strategy)
        snapshot = await active.getMatch(snapshot.gameId)
        turns += 1
      }

      return {
        matchId: created.matchId,
        turns,
        finalSnapshot: snapshot,
      }
    } finally {
      clientA.close()
      clientB.close()
    }
  }

  close() {
    this.state.toriiClient.free()
  }
}

export function getSnapshotVersion(snapshot: GameSnapshot | null) {
  return versionSnapshot(snapshot)
}

export function formatAgentAction(action: AgentAction): string {
  switch (action.kind) {
    case 'create_game':
      return 'create_match'
    case 'join_game':
      return `join_match #${action.gameId}`
    case 'play_card':
      return `play_card pos ${action.position}`
    case 'discard_card':
      return `discard_card pos ${action.position}`
    case 'invoke_hero':
      return `invoke_hero slot ${action.slot}`
    case 'choose_system_bonus':
      return `choose_system_bonus ${action.symbol}`
    case 'next_age':
      return 'next_age'
  }
}

export function getExplorerUrl(txHash: string | null): string | null {
  return txHash ? getTransactionExplorerUrl(txHash) : null
}

export async function createAgentClient(options: AgentClientOptions = {}): Promise<BlocDuelAgent> {
  const config = resolveDojoConfig(options)
  const runtime = await createBlocDuelRuntime(config)
  const signer = options.signer ? await resolveAgentSigner(config.rpcUrl, options.signer) : null

  return new BlocDuelAgentClient({
    account: signer?.account ?? null,
    address: signer?.address ?? null,
    config,
    policy: options.policy ?? null,
    rpcProvider: runtime.dojoProvider.provider,
    toriiClient: runtime.toriiClient,
    world: runtime.world,
  })
}
