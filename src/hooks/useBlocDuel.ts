import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core'
import { resolveKatanaAccount } from '../dojo/burner'
import {
  acquireBlocDuelRuntime,
  releaseBlocDuelRuntime,
  resetBlocDuelRuntime,
  type BlocDuelRuntime,
} from '../dojo/client'
import { getDojoConfig } from '../dojo/config'
import {
  fetchGameSnapshot,
  fetchGameSummaries,
  subscribeToGame,
  subscribeToGames,
  waitForCreatedGame,
} from '../dojo/torii'
import { useBurnerWallet } from '../providers/burnerWallet'
import { useGameStore } from '../store/gameStore'

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

export function useBlocDuelLifecycle() {
  const [runtime, setRuntimeState] = useState<BlocDuelRuntime | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [isBootstrappingRuntime, setIsBootstrappingRuntime] = useState(true)
  const [runtimeNonce, setRuntimeNonce] = useState(0)
  const initialSelectionApplied = useRef(false)

  const config = getDojoConfig()
  const { burnerAddresses, burnerIndex, switchBurner } = useBurnerWallet()
  const { account, address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect, isPending: isDisconnecting } = useDisconnect()

  const selectedGameId = useGameStore((state) => state.selectedGameId)
  const setRuntime = useGameStore((state) => state.setRuntime)
  const setWalletAddress = useGameStore((state) => state.setWalletAddress)
  const setSelectedGameId = useGameStore((state) => state.setSelectedGameId)
  const setLoadingGames = useGameStore((state) => state.setLoadingGames)
  const setLoadingGame = useGameStore((state) => state.setLoadingGame)
  const syncGames = useGameStore((state) => state.syncGames)
  const syncSnapshot = useGameStore((state) => state.syncSnapshot)

  const reloadRuntime = useCallback(() => {
    setIsBootstrappingRuntime(true)
    setRuntimeError(null)
    setRuntime(null)
    setRuntimeState(null)
    resetBlocDuelRuntime()
    setRuntimeNonce((value) => value + 1)
  }, [setRuntime])

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
        setRuntimeError(null)
        const nextRuntime = await acquireBlocDuelRuntime()
        if (!mounted) {
          releaseBlocDuelRuntime(nextRuntime)
          return
        }

        currentRuntime = nextRuntime
        setRuntimeState(nextRuntime)
      } catch (error) {
        if (!mounted) return
        setRuntimeError(error instanceof Error ? error.message : 'Unable to initialize Dojo runtime')
      } finally {
        if (mounted) {
          setIsBootstrappingRuntime(false)
        }
      }
    })()

    return () => {
      mounted = false
      releaseBlocDuelRuntime(currentRuntime)
    }
  }, [runtimeNonce])

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

    if (config.walletMode === 'burner') {
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
  }, [account, address, config.walletMode, discoverCreatedGame, refreshGame, refreshGames, runtime, setRuntime, setWalletAddress])

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

  return {
    address,
    burnerAddresses,
    burnerIndex,
    connect,
    connectors,
    disconnect,
    isBootstrappingRuntime,
    isConnected: Boolean(isConnected),
    isDisconnecting: Boolean(isDisconnecting),
    isPending: Boolean(isPending),
    refreshGame,
    refreshGames,
    reloadRuntime,
    runtime,
    runtimeError,
    runtimeReady: runtime !== null,
    switchBurner,
    walletMode: config.walletMode,
  }
}
