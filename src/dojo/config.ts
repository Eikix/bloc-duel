import baseManifest from '../../contracts/manifest_dev.json'

const ACTIONS_TAG = 'bloc_duel-actions'
const LOCAL_NODE_URL = 'http://127.0.0.1:5050'
const LOCAL_TORII_URL = 'http://127.0.0.1:8080'

export type StarknetNetwork = 'katana' | 'sepolia' | 'mainnet'
export type WalletMode = 'burner' | 'controller'

const DEFAULT_RPC_URLS: Record<StarknetNetwork, string> = {
  katana: LOCAL_NODE_URL,
  sepolia: 'https://api.cartridge.gg/x/starknet/sepolia',
  mainnet: 'https://api.cartridge.gg/x/starknet/mainnet',
}

function pickEnv(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim().length > 0)
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '')
}

function isLocalUrl(value: string | undefined): boolean {
  if (!value) return false

  return value.includes('127.0.0.1') || value.includes('localhost') || value.includes('0.0.0.0')
}

function normalizeNetworkHint(value: string | undefined): StarknetNetwork | undefined {
  switch (value?.trim().toLowerCase()) {
    case 'katana':
    case 'local':
    case 'devnet':
      return 'katana'
    case 'slot':
    case 'sepolia':
      return 'sepolia'
    case 'mainnet':
      return 'mainnet'
    default:
      return undefined
  }
}

function inferNetwork(rpcUrlHint: string | undefined, toriiUrl: string): StarknetNetwork {
  const hintedNetwork = normalizeNetworkHint(
    pickEnv(
      import.meta.env.VITE_PUBLIC_STARKNET_NETWORK,
      import.meta.env.PUBLIC_STARKNET_NETWORK,
      import.meta.env.VITE_PUBLIC_DEPLOY_TYPE,
      import.meta.env.PUBLIC_DEPLOY_TYPE,
    ),
  )

  if (hintedNetwork) return hintedNetwork
  if (isLocalUrl(rpcUrlHint) || isLocalUrl(toriiUrl)) return 'katana'
  if (rpcUrlHint?.includes('sepolia') || toriiUrl.includes('sepolia')) return 'sepolia'
  if (rpcUrlHint?.includes('mainnet') || toriiUrl.includes('mainnet')) return 'mainnet'
  return 'mainnet'
}

function normalizeWalletMode(value: string | undefined): WalletMode | undefined {
  switch (value?.trim().toLowerCase()) {
    case 'burner':
      return 'burner'
    case 'controller':
      return 'controller'
    default:
      return undefined
  }
}

function buildDojoConfig() {
  const toriiUrl = trimTrailingSlash(
    pickEnv(
      import.meta.env.VITE_PUBLIC_TORII_URL,
      import.meta.env.PUBLIC_TORII_URL,
      import.meta.env.VITE_PUBLIC_TORII,
      import.meta.env.PUBLIC_TORII,
      LOCAL_TORII_URL,
    )!,
  )

  const rpcUrlHint = pickEnv(
    import.meta.env.VITE_PUBLIC_NODE_URL,
    import.meta.env.PUBLIC_NODE_URL,
  )

  const network = inferNetwork(rpcUrlHint, toriiUrl)
  const rpcUrl = pickEnv(rpcUrlHint, DEFAULT_RPC_URLS[network])!
  const walletMode = normalizeWalletMode(
    pickEnv(
      import.meta.env.VITE_PUBLIC_WALLET_MODE,
      import.meta.env.PUBLIC_WALLET_MODE,
    ),
  ) ?? 'controller'

  const worldAddress = pickEnv(
    import.meta.env.VITE_PUBLIC_WORLD_ADDRESS,
    import.meta.env.PUBLIC_WORLD_ADDRESS,
    baseManifest.world.address,
  )!

  const actionsAddress = pickEnv(
    import.meta.env.VITE_PUBLIC_ACTIONS_ADDRESS,
    import.meta.env.PUBLIC_ACTIONS_ADDRESS,
    baseManifest.contracts.find((contract) => contract.tag === ACTIONS_TAG)?.address,
  )!

  const namespace = pickEnv(
    import.meta.env.VITE_PUBLIC_NAMESPACE,
    import.meta.env.PUBLIC_NAMESPACE,
    'bloc_duel',
  )!

  const slot = pickEnv(
    import.meta.env.VITE_PUBLIC_SLOT,
    import.meta.env.PUBLIC_SLOT,
  )

  const manifest = {
    ...baseManifest,
    world: {
      ...baseManifest.world,
      address: worldAddress,
    },
    contracts: baseManifest.contracts.map((contract) =>
      contract.tag === ACTIONS_TAG
        ? {
            ...contract,
            address: actionsAddress,
          }
        : contract,
    ),
  }

  return {
    network,
    walletMode,
    rpcUrl,
    toriiUrl,
    worldAddress,
    actionsAddress,
    namespace,
    slot,
    manifest,
  }
}

let cachedConfig: ReturnType<typeof buildDojoConfig> | null = null

export function getDojoConfig() {
  if (cachedConfig) return cachedConfig

  cachedConfig = buildDojoConfig()
  return cachedConfig
}

export type BlocDuelConfig = ReturnType<typeof getDojoConfig>

export const MODEL_TAGS = {
  game: 'Game',
  heroPool: 'HeroPool',
  pendingChoice: 'PendingChoice',
  playerState: 'PlayerState',
  pyramid: 'Pyramid',
} as const

export function getNamespacedModelTag(tag: (typeof MODEL_TAGS)[keyof typeof MODEL_TAGS]): string {
  return `${getDojoConfig().namespace}-${tag}`
}

export function getTransactionExplorerUrl(transactionHash: string): string | null {
  switch (getDojoConfig().network) {
    case 'mainnet':
      return `https://voyager.online/tx/${transactionHash}`
    case 'sepolia':
      return `https://sepolia.voyager.online/tx/${transactionHash}`
    case 'katana':
      return null
  }
}
