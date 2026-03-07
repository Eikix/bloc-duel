import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core'
import AGITrack from '../components/AGITrack'
import CardPyramid from '../components/CardPyramid'
import CardZoom from '../components/CardZoom'
import DiscardZone from '../components/DiscardZone'
import EscalationTrack from '../components/EscalationTrack'
import HeroPicker from '../components/HeroPicker'
import PlayField from '../components/PlayField'
import PlayerStatsBar from '../components/PlayerStatsBar'
import SystemBonusChoice from '../components/SystemBonusChoice'
import { resolveKatanaAccount } from '../dojo/burner'
import { createBlocDuelRuntime, type BlocDuelRuntime } from '../dojo/client'
import { getDojoConfig } from '../dojo/config'
import { useBurnerWallet } from '../providers/burnerWallet'
import {
  fetchGameSnapshot,
  fetchGameSummaries,
  isZeroAddress,
  normalizeAddress,
  shortAddress,
  subscribeToGame,
  subscribeToGames,
  type GamePhase,
  type GameSummary,
  type WinCondition,
  waitForCreatedGame,
} from '../dojo/torii'
import { canAfford, getEffectiveCost, getSellValue, useGameStore } from '../store/gameStore'

const AGE_LABELS = { 1: 'I', 2: 'II', 3: 'III' } as const

const PHASE_LABELS: Record<GamePhase, string> = {
  LOBBY: 'Lobby',
  DRAFTING: 'Drafting',
  AGE_TRANSITION: 'Age Transition',
  GAME_OVER: 'Game Over',
}

const WIN_CONDITION_LABELS: Record<WinCondition, string> = {
  None: 'No result yet',
  AgiBreakthrough: 'AGI Breakthrough',
  EscalationDominance: 'Escalation Dominance',
  SystemsDominance: 'Systems Dominance',
  Points: 'Points Victory',
}

function getInitialGameId(): number | null {
  if (typeof window === 'undefined') return null

  const value = new URLSearchParams(window.location.search).get('game')
  if (!value) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function syncGameIdToUrl(gameId: number | null) {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  if (gameId === null) url.searchParams.delete('game')
  else url.searchParams.set('game', String(gameId))
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function getWinnerLabel(
  winner: 0 | 1 | 'tie' | null,
  players: ReturnType<typeof useGameStore.getState>['players'],
): string {
  if (winner === 0) return players[0].name
  if (winner === 1) return players[1].name
  if (winner === 'tie') return 'Tie Game'
  return 'Pending Result'
}

function isMyGame(game: GameSummary, walletAddress: string | null): boolean {
  if (!walletAddress) return false

  const normalized = normalizeAddress(walletAddress)
  return normalizeAddress(game.playerOne) === normalized || normalizeAddress(game.playerTwo) === normalized
}

function canJoinGame(game: GameSummary, walletAddress: string | null): boolean {
  if (!walletAddress) return false

  return isZeroAddress(game.playerTwo) && normalizeAddress(game.playerOne) !== normalizeAddress(walletAddress)
}

function getBurnerIndexForAddress(address: string, burnerAddresses: string[]): number {
  const normalizedAddress = normalizeAddress(address)
  return burnerAddresses.findIndex((burnerAddress) => normalizeAddress(burnerAddress) === normalizedAddress)
}

export function Game() {
  const [runtime, setRuntimeState] = useState<BlocDuelRuntime | null>(null)
  const [isBootstrappingRuntime, setIsBootstrappingRuntime] = useState(true)
  const { walletMode } = getDojoConfig()
  const { burnerAddresses, burnerIndex, switchBurner } = useBurnerWallet()
  const { account, address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect, isPending: isDisconnecting } = useDisconnect()
  const [joinGameId, setJoinGameId] = useState('')
  const initialSelectionApplied = useRef(false)

  const {
    games,
    selectedGameId,
    localPlayerIndex,
    isCurrentUserTurn,
    players,
    currentPlayer,
    phase,
    age,
    selectedCard,
    pyramid,
    systemBonusChoice,
    isLoadingGames,
    isLoadingGame,
    isSubmitting,
    error,
    winner,
    winCondition,
    createGame,
    joinGame,
    playCard,
    discardCard,
    playCardAt,
    discardCardAt,
    chooseSystemBonus,
    nextAge,
    setRuntime,
    setWalletAddress,
    setSelectedGameId,
    setLoadingGames,
    setLoadingGame,
    syncGames,
    syncSnapshot,
    clearError,
  } = useGameStore()

  const refreshGames = useCallback(async () => {
    if (!runtime) return

    setLoadingGames(true)

    try {
      const nextGames = await fetchGameSummaries(runtime.toriiClient)
      syncGames(nextGames)
    } finally {
      setLoadingGames(false)
    }
  }, [runtime, setLoadingGames, syncGames])

  const refreshGame = useCallback(async (gameIdOverride?: number | null) => {
    if (!runtime) return

    const gameId = gameIdOverride ?? selectedGameId
    if (gameId === null) {
      syncSnapshot(null)
      return
    }

    setLoadingGame(true)

    try {
      const snapshot = await fetchGameSnapshot(runtime.toriiClient, gameId, address)
      syncSnapshot(snapshot)
    } finally {
      setLoadingGame(false)
    }
  }, [address, runtime, selectedGameId, setLoadingGame, syncSnapshot])

  const discoverCreatedGame = useCallback(
    async (knownGameIds: Set<number>) => {
      if (!runtime) return null
      return waitForCreatedGame(runtime.toriiClient, knownGameIds, address ?? '0x0')
    },
    [address, runtime],
  )

  useEffect(() => {
    let mounted = true
    let currentRuntime: BlocDuelRuntime | null = null

    void (async () => {
      try {
        const nextRuntime = await createBlocDuelRuntime()
        if (!mounted) {
          nextRuntime.toriiClient.free()
          return
        }

        currentRuntime = nextRuntime
        setRuntimeState(nextRuntime)
      } finally {
        if (mounted) {
          setIsBootstrappingRuntime(false)
        }
      }
    })().catch((error) => {
      console.error('Failed to initialize Dojo runtime', error)
    })

    return () => {
      mounted = false
      currentRuntime?.toriiClient.free()
    }
  }, [])

  useEffect(() => {
    if (initialSelectionApplied.current) return
    initialSelectionApplied.current = true

    const initialGameId = getInitialGameId()
    if (initialGameId !== null) {
      setSelectedGameId(initialGameId)
    }
  }, [setSelectedGameId])

  useEffect(() => {
    syncGameIdToUrl(selectedGameId)
  }, [selectedGameId])

  useEffect(() => {
    let mounted = true

    setWalletAddress(address ?? null)

    if (!runtime) {
      setRuntime(null)
      return () => {
        mounted = false
      }
    }

    if (walletMode === 'burner') {
      if (!address) {
        setRuntime(null)
        return () => {
          mounted = false
        }
      }

      void (async () => {
        try {
          const burnerAccount = await resolveKatanaAccount(runtime.config.rpcUrl, address)
          if (!mounted) return

          setRuntime({
            account: burnerAccount,
            rpcProvider: runtime.dojoProvider.provider,
            world: runtime.world,
            refreshGames,
            refreshGame,
            discoverCreatedGame,
          })
        } catch (error) {
          if (!mounted) return
          console.error('Failed to resolve Katana burner account', error)
          setRuntime(null)
        }
      })()

      return () => {
        mounted = false
      }
    }

    if (!account) {
      setRuntime(null)
      return () => {
        mounted = false
      }
    }

    setRuntime({
      account,
      rpcProvider: runtime.dojoProvider.provider,
      world: runtime.world,
      refreshGames,
      refreshGame,
      discoverCreatedGame,
    })

    return () => {
      mounted = false
    }
  }, [account, address, discoverCreatedGame, refreshGame, refreshGames, runtime, setRuntime, setWalletAddress, walletMode])

  useEffect(() => {
    if (!runtime) return

    void refreshGames()

    let subscriptionCancelled = false
    let subscription: Awaited<ReturnType<typeof subscribeToGames>> | undefined

    void (async () => {
      subscription = await subscribeToGames(runtime.toriiClient, () => {
        if (!subscriptionCancelled) {
          void refreshGames()
        }
      })
    })()

    return () => {
      subscriptionCancelled = true
      subscription?.cancel()
    }
  }, [refreshGames, runtime])

  useEffect(() => {
    if (!runtime) return

    if (selectedGameId === null) {
      syncSnapshot(null)
      return
    }

    syncSnapshot(null)
    void refreshGame(selectedGameId)

    let subscriptionCancelled = false
    let subscription: Awaited<ReturnType<typeof subscribeToGame>> | undefined

    void (async () => {
      subscription = await subscribeToGame(runtime.toriiClient, selectedGameId, () => {
        if (!subscriptionCancelled) {
          void refreshGame(selectedGameId)
        }
      })
    })()

    return () => {
      subscriptionCancelled = true
      subscription?.cancel()
    }
  }, [refreshGame, runtime, selectedGameId, syncSnapshot])

  const bottomPlayer = localPlayerIndex ?? currentPlayer
  const topPlayer: 0 | 1 = bottomPlayer === 0 ? 1 : 0

  const playFieldRef = useRef<HTMLDivElement>(null)
  const discardRef = useRef<HTMLDivElement>(null)
  const [activeDragZone, setActiveDragZone] = useState<'play' | 'discard' | null>(null)
  const dropRefs = { playField: playFieldRef, discard: discardRef }

  const current = players[currentPlayer]
  const currentPlayerAddress = current.address
  const selectedNode = selectedCard !== null ? pyramid.find((node) => node.position === selectedCard) ?? null : null
  const isFreeViaChain = selectedNode?.card.chainFrom !== undefined
    ? current.playedCards.includes(selectedNode.card.chainFrom)
    : false
  const selectedEffectiveCost = selectedNode ? getEffectiveCost(selectedNode.card) : undefined
  const canAffordCard = selectedNode ? isFreeViaChain || canAfford(current, selectedEffectiveCost ?? {}) : false
  const sellValue = getSellValue(age)
  const winnerLabel = getWinnerLabel(winner, players)
  const myGames = games.filter((game) => isMyGame(game, address ?? null))
  const openLobbies = games.filter((game) => isZeroAddress(game.playerTwo))
  const selectedSummary = games.find((game) => game.gameId === selectedGameId) ?? null
  const runtimeReady = runtime !== null
  const controllerConnector = walletMode === 'controller' ? connectors[0] ?? null : null
  const currentTurnIsLocalWallet = address !== undefined
    && normalizeAddress(address) === normalizeAddress(currentPlayerAddress)
  const currentTurnBurnerIndex = walletMode === 'burner'
    ? getBurnerIndexForAddress(currentPlayerAddress, burnerAddresses)
    : -1
  const currentTurnLabel = selectedGameId === null
    ? null
    : isZeroAddress(currentPlayerAddress)
      ? 'Turn: waiting for opponent'
      : walletMode === 'burner'
        ? `Turn: ${currentTurnBurnerIndex >= 0 ? `Burner ${currentTurnBurnerIndex + 1}` : shortAddress(currentPlayerAddress)} (${shortAddress(currentPlayerAddress)})`
        : `Turn: ${current.name} (${shortAddress(currentPlayerAddress)})`

  const handleJoinById = async () => {
    const parsed = Number(joinGameId)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    await joinGame(parsed)
    setJoinGameId('')
  }

  const showLobbyScreen = selectedGameId === null
  const showWaitingChoice =
    systemBonusChoice !== null && (!isCurrentUserTurn || localPlayerIndex !== systemBonusChoice.playerIndex)

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg font-black tracking-tight text-ink">
            BLOC<span className="text-ink-faint">:</span>DUEL
          </h1>
          {selectedGameId !== null && (
            <span className="rounded-md bg-ink/5 px-2 py-0.5 font-mono text-xs font-bold text-ink-muted">
              Game #{selectedGameId}
            </span>
          )}
          {selectedGameId !== null && (
            <span className="rounded-md border border-border bg-surface-raised px-2 py-0.5 font-mono text-xs text-ink-muted">
              {PHASE_LABELS[phase]}
            </span>
          )}
          {selectedGameId !== null && phase !== 'LOBBY' && (
            <span className="rounded-md bg-ink/5 px-2 py-0.5 font-mono text-xs font-bold text-ink-muted">
              Age {AGE_LABELS[age]}
            </span>
          )}
          {currentTurnLabel && (
            <span
              className={
                `rounded-md border px-2 py-0.5 font-mono text-xs ${
                  currentTurnIsLocalWallet
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-border bg-surface-raised text-ink-muted'
                }`
              }
            >
              {currentTurnLabel}
              {currentTurnIsLocalWallet && phase !== 'GAME_OVER' ? ' - your turn' : ''}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedGameId !== null && (
            <button
              onClick={() => setSelectedGameId(null)}
              className="rounded-md border border-border bg-surface-raised px-2.5 py-1 font-mono text-[11px] font-medium text-ink-muted transition hover:border-ink-faint hover:text-ink"
            >
              Lobby
            </button>
          )}
          <button
            onClick={() => {
              clearError()
              void refreshGames()
              void refreshGame(selectedGameId)
            }}
            className="rounded-md border border-border bg-surface-raised px-2.5 py-1 font-mono text-[11px] font-medium text-ink-muted transition hover:border-ink-faint hover:text-ink"
          >
            Refresh
          </button>
          <button
            onClick={() => void createGame()}
            disabled={!runtimeReady || !isConnected || isSubmitting}
            className="rounded-md border border-border bg-ink px-3 py-1 font-mono text-[11px] font-semibold text-white transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:bg-ink-faint"
          >
            New Game
          </button>
          {walletMode === 'burner' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-border bg-surface-raised px-2.5 py-1 font-mono text-[11px] font-medium text-ink-muted">
                {isConnected
                  ? `Burner ${(burnerIndex ?? 0) + 1}/${Math.max(1, burnerAddresses.length)} ${shortAddress(address)}`
                  : 'Preparing burner...'}
              </span>
              {burnerAddresses.length > 1 && (
                <select
                  value={burnerIndex ?? 0}
                  onChange={(event) => switchBurner(Number(event.target.value))}
                  className="rounded-md border border-border bg-surface-raised px-2.5 py-1 font-mono text-[11px] font-medium text-ink-muted outline-none transition hover:border-ink-faint"
                >
                  {burnerAddresses.map((burnerAddress, index) => (
                    <option key={burnerAddress} value={index}>
                      {`Burner ${index + 1} ${shortAddress(burnerAddress)}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : isConnected ? (
            <button
              onClick={() => disconnect()}
              disabled={isDisconnecting}
              className="rounded-md border border-border bg-surface-raised px-2.5 py-1 font-mono text-[11px] font-medium text-ink-muted transition hover:border-ink-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Controller {shortAddress(address)}
            </button>
          ) : (
            <button
              onClick={() => {
                if (controllerConnector) {
                  void connect({ connector: controllerConnector })
                }
              }}
              disabled={!controllerConnector || isPending}
              className="rounded-md border border-border bg-surface-raised px-2.5 py-1 font-mono text-[11px] font-medium text-ink-muted transition hover:border-ink-faint hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Connect Controller
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 font-mono text-xs text-red-700 md:px-6">
          {error}
        </div>
      )}

      {isBootstrappingRuntime && (
        <div className="border-b border-border/60 bg-surface-raised px-4 py-2 font-mono text-xs text-ink-faint md:px-6">
          Initializing Dojo and Torii...
        </div>
      )}

      {showLobbyScreen ? (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 md:px-6">
          <section className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">Contract Lobby</p>
                <h2 className="font-display text-2xl font-black text-ink">Create or join an on-chain match</h2>
                <p className="mt-1 max-w-2xl text-sm text-ink-muted">
                  Connect a Starknet wallet, create a game, then share the game id with your opponent.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={joinGameId}
                  onChange={(event) => setJoinGameId(event.target.value)}
                  placeholder="Game id"
                  className="rounded-xl border border-border bg-white px-3 py-2 font-mono text-sm text-ink outline-none transition focus:border-ink-faint"
                />
                <button
                  onClick={() => void handleJoinById()}
                  disabled={!runtimeReady || !isConnected || isSubmitting}
                  className="rounded-xl border border-border bg-surface px-4 py-2 font-mono text-sm font-semibold text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Join by id
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-ink">My Games</h3>
                <span className="font-mono text-[11px] text-ink-faint">{myGames.length}</span>
              </div>

              {isLoadingGames && games.length === 0 ? (
                <p className="font-mono text-xs text-ink-faint">Loading games...</p>
              ) : myGames.length === 0 ? (
                <p className="font-mono text-xs text-ink-faint">No games linked to this wallet yet.</p>
              ) : (
                <div className="space-y-2">
                  {myGames.map((game) => (
                    <button
                      key={game.gameId}
                      onClick={() => setSelectedGameId(game.gameId)}
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-white px-3 py-2 text-left transition hover:border-ink-faint hover:shadow-sm"
                    >
                      <div>
                        <p className="font-mono text-sm font-bold text-ink">#{game.gameId}</p>
                        <p className="font-mono text-[11px] text-ink-faint">{PHASE_LABELS[game.phase]}</p>
                      </div>
                      <div className="text-right font-mono text-[11px] text-ink-muted">
                        <p>{shortAddress(game.playerOne)}</p>
                        <p>{isZeroAddress(game.playerTwo) ? 'waiting for opponent' : shortAddress(game.playerTwo)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-surface-raised p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-ink">Open Lobbies</h3>
                <span className="font-mono text-[11px] text-ink-faint">{openLobbies.length}</span>
              </div>

              {openLobbies.length === 0 ? (
                <p className="font-mono text-xs text-ink-faint">No waiting lobbies right now.</p>
              ) : (
                <div className="space-y-2">
                  {openLobbies.map((game) => (
                    <div
                      key={game.gameId}
                      className="flex items-center justify-between rounded-xl border border-border bg-white px-3 py-2"
                    >
                      <div>
                        <p className="font-mono text-sm font-bold text-ink">#{game.gameId}</p>
                        <p className="font-mono text-[11px] text-ink-faint">Host {shortAddress(game.playerOne)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedGameId(game.gameId)}
                          className="rounded-lg border border-border px-2.5 py-1 font-mono text-[11px] text-ink-muted transition hover:border-ink-faint hover:text-ink"
                        >
                          View
                        </button>
                        <button
                          onClick={() => void joinGame(game.gameId)}
                          disabled={!runtimeReady || !canJoinGame(game, address ?? null) || isSubmitting}
                          className="rounded-lg bg-ink px-2.5 py-1 font-mono text-[11px] font-semibold text-white transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:bg-ink-faint"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : isLoadingGame && selectedSummary?.phase !== 'LOBBY' && pyramid.length === 0 ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 md:px-6">
          <section className="rounded-3xl border border-border bg-surface-raised p-6 text-center shadow-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">Syncing</p>
            <h2 className="mt-2 font-display text-3xl font-black text-ink">Loading on-chain game</h2>
            <p className="mt-2 text-sm text-ink-muted">Fetching the latest state from Torii and Starknet.</p>
          </section>
        </div>
      ) : selectedSummary && selectedSummary.phase === 'LOBBY' ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 md:px-6">
          <section className="rounded-3xl border border-border bg-surface-raised p-6 text-center shadow-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">Lobby</p>
            <h2 className="mt-2 font-display text-3xl font-black text-ink">Waiting for second player</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Share game id <span className="font-mono font-bold text-ink">#{selectedSummary.gameId}</span> with your opponent.
            </p>

            <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-white p-4 text-left sm:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Atlantic</p>
                <p className="font-mono text-sm font-bold text-ink">{shortAddress(players[0].address)}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">Continental</p>
                <p className="font-mono text-sm font-bold text-ink">{isZeroAddress(players[1].address) ? 'Waiting...' : shortAddress(players[1].address)}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setSelectedGameId(null)}
                className="rounded-xl border border-border px-4 py-2 font-mono text-sm text-ink-muted transition hover:border-ink-faint hover:text-ink"
              >
                Back to lobby list
              </button>
              <button
                onClick={() => void joinGame(selectedSummary.gameId)}
                disabled={!runtimeReady || !canJoinGame(selectedSummary, address ?? null) || isSubmitting}
                className="rounded-xl bg-ink px-4 py-2 font-mono text-sm font-semibold text-white transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:bg-ink-faint"
              >
                Join this game
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="md:h-screen md:overflow-hidden min-h-screen flex flex-col bg-surface">
          {isLoadingGame && (
            <div className="px-4 py-2 font-mono text-xs text-ink-faint md:px-6">Syncing game state...</div>
          )}

          <div className="flex flex-col flex-1 px-2 md:px-3 pb-2 gap-1.5 md:gap-2 md:overflow-hidden">
            <PlayerStatsBar playerIndex={topPlayer} isBottom={false} />
            <PlayField playerIndex={topPlayer} />

            <div className="flex flex-col md:flex-row gap-1.5 md:gap-3 px-1">
              <div className="flex-1">
                <p className="font-mono text-[8px] uppercase tracking-wider text-ink-faint mb-0.5 text-center">AGI</p>
                <AGITrack />
              </div>
              <div className="flex-1">
                <p className="font-mono text-[8px] uppercase tracking-wider text-ink-faint mb-0.5 text-center">Escalation</p>
                <EscalationTrack />
              </div>
            </div>

            <DiscardZone
              ref={discardRef}
              sellValue={sellValue}
              isHighlighted={activeDragZone === 'discard'}
            />

            <div className="flex-1 flex items-center justify-center min-h-0 py-1">
              <CardPyramid
                dropRefs={dropRefs}
                onPlay={(position) => void playCardAt(position)}
                onDiscard={(position) => void discardCardAt(position)}
                onDragOverZone={setActiveDragZone}
              />
            </div>

            <PlayField
              ref={playFieldRef}
              playerIndex={bottomPlayer}
              isHighlighted={activeDragZone === 'play'}
            />

            <PlayerStatsBar playerIndex={bottomPlayer} isBottom={true} />
          </div>

          <AnimatePresence>
            {selectedNode && phase === 'DRAFTING' && (
              <CardZoom
                card={selectedNode.card}
                affordable={canAffordCard}
                isFreeViaChain={isFreeViaChain}
                effectiveCost={selectedEffectiveCost}
                sellValue={sellValue}
                onPlay={() => { void playCard() }}
                onDiscard={() => { void discardCard() }}
                onClose={() => useGameStore.getState().selectCard(selectedNode.position)}
              />
            )}
          </AnimatePresence>

          <HeroPicker />

          {systemBonusChoice && localPlayerIndex === systemBonusChoice.playerIndex && (
            <SystemBonusChoice
              playerName={players[systemBonusChoice.playerIndex].name}
              options={systemBonusChoice.options}
              onChoose={(symbol) => { void chooseSystemBonus(symbol) }}
            />
          )}

          <AnimatePresence>
            {showWaitingChoice && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 flex items-center justify-center bg-ink/25 backdrop-blur-sm"
              >
                <div className="rounded-3xl border border-border bg-surface-raised px-8 py-6 text-center shadow-2xl">
                  <p className="font-display text-xl font-black text-ink">Waiting for system bonus</p>
                  <p className="mt-2 font-mono text-xs text-ink-muted">
                    {players[systemBonusChoice.playerIndex].name} is choosing a permanent bonus.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {phase === 'AGE_TRANSITION' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-3xl bg-surface-raised p-10 text-center shadow-2xl border border-border"
                >
                  <h2 className="font-display text-3xl font-black text-ink mb-2">
                    Age {AGE_LABELS[age]} Complete
                  </h2>
                  <p className="text-sm text-ink-muted mb-6">
                    {isCurrentUserTurn
                      ? 'Advance the contracts to the next age when ready.'
                      : 'Waiting for the active player to start the next age.'}
                  </p>
                  <button
                    onClick={() => { void nextAge() }}
                    disabled={!isCurrentUserTurn || isSubmitting}
                    className="rounded-xl bg-ink px-8 py-3 font-display text-sm font-bold text-white shadow-lg transition hover:bg-ink/80 disabled:cursor-not-allowed disabled:bg-ink-faint"
                  >
                    Begin Age {AGE_LABELS[(age + 1) as 1 | 2 | 3] ?? 'III'}
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {phase === 'GAME_OVER' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-3xl bg-surface-raised p-10 text-center shadow-2xl border border-border"
                >
                  <h2 className="font-display text-3xl font-black text-ink mb-2">Game Over</h2>
                  <p className="font-display text-lg font-bold text-ink mb-1">{winnerLabel}</p>
                  <p className="text-sm text-ink-muted mb-6">{WIN_CONDITION_LABELS[winCondition]}</p>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => setSelectedGameId(null)}
                      className="rounded-xl border border-border px-5 py-3 font-display text-sm font-bold text-ink-muted transition hover:text-ink"
                    >
                      Lobby
                    </button>
                    <button
                      onClick={() => void createGame()}
                      disabled={!runtimeReady || !isConnected || isSubmitting}
                      className="rounded-xl bg-ink px-5 py-3 font-display text-sm font-bold text-white shadow-lg transition hover:bg-ink/80 disabled:cursor-not-allowed disabled:bg-ink-faint"
                    >
                      New Match
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
