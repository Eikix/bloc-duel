import devManifest from '../../contracts/manifest_dev.json'
import mainnetManifest from '../../contracts/manifest_mainnet.json'

const ACTIONS_TAG = 'bloc_duel-actions'
const LOCAL_NODE_URL = 'http://127.0.0.1:5050'
const LOCAL_TORII_URL = 'http://127.0.0.1:8080'

export type StarknetNetwork = 'katana' | 'sepolia' | 'mainnet'
export type WalletMode = 'burner' | 'controller'
type DojoManifestProfile = 'dev' | 'mainnet'
type EnvBag = Record<string, string | undefined>

const MANIFESTS = {
  dev: devManifest,
  mainnet: mainnetManifest,
} as const

const DEFAULT_RPC_URLS: Record<StarknetNetwork, string> = {
  katana: LOCAL_NODE_URL,
  sepolia: 'https://api.cartridge.gg/x/starknet/sepolia',
  mainnet: 'https://api.cartridge.gg/x/starknet/mainnet',
}

function pickEnv(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value && value.trim().length > 0)
}

function getImportMetaEnv(): EnvBag {
  return ((import.meta as ImportMeta & { env?: EnvBag }).env ?? {})
}

function getProcessEnv(): EnvBag {
  const scope = globalThis as { process?: { env?: EnvBag } }
  return scope.process?.env ?? {}
}

function readEnv(...keys: string[]): string | undefined {
  const importMetaEnv = getImportMetaEnv()
  const processEnv = getProcessEnv()
  return pickEnv(
    ...keys.map((key) => importMetaEnv[key]),
    ...keys.map((key) => processEnv[key]),
  )
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

function normalizeManifestProfile(value: string | undefined): DojoManifestProfile | undefined {
  switch (value?.trim().toLowerCase()) {
    case 'dev':
    case 'local':
    case 'katana':
      return 'dev'
    case 'mainnet':
      return 'mainnet'
    default:
      return undefined
  }
}

function inferNetwork(rpcUrlHint: string | undefined, toriiUrl: string): StarknetNetwork {
  const hintedNetwork = normalizeNetworkHint(
    pickEnv(
      readEnv(
        'VITE_PUBLIC_STARKNET_NETWORK',
        'PUBLIC_STARKNET_NETWORK',
        'VITE_PUBLIC_DEPLOY_TYPE',
        'PUBLIC_DEPLOY_TYPE',
      ),
    ),
  )

  if (hintedNetwork) return hintedNetwork
  if (isLocalUrl(rpcUrlHint) || isLocalUrl(toriiUrl)) return 'katana'
  if (rpcUrlHint?.includes('sepolia') || toriiUrl.includes('sepolia')) return 'sepolia'
  if (rpcUrlHint?.includes('mainnet') || toriiUrl.includes('mainnet')) return 'mainnet'
  return 'mainnet'
}

function getWalletMode(network: StarknetNetwork): WalletMode {
  return network === 'katana' ? 'burner' : 'controller'
}

export interface BlocDuelConfigOverride {
  network?: StarknetNetwork
  walletMode?: WalletMode
  rpcUrl?: string
  toriiUrl?: string
  worldAddress?: string
  actionsAddress?: string
  namespace?: string
  slot?: string
  manifestProfile?: DojoManifestProfile
}

function buildDojoConfig(overrides: BlocDuelConfigOverride = {}) {
  const toriiUrl = trimTrailingSlash(
    pickEnv(
      overrides.toriiUrl,
      readEnv('VITE_PUBLIC_TORII_URL', 'PUBLIC_TORII_URL', 'VITE_PUBLIC_TORII', 'PUBLIC_TORII'),
      LOCAL_TORII_URL,
    )!,
  )

  const rpcUrlHint = pickEnv(overrides.rpcUrl, readEnv('VITE_PUBLIC_NODE_URL', 'PUBLIC_NODE_URL'))

  const network = overrides.network ?? inferNetwork(rpcUrlHint, toriiUrl)
  const manifestProfile = overrides.manifestProfile ?? normalizeManifestProfile(
    pickEnv(
      readEnv('VITE_PUBLIC_DOJO_MANIFEST_PROFILE', 'PUBLIC_DOJO_MANIFEST_PROFILE'),
    ),
  ) ?? (network === 'mainnet' ? 'mainnet' : 'dev')
  const baseManifest = MANIFESTS[manifestProfile]
  const rpcUrl = pickEnv(rpcUrlHint, DEFAULT_RPC_URLS[network])!
  const walletMode = overrides.walletMode ?? getWalletMode(network)

  const worldAddress = pickEnv(
    overrides.worldAddress,
    readEnv('VITE_PUBLIC_WORLD_ADDRESS', 'PUBLIC_WORLD_ADDRESS'),
    baseManifest.world.address,
  )!

  const actionsAddress = pickEnv(
    overrides.actionsAddress,
    readEnv('VITE_PUBLIC_ACTIONS_ADDRESS', 'PUBLIC_ACTIONS_ADDRESS'),
    baseManifest.contracts.find((contract) => contract.tag === ACTIONS_TAG)?.address,
  )!

  const namespace = pickEnv(
    overrides.namespace,
    readEnv('VITE_PUBLIC_NAMESPACE', 'PUBLIC_NAMESPACE'),
    'bloc_duel',
  )!

  const slot = pickEnv(overrides.slot, readEnv('VITE_PUBLIC_SLOT', 'PUBLIC_SLOT'))

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

export function resolveDojoConfig(overrides: BlocDuelConfigOverride = {}) {
  return buildDojoConfig(overrides)
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

export function resolveNamespacedModelTag(
  tag: (typeof MODEL_TAGS)[keyof typeof MODEL_TAGS],
  namespace: string = getDojoConfig().namespace,
): string {
  return `${namespace}-${tag}`
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
