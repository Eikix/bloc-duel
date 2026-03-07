import { create } from 'zustand'
import { CairoCustomEnum } from 'starknet'
import type { AccountInterface, RpcProvider } from 'starknet'
import type { Card, ResourceCost } from '../game/cards'
import type { SystemSymbol } from '../game/systems'
import { isAvailable, type PyramidNode } from '../game/pyramid'
import type { BlocDuelWorld } from '../dojo/client'
import type {
  AvailableHero,
  GamePhase,
  GameSnapshot,
  GameSummary,
  PlayerView,
  WinCondition,
} from '../dojo/torii'

export type Faction = 'ATLANTIC' | 'CONTINENTAL'
export type Player = PlayerView

interface RuntimeContext {
  account: AccountInterface
  rpcProvider: RpcProvider
  world: BlocDuelWorld
  refreshGames: () => Promise<void>
  refreshGame: (gameId?: number | null) => Promise<void>
  discoverCreatedGame: (knownGameIds: Set<number>) => Promise<number | null>
}

interface GameState {
  games: GameSummary[]
  selectedGameId: number | null
  walletAddress: string | null
  localPlayerIndex: 0 | 1 | null
  isCurrentUserTurn: boolean
  isLoadingGames: boolean
  isLoadingGame: boolean
  isSubmitting: boolean
  error: string | null
  runtime: RuntimeContext | null
  players: [Player, Player]
  currentPlayer: 0 | 1
  age: 1 | 2 | 3
  agiTrack: [number, number]
  escalationTrack: number
  pyramid: PyramidNode[]
  phase: GamePhase
  selectedCard: number | null
  availableHeroes: AvailableHero[]
  heroPickerOpen: boolean
  systemBonusChoice: { playerIndex: 0 | 1; options: SystemSymbol[] } | null
  winner: 0 | 1 | 'tie' | null
  winCondition: WinCondition

  syncGames: (games: GameSummary[]) => void
  syncSnapshot: (snapshot: GameSnapshot | null) => void
  setRuntime: (runtime: RuntimeContext | null) => void
  setWalletAddress: (walletAddress: string | null) => void
  setSelectedGameId: (gameId: number | null) => void
  setLoadingGames: (isLoading: boolean) => void
  setLoadingGame: (isLoading: boolean) => void
  clearError: () => void

  createGame: () => Promise<void>
  joinGame: (gameId: number) => Promise<void>
  selectCard: (position: number) => void
  playCard: () => Promise<void>
  discardCard: () => Promise<void>
  playCardAt: (position: number) => Promise<void>
  discardCardAt: (position: number) => Promise<void>
  invokeHero: (heroSlot: 0 | 1 | 2) => Promise<void>
  toggleHeroPicker: () => void
  chooseSystemBonus: (symbol: SystemSymbol) => Promise<void>
  nextAge: () => Promise<void>
}

function emptyPlayer(playerIndex: 0 | 1): Player {
  return {
    name: playerIndex === 0 ? 'Atlantic Bloc' : 'Continental Bloc',
    faction: playerIndex === 0 ? 'ATLANTIC' : 'CONTINENTAL',
    address: '0x0',
    capital: 0,
    production: { energy: 0, materials: 0, compute: 0 },
    systems: [],
    activeSystemBonuses: [],
    madeSystemChoice: false,
    heroCount: 0,
    playedCards: [],
  }
}

function emptyPlayers(): [Player, Player] {
  return [emptyPlayer(0), emptyPlayer(1)]
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Transaction failed'
}

async function waitForTransaction(rpcProvider: RpcProvider, transactionHash: string) {
  try {
    await rpcProvider.waitForTransaction(transactionHash)
  } catch {
    await new Promise((resolve) => window.setTimeout(resolve, 1500))
  }
}

async function runMutation(
  set: (partial: Partial<GameState>) => void,
  task: () => Promise<void>,
) {
  set({ isSubmitting: true, error: null })

  try {
    await task()
  } catch (error) {
    set({ error: extractErrorMessage(error) })
  } finally {
    set({ isSubmitting: false })
  }
}

function requireRuntime(state: GameState): RuntimeContext {
  if (!state.runtime) {
    throw new Error('Connect a Starknet wallet first')
  }

  return state.runtime
}

function requireSelectedGameId(state: GameState): number {
  if (state.selectedGameId === null) {
    throw new Error('Select a game first')
  }

  return state.selectedGameId
}

function toCairoSystemSymbol(symbol: SystemSymbol): CairoCustomEnum {
  return new CairoCustomEnum({
    None: undefined,
    Compute: symbol === 'COMPUTE' ? '' : undefined,
    Finance: symbol === 'FINANCE' ? '' : undefined,
    Cyber: symbol === 'CYBER' ? '' : undefined,
    Diplomacy: symbol === 'DIPLOMACY' ? '' : undefined,
  })
}

function getDraftNode(pyramid: PyramidNode[], position: number): { index: number; node: PyramidNode } | null {
  const index = pyramid.findIndex((node) => node.position === position)
  if (index === -1) return null

  const node = pyramid[index]
  if (node.taken || !isAvailable(position, pyramid)) return null

  return { index, node }
}

export function canAfford(
  player: Pick<Player, 'capital' | 'production'>,
  cost: ResourceCost,
  extraCapital: number = 0,
): boolean {
  const energyNeeded = Math.max(0, (cost.energy ?? 0) - player.production.energy)
  const materialsNeeded = Math.max(0, (cost.materials ?? 0) - player.production.materials)
  const computeNeeded = Math.max(0, (cost.compute ?? 0) - player.production.compute)
  return player.capital >= energyNeeded + materialsNeeded + computeNeeded + extraCapital
}

export function getEffectiveCost(card: Card): ResourceCost {
  return card.cost
}

export function getSellValue(age: 1 | 2 | 3): number {
  return age
}

export const useGameStore = create<GameState>((set, get) => ({
  games: [],
  selectedGameId: null,
  walletAddress: null,
  localPlayerIndex: null,
  isCurrentUserTurn: false,
  isLoadingGames: false,
  isLoadingGame: false,
  isSubmitting: false,
  error: null,
  runtime: null,
  players: emptyPlayers(),
  currentPlayer: 0,
  age: 1,
  agiTrack: [0, 0],
  escalationTrack: 0,
  pyramid: [],
  phase: 'LOBBY',
  selectedCard: null,
  availableHeroes: [],
  heroPickerOpen: false,
  systemBonusChoice: null,
  winner: null,
  winCondition: 'None',

  syncGames: (games) => {
    set({ games })
  },

  syncSnapshot: (snapshot) => {
    if (!snapshot) {
      set({
        players: emptyPlayers(),
        currentPlayer: 0,
        age: 1,
        agiTrack: [0, 0],
        escalationTrack: 0,
        pyramid: [],
        phase: 'LOBBY',
        selectedCard: null,
        availableHeroes: [],
        heroPickerOpen: false,
        systemBonusChoice: null,
        localPlayerIndex: null,
        isCurrentUserTurn: false,
        winner: null,
        winCondition: 'None',
      })
      return
    }

    const previousSelectedCard = get().selectedCard
    const selectedNode = previousSelectedCard === null
      ? null
      : getDraftNode(snapshot.pyramid, previousSelectedCard)

    set({
      players: snapshot.players,
      currentPlayer: snapshot.currentPlayer,
      age: snapshot.age,
      agiTrack: snapshot.agiTrack,
      escalationTrack: snapshot.escalationTrack,
      pyramid: snapshot.pyramid,
      phase: snapshot.phase,
      selectedCard: selectedNode ? previousSelectedCard : null,
      availableHeroes: snapshot.availableHeroes,
      heroPickerOpen:
        snapshot.phase === 'DRAFTING' && snapshot.localPlayerIndex === snapshot.currentPlayer
          ? get().heroPickerOpen
          : false,
      systemBonusChoice: snapshot.systemBonusChoice,
      localPlayerIndex: snapshot.localPlayerIndex,
      isCurrentUserTurn: snapshot.localPlayerIndex !== null && snapshot.localPlayerIndex === snapshot.currentPlayer,
      winner: snapshot.winner,
      winCondition: snapshot.winCondition,
    })
  },

  setRuntime: (runtime) => {
    set({ runtime })
  },

  setWalletAddress: (walletAddress) => {
    set({ walletAddress })
  },

  setSelectedGameId: (gameId) => {
    set({
      selectedGameId: gameId,
      selectedCard: null,
      heroPickerOpen: false,
      error: null,
    })
  },

  setLoadingGames: (isLoadingGames) => {
    set({ isLoadingGames })
  },

  setLoadingGame: (isLoadingGame) => {
    set({ isLoadingGame })
  },

  clearError: () => {
    set({ error: null })
  },

  createGame: async () => {
    await runMutation(set, async () => {
      const state = get()
      const runtime = requireRuntime(state)
      const knownGameIds = new Set(state.games.map((game) => game.gameId))
      const result = await runtime.world.actions.createGame(runtime.account)
      await waitForTransaction(runtime.rpcProvider, result.transaction_hash)
      await runtime.refreshGames()
      const createdGameId = await runtime.discoverCreatedGame(knownGameIds)
      if (createdGameId !== null) {
        get().setSelectedGameId(createdGameId)
      }
    })
  },

  joinGame: async (gameId) => {
    await runMutation(set, async () => {
      const state = get()
      const runtime = requireRuntime(state)
      const result = await runtime.world.actions.joinGame(runtime.account, gameId)
      await waitForTransaction(runtime.rpcProvider, result.transaction_hash)
      get().setSelectedGameId(gameId)
      await runtime.refreshGames()
      await runtime.refreshGame(gameId)
    })
  },

  selectCard: (position) => {
    const state = get()
    if (state.phase !== 'DRAFTING' || state.systemBonusChoice || !state.isCurrentUserTurn) return
    if (!getDraftNode(state.pyramid, position)) return

    set({ selectedCard: state.selectedCard === position ? null : position })
  },

  playCard: async () => {
    const { selectedCard } = get()
    if (selectedCard === null) return
    await get().playCardAt(selectedCard)
  },

  discardCard: async () => {
    const { selectedCard } = get()
    if (selectedCard === null) return
    await get().discardCardAt(selectedCard)
  },

  playCardAt: async (position) => {
    await runMutation(set, async () => {
      const state = get()
      const runtime = requireRuntime(state)
      const gameId = requireSelectedGameId(state)
      if (state.phase !== 'DRAFTING' || state.systemBonusChoice || !state.isCurrentUserTurn) return
      if (!getDraftNode(state.pyramid, position)) return

      const result = await runtime.world.actions.playCard(runtime.account, gameId, position)
      await waitForTransaction(runtime.rpcProvider, result.transaction_hash)
      set({ selectedCard: null })
      await runtime.refreshGame(gameId)
      await runtime.refreshGames()
    })
  },

  discardCardAt: async (position) => {
    await runMutation(set, async () => {
      const state = get()
      const runtime = requireRuntime(state)
      const gameId = requireSelectedGameId(state)
      if (state.phase !== 'DRAFTING' || state.systemBonusChoice || !state.isCurrentUserTurn) return
      if (!getDraftNode(state.pyramid, position)) return

      const result = await runtime.world.actions.discardCard(runtime.account, gameId, position)
      await waitForTransaction(runtime.rpcProvider, result.transaction_hash)
      set({ selectedCard: null })
      await runtime.refreshGame(gameId)
      await runtime.refreshGames()
    })
  },

  invokeHero: async (heroSlot) => {
    await runMutation(set, async () => {
      const state = get()
      const runtime = requireRuntime(state)
      const gameId = requireSelectedGameId(state)
      if (state.phase !== 'DRAFTING' || state.systemBonusChoice || !state.isCurrentUserTurn) return

      const result = await runtime.world.actions.invokeHero(runtime.account, gameId, heroSlot)
      await waitForTransaction(runtime.rpcProvider, result.transaction_hash)
      set({ heroPickerOpen: false, selectedCard: null })
      await runtime.refreshGame(gameId)
      await runtime.refreshGames()
    })
  },

  toggleHeroPicker: () => {
    const state = get()
    if (state.phase !== 'DRAFTING' || !state.isCurrentUserTurn || state.availableHeroes.length === 0) return
    set({ heroPickerOpen: !state.heroPickerOpen })
  },

  chooseSystemBonus: async (symbol) => {
    await runMutation(set, async () => {
      const state = get()
      const runtime = requireRuntime(state)
      const gameId = requireSelectedGameId(state)
      if (!state.systemBonusChoice || !state.isCurrentUserTurn) return

      const result = await runtime.world.actions.chooseSystemBonus(
        runtime.account,
        gameId,
        toCairoSystemSymbol(symbol),
      )

      await waitForTransaction(runtime.rpcProvider, result.transaction_hash)
      await runtime.refreshGame(gameId)
      await runtime.refreshGames()
    })
  },

  nextAge: async () => {
    await runMutation(set, async () => {
      const state = get()
      const runtime = requireRuntime(state)
      const gameId = requireSelectedGameId(state)
      if (state.phase !== 'AGE_TRANSITION') return

      const result = await runtime.world.actions.nextAge(runtime.account, gameId)
      await waitForTransaction(runtime.rpcProvider, result.transaction_hash)
      await runtime.refreshGame(gameId)
      await runtime.refreshGames()
    })
  },
}))
