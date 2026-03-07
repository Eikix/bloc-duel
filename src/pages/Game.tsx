import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core'
import AGITrack from '../components/AGITrack'
import ActionDock from '../components/ActionDock'
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
  const phaseObjective =
    phase === 'DRAFTING'
      ? 'Inspect a revealed dossier, then deploy it to your command row or liquidate it for capital.'
      : phase === 'AGE_TRANSITION'
        ? 'The current age is cleared. Advance the theater when the active commander is ready.'
        : phase === 'GAME_OVER'
          ? 'The duel is settled. Review the winner and start a fresh command exercise when ready.'
          : 'Open the lobby, invite a rival bloc, and begin the draft.'
  const stageAnimationKey = `${selectedGameId ?? 'lobby'}-${age}-${phase}-${currentPlayer}`

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
    <div className="game-shell flex min-h-screen flex-col text-ink lg:h-screen lg:overflow-hidden">
      <header className="game-topbar rounded-[26px] px-4 py-3 md:px-6 md:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <div>
              <p className="section-label mb-1">Strategic Command Simulator</p>
              <h1 className="font-display text-xl font-black tracking-[0.02em] text-ink md:text-2xl">
                BLOC<span className="text-continental">:</span>DUEL
              </h1>
            </div>
          {selectedGameId !== null && (
            <span className="command-chip rounded-full px-3 py-1 font-mono text-xs font-bold text-ink-muted">
              Game #{selectedGameId}
            </span>
          )}
          {selectedGameId !== null && (
            <span className="command-chip rounded-full px-3 py-1 font-mono text-xs text-ink-muted">
              {PHASE_LABELS[phase]}
            </span>
          )}
          {selectedGameId !== null && phase !== 'LOBBY' && (
            <span className="command-chip rounded-full px-3 py-1 font-mono text-xs font-bold text-ink-muted">
              Age {AGE_LABELS[age]}
            </span>
          )}
          {currentTurnLabel && (
            <motion.span
              key={stageAnimationKey}
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className={
                `rounded-full border px-3 py-1 font-mono text-xs ${
                  currentTurnIsLocalWallet
                    ? 'border-emerald-300 bg-emerald-50/90 text-emerald-700 shadow-[0_8px_24px_rgba(16,185,129,0.16)]'
                    : 'border-white/70 bg-white/60 text-ink-muted'
                }`
              }
            >
              {currentTurnLabel}
              {currentTurnIsLocalWallet && phase !== 'GAME_OVER' ? ' - your turn' : ''}
            </motion.span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedGameId !== null && (
            <button
              onClick={() => setSelectedGameId(null)}
              className="command-chip rounded-xl px-3 py-1.5 font-mono text-[11px] font-medium text-ink-muted transition hover:-translate-y-0.5 hover:text-ink"
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
            className="command-chip rounded-xl px-3 py-1.5 font-mono text-[11px] font-medium text-ink-muted transition hover:-translate-y-0.5 hover:text-ink"
          >
            Refresh
          </button>
          <button
            onClick={() => void createGame()}
            disabled={!runtimeReady || !isConnected || isSubmitting}
            className="rounded-xl border border-transparent bg-[linear-gradient(135deg,#112038,#24446f)] px-3.5 py-1.5 font-mono text-[11px] font-semibold text-white shadow-[0_12px_24px_rgba(17,32,56,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
          >
            New Game
          </button>
          {walletMode === 'burner' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="command-chip rounded-xl px-3 py-1.5 font-mono text-[11px] font-medium text-ink-muted">
                {isConnected
                  ? `Burner ${(burnerIndex ?? 0) + 1}/${Math.max(1, burnerAddresses.length)} ${shortAddress(address)}`
                  : 'Preparing burner...'}
              </span>
              {burnerAddresses.length > 1 && (
                <select
                  value={burnerIndex ?? 0}
                  onChange={(event) => switchBurner(Number(event.target.value))}
                  className="command-chip rounded-xl px-3 py-1.5 font-mono text-[11px] font-medium text-ink-muted outline-none transition hover:text-ink"
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
              className="command-chip rounded-xl px-3 py-1.5 font-mono text-[11px] font-medium text-ink-muted transition hover:-translate-y-0.5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
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
              className="command-chip rounded-xl px-3 py-1.5 font-mono text-[11px] font-medium text-ink-muted transition hover:-translate-y-0.5 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Connect Controller
            </button>
          )}
        </div>
        </div>
      </header>

      {error && (
        <div className="mx-3 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-2 font-mono text-xs text-red-700 shadow-[0_10px_30px_rgba(239,68,68,0.1)] md:px-6">
          {error}
        </div>
      )}

      {isBootstrappingRuntime && (
        <div className="mx-3 rounded-2xl border border-white/70 bg-white/70 px-4 py-2 font-mono text-xs text-ink-faint shadow-[0_10px_28px_rgba(73,92,120,0.08)] md:px-6">
          Initializing Dojo and Torii...
        </div>
      )}

      {showLobbyScreen ? (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 md:px-6">
          <section className="panel-steel rounded-[28px] p-5 md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="section-label mb-2">War Room</p>
                <h2 className="font-display text-3xl font-black text-ink md:text-4xl">Launch a new bloc skirmish</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted md:text-[15px]">
                  Spin up a live contract-backed duel, claim a burner or controller seat, and share the mission id with your rival commander.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={joinGameId}
                  onChange={(event) => setJoinGameId(event.target.value)}
                  placeholder="Game id"
                  className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 font-mono text-sm text-ink outline-none transition focus:border-atlantic focus:ring-2 focus:ring-atlantic/20"
                />
                <button
                  onClick={() => void handleJoinById()}
                  disabled={!runtimeReady || !isConnected || isSubmitting}
                  className="rounded-2xl bg-[linear-gradient(135deg,#112038,#2a537f)] px-5 py-3 font-mono text-sm font-semibold text-white shadow-[0_18px_28px_rgba(17,32,56,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Join by id
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="panel-glass rounded-[26px] p-5">
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
                      className="flex w-full items-center justify-between rounded-2xl border border-white/70 bg-white/72 px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_28px_rgba(65,84,110,0.12)]"
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

            <div className="panel-glass rounded-[26px] p-5">
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
                      className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/72 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
                    >
                      <div>
                        <p className="font-mono text-sm font-bold text-ink">#{game.gameId}</p>
                        <p className="font-mono text-[11px] text-ink-faint">Host {shortAddress(game.playerOne)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedGameId(game.gameId)}
                          className="command-chip rounded-xl px-3 py-1.5 font-mono text-[11px] text-ink-muted transition hover:-translate-y-0.5 hover:text-ink"
                        >
                          View
                        </button>
                        <button
                          onClick={() => void joinGame(game.gameId)}
                          disabled={!runtimeReady || !canJoinGame(game, address ?? null) || isSubmitting}
                          className="rounded-xl bg-[linear-gradient(135deg,#112038,#2a537f)] px-3 py-1.5 font-mono text-[11px] font-semibold text-white shadow-[0_12px_20px_rgba(17,32,56,0.16)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
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
          <section className="panel-steel rounded-[30px] p-8 text-center">
            <p className="section-label">Syncing</p>
            <h2 className="mt-2 font-display text-3xl font-black text-ink">Loading live theater state</h2>
            <p className="mt-2 text-sm text-ink-muted">Fetching the latest board, dossiers, and faction telemetry from Torii.</p>
          </section>
        </div>
      ) : selectedSummary && selectedSummary.phase === 'LOBBY' ? (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8 md:px-6">
          <section className="panel-steel rounded-[30px] p-8 text-center">
            <p className="section-label">Lobby</p>
            <h2 className="mt-2 font-display text-3xl font-black text-ink">Waiting for a rival commander</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Share game id <span className="font-mono font-bold text-ink">#{selectedSummary.gameId}</span> with your opponent.
            </p>

            <div className="mt-6 grid gap-3 rounded-[26px] border border-white/80 bg-white/78 p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] sm:grid-cols-2">
              <div>
                <p className="section-label mb-2">Atlantic</p>
                <p className="font-mono text-sm font-bold text-ink">{shortAddress(players[0].address)}</p>
              </div>
              <div>
                <p className="section-label mb-2">Continental</p>
                <p className="font-mono text-sm font-bold text-ink">{isZeroAddress(players[1].address) ? 'Waiting...' : shortAddress(players[1].address)}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => setSelectedGameId(null)}
                className="command-chip rounded-2xl px-4 py-2 font-mono text-sm text-ink-muted transition hover:-translate-y-0.5 hover:text-ink"
              >
                Back to lobby list
              </button>
              <button
                onClick={() => void joinGame(selectedSummary.gameId)}
                disabled={!runtimeReady || !canJoinGame(selectedSummary, address ?? null) || isSubmitting}
                className="rounded-2xl bg-[linear-gradient(135deg,#112038,#2a537f)] px-5 py-2.5 font-mono text-sm font-semibold text-white shadow-[0_18px_28px_rgba(17,32,56,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Join this game
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 pb-4 md:px-5 md:pb-5 lg:min-h-0 lg:overflow-hidden">
          {isLoadingGame && (
            <div className="mx-auto mb-3 w-full max-w-[1600px] rounded-2xl border border-white/70 bg-white/72 px-4 py-2 font-mono text-xs text-ink-faint shadow-[0_12px_22px_rgba(72,93,119,0.08)]">
              Syncing live game state...
            </div>
          )}

          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 lg:h-full lg:min-h-0">
            <PlayerStatsBar playerIndex={topPlayer} isBottom={false} />

            <section className="table-surface flex flex-1 flex-col rounded-[32px] px-3 py-3 md:px-5 md:py-5 lg:min-h-0">
              <div className="relative z-10 flex flex-col gap-3 xl:hidden">
                <div className="hud-scroll -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hidden">
                  <div className="panel-glass min-w-[280px] rounded-[24px] p-4">
                    <p className="section-label mb-2">Command Briefing</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-atlantic/10 px-3 py-1 font-mono text-[11px] font-semibold text-atlantic">
                        {PHASE_LABELS[phase]}
                      </span>
                      <span className="rounded-full bg-white/70 px-3 py-1 font-mono text-[11px] text-ink-muted">
                        {currentTurnLabel ?? 'Awaiting orders'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink-muted">{phaseObjective}</p>
                    <p className="mt-3 font-mono text-[11px] text-ink-faint">
                      Tap to inspect. Drag to deploy. Drag downward to salvage.
                    </p>
                  </div>

                  <div className="panel-glass min-w-[300px] rounded-[24px] p-4">
                    <p className="section-label mb-3">AGI Pressure</p>
                    <AGITrack />
                  </div>

                  <div className="panel-glass min-w-[320px] rounded-[24px] p-4">
                    <p className="section-label mb-3">Escalation Index</p>
                    <EscalationTrack />
                  </div>
                </div>

                <div className="relative z-10 flex min-h-[360px] flex-1 flex-col rounded-[28px] border border-white/65 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(240,245,251,0.84)_35%,rgba(223,231,240,0.78)_100%)] px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_24px_40px_rgba(83,102,129,0.14)] md:min-h-[clamp(360px,44vh,430px)] md:px-5 md:py-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="section-label mb-2">Draft Grid</p>
                      <h2 className="font-display text-2xl font-black text-ink md:text-[2rem]">Operational theater</h2>
                    </div>
                    <div className="rounded-2xl border border-white/75 bg-white/66 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">Current sale rate</p>
                      <p className="mt-1 font-display text-lg font-black text-continental">Sell +{sellValue}</p>
                    </div>
                  </div>

                  <PlayField
                    playerIndex={topPlayer}
                    label="Enemy network"
                    emptyHint="Enemy has not deployed any dossiers yet."
                    compact
                  />

                  <div className="relative my-3 flex flex-1 items-center justify-center overflow-hidden rounded-[24px] border border-white/70 bg-[radial-gradient(circle_at_center,rgba(47,109,246,0.08),rgba(255,255,255,0)_62%)] px-2 py-4 md:px-4 md:py-5">
                    <CardPyramid
                      key={`${selectedGameId ?? 'none'}-${age}`}
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
                    label="Deploy to your network"
                    emptyHint="Drag a drafted card here to deploy it to your network."
                    targetLabel="Drop to deploy"
                    compact
                  />

                  <DiscardZone
                    ref={discardRef}
                    sellValue={sellValue}
                    isHighlighted={activeDragZone === 'discard'}
                    compact
                  />
                </div>
              </div>

              <div className="relative z-10 hidden flex-1 xl:grid xl:min-h-0 xl:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)] xl:gap-4">
                <div className="flex min-h-0 flex-col gap-3">
                  <div className="panel-glass rounded-[24px] p-4">
                    <p className="section-label mb-2">Command Briefing</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-atlantic/10 px-3 py-1 font-mono text-[11px] font-semibold text-atlantic">
                        {PHASE_LABELS[phase]}
                      </span>
                      <span className="rounded-full bg-white/70 px-3 py-1 font-mono text-[11px] text-ink-muted">
                        {currentTurnLabel ?? 'Awaiting orders'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-ink-muted">{phaseObjective}</p>
                  </div>

                  <div className="panel-glass rounded-[24px] p-4">
                    <p className="section-label mb-3">AGI Pressure</p>
                    <AGITrack />
                  </div>

                  <div className="panel-glass rounded-[24px] p-4">
                    <p className="section-label mb-3">Escalation Index</p>
                    <EscalationTrack />
                  </div>
                </div>

                <div className="relative z-10 flex min-h-0 flex-col rounded-[28px] border border-white/65 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9),rgba(240,245,251,0.84)_35%,rgba(223,231,240,0.78)_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_24px_40px_rgba(83,102,129,0.14)] xl:overflow-hidden">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="section-label mb-2">Draft Grid</p>
                      <h2 className="font-display text-[2rem] font-black leading-none text-ink">Operational theater</h2>
                    </div>
                    <div className="rounded-2xl border border-white/75 bg-white/66 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">Current sale rate</p>
                      <p className="mt-1 font-display text-lg font-black text-continental">Sell +{sellValue}</p>
                    </div>
                  </div>

                  <PlayField
                    playerIndex={topPlayer}
                    label="Enemy network"
                    emptyHint="Enemy has not deployed any dossiers yet."
                    compact
                  />

                  <div className="relative my-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[24px] border border-white/70 bg-[radial-gradient(circle_at_center,rgba(47,109,246,0.08),rgba(255,255,255,0)_62%)] px-2 py-3">
                    <CardPyramid
                      key={`${selectedGameId ?? 'none'}-${age}`}
                      dropRefs={dropRefs}
                      onPlay={(position) => void playCardAt(position)}
                      onDiscard={(position) => void discardCardAt(position)}
                      onDragOverZone={setActiveDragZone}
                    />

                    <div className="pointer-events-none absolute inset-x-5 bottom-4 flex items-end justify-between">
                      <ActionDock
                        ref={playFieldRef}
                        label="Deploy"
                        value="Play"
                        variant="deploy"
                        isHighlighted={activeDragZone === 'play'}
                      />
                      <ActionDock
                        ref={discardRef}
                        label="Sell"
                        value={`+${sellValue}`}
                        variant="sell"
                        isHighlighted={activeDragZone === 'discard'}
                      />
                    </div>
                  </div>

                  <PlayField
                    playerIndex={bottomPlayer}
                    label="Your network"
                    emptyHint="Your deployed dossiers appear here."
                    compact
                  />
                </div>
              </div>
            </section>

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
                className="fixed inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle,rgba(17,32,56,0.18),rgba(17,32,56,0.5))] px-4 backdrop-blur-sm"
              >
                <div className="panel-steel rounded-[30px] px-8 py-6 text-center">
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
                className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle,rgba(17,32,56,0.18),rgba(17,32,56,0.56))] px-4 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="panel-steel rounded-[32px] p-10 text-center"
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
                    className="rounded-2xl bg-[linear-gradient(135deg,#112038,#2a537f)] px-8 py-3 font-display text-sm font-bold text-white shadow-[0_20px_32px_rgba(17,32,56,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
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
                className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle,rgba(17,32,56,0.18),rgba(17,32,56,0.56))] px-4 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="panel-steel rounded-[32px] p-10 text-center"
                >
                  <h2 className="font-display text-3xl font-black text-ink mb-2">Game Over</h2>
                  <p className="font-display text-lg font-bold text-ink mb-1">{winnerLabel}</p>
                  <p className="text-sm text-ink-muted mb-6">{WIN_CONDITION_LABELS[winCondition]}</p>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => setSelectedGameId(null)}
                      className="command-chip rounded-2xl px-5 py-3 font-display text-sm font-bold text-ink-muted transition hover:-translate-y-0.5 hover:text-ink"
                    >
                      Lobby
                    </button>
                    <button
                      onClick={() => void createGame()}
                      disabled={!runtimeReady || !isConnected || isSubmitting}
                      className="rounded-2xl bg-[linear-gradient(135deg,#112038,#2a537f)] px-5 py-3 font-display text-sm font-bold text-white shadow-[0_20px_32px_rgba(17,32,56,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
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
