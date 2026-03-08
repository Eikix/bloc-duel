import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ControllerConnector } from '@cartridge/connector'
import { devnet, mainnet, sepolia, type Chain } from '@starknet-react/chains'
import { MockConnector, jsonRpcProvider, StarknetConfig, useAccount, useConnect, type Connector } from '@starknet-react/core'
import { constants } from 'starknet'
import { fetchKatanaAccounts, getBurnerAddress, pickBurnerIndex, rememberBurnerIndex, resolveKatanaAccount } from '../dojo/burner'
import { getDojoConfig, type BlocDuelConfig } from '../dojo/config'
import { BurnerWalletContext } from './burnerWallet'

interface WalletSetup {
  chain: Chain
  connectors: Connector[]
  burnerConnector?: MockConnector
  burnerAddresses: string[]
  burnerIndex: number | null
}

interface BurnerConnectorSetup {
  connector: MockConnector
  burnerAddresses: string[]
  burnerIndex: number
}

function createKatanaChain(rpcUrl: string): Chain {
  return {
    ...devnet,
    name: 'Katana Local',
    network: 'katana',
    rpcUrls: {
      ...devnet.rpcUrls,
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
    paymasterRpcUrls: {
      ...devnet.paymasterRpcUrls,
      avnu: { http: [rpcUrl] },
    },
  }
}

function getActiveChain(config: BlocDuelConfig): Chain {
  switch (config.network) {
    case 'mainnet':
      return mainnet
    case 'sepolia':
      return sepolia
    case 'katana':
      return createKatanaChain(config.rpcUrl)
  }
}

async function createBurnerConnector(config: BlocDuelConfig): Promise<BurnerConnectorSetup> {
  const katanaAccounts = await fetchKatanaAccounts(config.rpcUrl)
  const burnerAddresses = katanaAccounts.map((entry) => getBurnerAddress(entry))
  const accounts = await Promise.all(burnerAddresses.map((address) => resolveKatanaAccount(config.rpcUrl, address)))
  const burnerIndex = pickBurnerIndex(accounts.length)

  const connector = new MockConnector({
    accounts: {
      sepolia: accounts,
      mainnet: accounts,
    },
    options: {
      id: 'katana-burner',
      name: 'Katana Burner',
    },
  })

  connector.switchChain(devnet.id)
  connector.switchAccount(burnerIndex)
  rememberBurnerIndex(burnerIndex, accounts.length)

  return {
    connector,
    burnerAddresses,
    burnerIndex,
  }
}

function createControllerConnector(config: BlocDuelConfig): ControllerConnector {
  const policies = {
    contracts: {
      [config.actionsAddress]: {
        name: 'Bloc Duel Actions',
        description: 'Core match actions for creating and playing Bloc Duel matches.',
        methods: [
          { name: 'Create Game', entrypoint: 'create_game', description: 'Create a new Bloc Duel lobby.' },
          { name: 'Join Game', entrypoint: 'join_game', description: 'Join an existing Bloc Duel lobby.' },
          { name: 'Play Card', entrypoint: 'play_card', description: 'Deploy a drafted card to the board.' },
          { name: 'Discard Card', entrypoint: 'discard_card', description: 'Sell a drafted card for capital.' },
          { name: 'Invoke Hero', entrypoint: 'invoke_hero', description: 'Spend capital to invoke a hero.' },
          { name: 'Choose System Bonus', entrypoint: 'choose_system_bonus', description: 'Resolve a system pair bonus.' },
          { name: 'Next Age', entrypoint: 'next_age', description: 'Advance the match into the next age.' },
        ],
      },
    },
  }

  return new ControllerConnector({
    chains: [{ rpcUrl: config.rpcUrl }],
    defaultChainId:
      config.network === 'mainnet'
        ? constants.StarknetChainId.SN_MAIN
        : constants.StarknetChainId.SN_SEPOLIA,
    errorDisplayMode: 'notification',
    lazyload: true,
    namespace: config.namespace,
    policies,
    slot: config.slot,
  })
}

function AutoConnectBurner({ connector }: { connector: MockConnector }) {
  const attemptedRef = useRef(false)
  const { connectAsync, isPending } = useConnect()
  const { isConnected } = useAccount()

  useEffect(() => {
    attemptedRef.current = false
  }, [connector])

  useEffect(() => {
    if (attemptedRef.current || isConnected || isPending) return

    attemptedRef.current = true
    connectAsync({ connector }).catch((error: unknown) => {
      attemptedRef.current = false
      console.error('Failed to auto-connect Katana burner', error)
    })
  }, [connectAsync, connector, isConnected, isPending])

  return null
}

function StarknetProviderInner({ children, setup }: { children: ReactNode; setup: WalletSetup }) {
  const config = useMemo(() => getDojoConfig(), [])

  return (
    <StarknetConfig
      chains={[setup.chain]}
      defaultChainId={setup.chain.id}
      provider={jsonRpcProvider({
        rpc: () => ({ nodeUrl: config.rpcUrl }),
      })}
      connectors={setup.connectors}
    >
      {setup.burnerConnector && <AutoConnectBurner connector={setup.burnerConnector} />}
      {children}
    </StarknetConfig>
  )
}

export function StarknetProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => getDojoConfig(), [])
  const [setup, setSetup] = useState<WalletSetup | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)

  const switchBurner = useCallback((index: number) => {
    if (!setup?.burnerConnector || setup.burnerAddresses.length === 0) return

    const nextIndex = ((index % setup.burnerAddresses.length) + setup.burnerAddresses.length) % setup.burnerAddresses.length
    rememberBurnerIndex(nextIndex, setup.burnerAddresses.length)
    setup.burnerConnector.switchAccount(nextIndex)
    setSetup({
      ...setup,
      burnerIndex: nextIndex,
    })
  }, [setup])

  const cycleBurner = useCallback(() => {
    if (!setup || setup.burnerAddresses.length <= 1) return
    switchBurner((setup.burnerIndex ?? 0) + 1)
  }, [setup, switchBurner])

  const burnerContextValue = useMemo(
    () => ({
      burnerAddresses: setup?.burnerAddresses ?? [],
      burnerIndex: setup?.burnerIndex ?? null,
      switchBurner,
      cycleBurner,
    }),
    [cycleBurner, setup?.burnerAddresses, setup?.burnerIndex, switchBurner],
  )

  useEffect(() => {
    let mounted = true

    void (async () => {
      try {
        if (config.walletMode === 'burner') {
          const burnerSetup = await createBurnerConnector(config)
          if (!mounted) return

          setSetup({
            chain: getActiveChain(config),
            connectors: [burnerSetup.connector],
            burnerConnector: burnerSetup.connector,
            burnerAddresses: burnerSetup.burnerAddresses,
            burnerIndex: burnerSetup.burnerIndex,
          })
          return
        }

        const controllerConnector = createControllerConnector(config)
        if (!mounted) return

        setSetup({
          chain: getActiveChain(config),
          connectors: [controllerConnector],
          burnerAddresses: [],
          burnerIndex: null,
        })
      } catch (error) {
        if (!mounted) return
        setSetupError(error instanceof Error ? error.message : 'Unable to initialize wallet strategy')
      }
    })()

    return () => {
      mounted = false
    }
  }, [config])

  if (setupError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6 text-center text-ink">
        <div>
          <p className="font-display text-2xl font-black">Wallet init failed</p>
          <p className="mt-2 font-mono text-sm text-ink-muted">{setupError}</p>
        </div>
      </div>
    )
  }

  if (!setup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-6 text-center text-ink">
        <div>
          <p className="font-display text-2xl font-black">Initializing wallet</p>
          <p className="mt-2 font-mono text-sm text-ink-muted">
            {config.walletMode === 'burner' ? 'Preparing local Katana burner...' : 'Preparing Cartridge Controller...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <BurnerWalletContext.Provider value={burnerContextValue}>
      <StarknetProviderInner setup={setup}>{children}</StarknetProviderInner>
    </BurnerWalletContext.Provider>
  )
}
