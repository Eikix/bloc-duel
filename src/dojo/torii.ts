import type { Clause, Entity, Query, Subscription, Ty, ToriiClient } from '@dojoengine/torii-client'
import { getCardById, getCardIdsFromMask } from '../game/cards'
import type { Card } from '../game/cards'
import { getHeroById } from '../game/heroes'
import type { Hero } from '../game/heroes'
import { type SystemSymbol } from '../game/systems'
import { buildPyramid, type PyramidNode } from '../game/pyramid'
import { getDojoConfig, getNamespacedModelTag, MODEL_TAGS } from './config'

export type Faction = 'ATLANTIC' | 'CONTINENTAL'
export type GamePhase = 'LOBBY' | 'DRAFTING' | 'AGE_TRANSITION' | 'GAME_OVER'
export type WinCondition = 'None' | 'AgiBreakthrough' | 'EscalationDominance' | 'SystemsDominance' | 'Points'

export interface Production {
  energy: number
  materials: number
  compute: number
}

export interface PlayerView {
  name: string
  faction: Faction
  address: string
  capital: number
  production: Production
  systems: SystemSymbol[]
  activeSystemBonuses: SystemSymbol[]
  madeSystemChoice: boolean
  heroCount: number
  playedCards: number[]
}

export interface AvailableHero extends Hero {
  slot: 0 | 1 | 2
}

export interface GameSummary {
  gameId: number
  phase: GamePhase
  playerOne: string
  playerTwo: string
  updatedAt: number
  createdAt: number
}

export interface GameSnapshot {
  gameId: number
  players: [PlayerView, PlayerView]
  currentPlayer: 0 | 1
  localPlayerIndex: 0 | 1 | null
  age: 1 | 2 | 3
  agiTrack: [number, number]
  escalationTrack: number
  phase: GamePhase
  pyramid: PyramidNode[]
  availableHeroes: AvailableHero[]
  systemBonusChoice: { playerIndex: 0 | 1; options: SystemSymbol[] } | null
  winner: 0 | 1 | 'tie' | null
  winCondition: WinCondition
}

interface RawGameModel {
  game_id: number | string
  player_one: string
  player_two: string
  current_player: number | string
  age: number | string
  phase: string
  agi_one: number | string
  agi_two: number | string
  escalation: number | string
  winner: number | string
  win_condition: string
}

interface RawPlayerStateModel {
  player_index: number | string
  address: string
  capital: number | string
  energy_prod: number | string
  materials_prod: number | string
  compute_prod: number | string
  compute_count: number | string
  finance_count: number | string
  cyber_count: number | string
  diplomacy_count: number | string
  compute_bonus: boolean
  finance_bonus: boolean
  cyber_bonus: boolean
  diplomacy_bonus: boolean
  made_system_choice: boolean
  hero_count: number | string
  played_cards: number | string
}

interface RawPyramidModel {
  taken_mask: number | string
  slot_0: number | string
  slot_1: number | string
  slot_2: number | string
  slot_3: number | string
  slot_4: number | string
  slot_5: number | string
  slot_6: number | string
  slot_7: number | string
  slot_8: number | string
  slot_9: number | string
}

interface RawHeroPoolModel {
  hero_0: number | string
  hero_1: number | string
  hero_2: number | string
  hero_0_taken: boolean
  hero_1_taken: boolean
  hero_2_taken: boolean
}

interface RawPendingChoiceModel {
  active: boolean
  player_index: number | string
  option_count: number | string
  option_0: string
  option_1: string
  option_2: string
  option_3: string
}

const ZERO_ADDRESS = '0x0'

function toNumber(value: number | string | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

export function normalizeAddress(address: string | undefined): string {
  if (!address) return ZERO_ADDRESS
  const normalized = address.toLowerCase()
  if (!normalized.startsWith('0x')) return ZERO_ADDRESS
  const body = normalized.slice(2).replace(/^0+/, '')
  return body.length > 0 ? `0x${body}` : ZERO_ADDRESS
}

export function isZeroAddress(address: string | undefined): boolean {
  return normalizeAddress(address) === ZERO_ADDRESS
}

export function shortAddress(address: string | undefined): string {
  const normalized = normalizeAddress(address)
  if (normalized === ZERO_ADDRESS) return 'unassigned'
  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`
}

function parsePrimitiveTy(ty: Ty): unknown {
  if (ty.type === 'enum' && ty.value && typeof ty.value === 'object' && 'option' in ty.value) {
    return ty.value.option
  }

  if (ty.type === 'struct' && ty.value && typeof ty.value === 'object' && !Array.isArray(ty.value)) {
    return Object.fromEntries(
      Object.entries(ty.value as Record<string, Ty>).map(([key, nested]) => [key, parsePrimitiveTy(nested)]),
    )
  }

  if (ty.type === 'array' || ty.type === 'tuple') {
    const items = Array.isArray(ty.value) ? ty.value : []
    return items.map((item) => parsePrimitiveTy(item))
  }

  if (ty.type === 'fixed_size_array' && ty.value && typeof ty.value === 'object' && 'array' in ty.value) {
    const items = ty.value.array as Ty[]
    return items.map((item) => parsePrimitiveTy(item))
  }

  return ty.value
}

function parseEntityModel<T>(entity: Entity, tag: string): T | null {
  const model = entity.models[tag]
  if (!model) return null

  return Object.fromEntries(
    Object.entries(model).map(([key, value]) => [key, parsePrimitiveTy(value)]),
  ) as T
}

function collectModels<T>(entities: Entity[], tag: string): T[] {
  return entities
    .map((entity) => parseEntityModel<T>(entity, tag))
    .filter((value): value is T => value !== null)
}

function toGamePhase(phase: string): GamePhase {
  switch (phase) {
    case 'Lobby':
      return 'LOBBY'
    case 'Drafting':
      return 'DRAFTING'
    case 'AgeTransition':
      return 'AGE_TRANSITION'
    case 'GameOver':
      return 'GAME_OVER'
    default:
      return 'LOBBY'
  }
}

function toSystemSymbol(value: string): SystemSymbol | null {
  switch (value) {
    case 'Compute':
      return 'COMPUTE'
    case 'Finance':
      return 'FINANCE'
    case 'Cyber':
      return 'CYBER'
    case 'Diplomacy':
      return 'DIPLOMACY'
    default:
      return null
  }
}

function expandSystems(state: RawPlayerStateModel): SystemSymbol[] {
  const systems: SystemSymbol[] = []
  const counts: Array<[string, number]> = [
    ['Compute', toNumber(state.compute_count)],
    ['Finance', toNumber(state.finance_count)],
    ['Cyber', toNumber(state.cyber_count)],
    ['Diplomacy', toNumber(state.diplomacy_count)],
  ]

  for (const [value, count] of counts) {
    const symbol = toSystemSymbol(value)
    if (!symbol) continue
    for (let index = 0; index < count; index += 1) {
      systems.push(symbol)
    }
  }

  return systems
}

function extractBonuses(state: RawPlayerStateModel): SystemSymbol[] {
  const bonuses: SystemSymbol[] = []
  if (state.compute_bonus) bonuses.push('COMPUTE')
  if (state.finance_bonus) bonuses.push('FINANCE')
  if (state.cyber_bonus) bonuses.push('CYBER')
  if (state.diplomacy_bonus) bonuses.push('DIPLOMACY')
  return bonuses
}

function toPlayerView(playerIndex: 0 | 1, state?: RawPlayerStateModel): PlayerView {
  const faction: Faction = playerIndex === 0 ? 'ATLANTIC' : 'CONTINENTAL'

  if (!state) {
    return {
      name: playerIndex === 0 ? 'Atlantic Bloc' : 'Continental Bloc',
      faction,
      address: ZERO_ADDRESS,
      capital: 0,
      production: { energy: 0, materials: 0, compute: 0 },
      systems: [],
      activeSystemBonuses: [],
      madeSystemChoice: false,
      heroCount: 0,
      playedCards: [],
    }
  }

  return {
    name: playerIndex === 0 ? 'Atlantic Bloc' : 'Continental Bloc',
    faction,
    address: normalizeAddress(state.address),
    capital: toNumber(state.capital),
    production: {
      energy: toNumber(state.energy_prod),
      materials: toNumber(state.materials_prod),
      compute: toNumber(state.compute_prod),
    },
    systems: expandSystems(state),
    activeSystemBonuses: extractBonuses(state),
    madeSystemChoice: state.made_system_choice,
    heroCount: toNumber(state.hero_count),
    playedCards: getCardIdsFromMask(toNumber(state.played_cards)),
  }
}

function buildPyramidNodes(raw?: RawPyramidModel, phase?: GamePhase): PyramidNode[] {
  if (!raw || phase === 'LOBBY') return []

  const cards: Card[] = [
    getCardById(toNumber(raw.slot_0)),
    getCardById(toNumber(raw.slot_1)),
    getCardById(toNumber(raw.slot_2)),
    getCardById(toNumber(raw.slot_3)),
    getCardById(toNumber(raw.slot_4)),
    getCardById(toNumber(raw.slot_5)),
    getCardById(toNumber(raw.slot_6)),
    getCardById(toNumber(raw.slot_7)),
    getCardById(toNumber(raw.slot_8)),
    getCardById(toNumber(raw.slot_9)),
  ]
  const takenMask = toNumber(raw.taken_mask)

  return buildPyramid(cards).map((node) => ({
    ...node,
    taken: ((takenMask >> node.position) & 1) === 1,
  }))
}

function buildAvailableHeroes(raw?: RawHeroPoolModel, phase?: GamePhase): AvailableHero[] {
  if (!raw || phase === 'LOBBY') return []

  const slots: Array<{ slot: 0 | 1 | 2; id: number; taken: boolean }> = [
    { slot: 0, id: toNumber(raw.hero_0), taken: raw.hero_0_taken },
    { slot: 1, id: toNumber(raw.hero_1), taken: raw.hero_1_taken },
    { slot: 2, id: toNumber(raw.hero_2), taken: raw.hero_2_taken },
  ]

  return slots
    .filter((entry) => !entry.taken)
    .map((entry) => ({
      ...getHeroById(entry.id),
      slot: entry.slot,
    }))
}

function buildPendingChoice(raw?: RawPendingChoiceModel): GameSnapshot['systemBonusChoice'] {
  if (!raw || !raw.active) return null

  const options = [raw.option_0, raw.option_1, raw.option_2, raw.option_3]
    .slice(0, toNumber(raw.option_count))
    .map((value) => toSystemSymbol(value))
    .filter((value): value is SystemSymbol => value !== null)

  return {
    playerIndex: toNumber(raw.player_index) === 0 ? 0 : 1,
    options,
  }
}

function getWinner(raw: RawGameModel): GameSnapshot['winner'] {
  const winner = toNumber(raw.winner)
  if (winner === 1) return 0
  if (winner === 2) return 1
  if (winner === 3) return 'tie'
  return null
}

function basePagination(limit: number): Query['pagination'] {
  return {
    limit,
    cursor: undefined,
    direction: 'Forward',
    order_by: [],
  }
}

function gamesClause(): Clause {
  return {
    Keys: {
      keys: [],
      pattern_matching: 'VariableLen',
      models: [getNamespacedModelTag(MODEL_TAGS.game)],
    },
  }
}

function selectedGameClause(gameId: number): Clause {
  const tags = [
    MODEL_TAGS.game,
    MODEL_TAGS.playerState,
    MODEL_TAGS.pyramid,
    MODEL_TAGS.heroPool,
    MODEL_TAGS.pendingChoice,
  ]

  return {
    Composite: {
      operator: 'Or',
      clauses: tags.map((tag) => ({
        Keys: {
          keys: [String(gameId)],
          pattern_matching: 'VariableLen',
          models: [getNamespacedModelTag(tag)],
        },
      })),
    },
  }
}

export async function fetchGameSummaries(toriiClient: ToriiClient): Promise<GameSummary[]> {
  const { worldAddress } = getDojoConfig()
  const gameTag = getNamespacedModelTag(MODEL_TAGS.game)
  const response = await toriiClient.getEntities({
    world_addresses: [worldAddress],
    models: [gameTag],
    clause: gamesClause(),
    no_hashed_keys: false,
    historical: false,
    pagination: basePagination(200),
  })

  return response.items
    .map((entity) => {
      const game = parseEntityModel<RawGameModel>(entity, gameTag)
      if (!game) return null

      return {
        gameId: toNumber(game.game_id),
        phase: toGamePhase(game.phase),
        playerOne: normalizeAddress(game.player_one),
        playerTwo: normalizeAddress(game.player_two),
        updatedAt: entity.updated_at,
        createdAt: entity.created_at,
      } satisfies GameSummary
    })
    .filter((game): game is GameSummary => game !== null)
    .sort((left, right) => right.updatedAt - left.updatedAt)
}

export async function fetchGameSnapshot(
  toriiClient: ToriiClient,
  gameId: number,
  walletAddress?: string,
): Promise<GameSnapshot | null> {
  const { worldAddress } = getDojoConfig()
  const response = await toriiClient.getEntities({
    world_addresses: [worldAddress],
    models: [
      getNamespacedModelTag(MODEL_TAGS.game),
      getNamespacedModelTag(MODEL_TAGS.playerState),
      getNamespacedModelTag(MODEL_TAGS.pyramid),
      getNamespacedModelTag(MODEL_TAGS.heroPool),
      getNamespacedModelTag(MODEL_TAGS.pendingChoice),
    ],
    clause: selectedGameClause(gameId),
    no_hashed_keys: false,
    historical: false,
    pagination: basePagination(50),
  })

  const game = collectModels<RawGameModel>(response.items, getNamespacedModelTag(MODEL_TAGS.game))[0]
  if (!game) return null

  const playerStates = collectModels<RawPlayerStateModel>(response.items, getNamespacedModelTag(MODEL_TAGS.playerState))
  const pyramid = collectModels<RawPyramidModel>(response.items, getNamespacedModelTag(MODEL_TAGS.pyramid))[0]
  const heroPool = collectModels<RawHeroPoolModel>(response.items, getNamespacedModelTag(MODEL_TAGS.heroPool))[0]
  const pendingChoice = collectModels<RawPendingChoiceModel>(response.items, getNamespacedModelTag(MODEL_TAGS.pendingChoice))[0]

  const p0State = playerStates.find((state) => toNumber(state.player_index) === 0)
  const p1State = playerStates.find((state) => toNumber(state.player_index) === 1)
  const players: [PlayerView, PlayerView] = [toPlayerView(0, p0State), toPlayerView(1, p1State)]
  const normalizedWallet = normalizeAddress(walletAddress)
  const localPlayerIndex =
    normalizedWallet !== ZERO_ADDRESS && players[0].address === normalizedWallet
      ? 0
      : normalizedWallet !== ZERO_ADDRESS && players[1].address === normalizedWallet
        ? 1
        : null

  return {
    gameId: toNumber(game.game_id),
    players,
    currentPlayer: toNumber(game.current_player) === 0 ? 0 : 1,
    localPlayerIndex,
    age: Math.max(1, Math.min(3, toNumber(game.age))) as 1 | 2 | 3,
    agiTrack: [toNumber(game.agi_one), toNumber(game.agi_two)],
    escalationTrack: toNumber(game.escalation) - 6,
    phase: toGamePhase(game.phase),
    pyramid: buildPyramidNodes(pyramid, toGamePhase(game.phase)),
    availableHeroes: buildAvailableHeroes(heroPool, toGamePhase(game.phase)),
    systemBonusChoice: buildPendingChoice(pendingChoice),
    winner: getWinner(game),
    winCondition: (game.win_condition as WinCondition) ?? 'None',
  }
}

export async function waitForCreatedGame(
  toriiClient: ToriiClient,
  knownGameIds: Set<number>,
  walletAddress: string,
  attempts: number = 20,
): Promise<number | null> {
  const normalizedWallet = normalizeAddress(walletAddress)

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const games = await fetchGameSummaries(toriiClient)
    const created = games.find(
      (game) => !knownGameIds.has(game.gameId) && normalizeAddress(game.playerOne) === normalizedWallet,
    )

    if (created) return created.gameId

    await new Promise((resolve) => window.setTimeout(resolve, 500))
  }

  return null
}

export async function subscribeToGames(
  toriiClient: ToriiClient,
  onUpdate: () => void | Promise<void>,
): Promise<Subscription> {
  const { worldAddress } = getDojoConfig()
  return toriiClient.onEntityUpdated(gamesClause(), [worldAddress], onUpdate)
}

export async function subscribeToGame(
  toriiClient: ToriiClient,
  gameId: number,
  onUpdate: () => void | Promise<void>,
): Promise<Subscription> {
  const { worldAddress } = getDojoConfig()
  return toriiClient.onEntityUpdated(selectedGameClause(gameId), [worldAddress], onUpdate)
}
