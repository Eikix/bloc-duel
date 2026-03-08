import { DojoProvider } from '@dojoengine/core'
import { setupWorld } from '../../contracts/bindings/typescript/contracts.gen'
import * as torii from '@dojoengine/torii-client'
import { getDojoConfig } from './config'

export type BlocDuelWorld = ReturnType<typeof setupWorld>
export type BlocDuelRuntime = {
  config: ReturnType<typeof getDojoConfig>
  dojoProvider: DojoProvider
  world: BlocDuelWorld
  toriiClient: torii.ToriiClient
}

let sharedRuntime: BlocDuelRuntime | null = null
let sharedRuntimePromise: Promise<BlocDuelRuntime> | null = null
let sharedRuntimeUsers = 0
let sharedRuntimeDisposeTimer: ReturnType<typeof setTimeout> | null = null
let sharedRuntimeGeneration = 0

function compactAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-6)}`
}

function isZeroHash(value: string | null | undefined): boolean {
  if (!value) return true
  return /^0x0+$/i.test(value)
}

async function assertContractDeployment(
  provider: DojoProvider['provider'],
  address: string,
  expectedClassHash: string | undefined,
  label: string,
) {
  try {
    const classHash = await provider.getClassHashAt(address)
    if (isZeroHash(classHash)) {
      throw new Error(`${label} is not deployed`)
    }

    if (expectedClassHash && !isZeroHash(expectedClassHash) && classHash.toLowerCase() !== expectedClassHash.toLowerCase()) {
      throw new Error(
        `${label} class hash mismatch. Expected ${expectedClassHash}, got ${classHash}.`,
      )
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown deployment error'
    throw new Error(
      `${label} at ${compactAddress(address)} is not valid on the current chain. ${reason} If you just migrated locally, restart the frontend or pass fresh PUBLIC_WORLD_ADDRESS/PUBLIC_ACTIONS_ADDRESS values.`,
    )
  }
}

async function assertToriiReachable(toriiUrl: string) {
  const response = await fetch(`${toriiUrl}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'query { __typename }' }),
  })

  if (!response.ok) {
    throw new Error(`Torii responded with HTTP ${response.status}`)
  }
}

async function validateRuntime(dojoProvider: DojoProvider, toriiUrl: string) {
  const config = getDojoConfig()
  const actionsContract = config.manifest.contracts.find((contract) => contract.tag === 'bloc_duel-actions')

  try {
    await assertContractDeployment(
      dojoProvider.provider,
      config.worldAddress,
      config.manifest.world.class_hash,
      'Configured world contract',
    )
    await assertContractDeployment(
      dojoProvider.provider,
      config.actionsAddress,
      actionsContract?.class_hash,
      'Configured actions contract',
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to validate world deployment'
    throw new Error(message)
  }

  try {
    await assertToriiReachable(toriiUrl)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unable to reach Torii'
    throw new Error(
      `Torii is not reachable at ${toriiUrl}. ${reason} Start the full stack before using create/join.`,
    )
  }
}

async function createBlocDuelRuntime() {
  const config = getDojoConfig()
  const dojoProvider = new DojoProvider(config.manifest, config.rpcUrl)
  await validateRuntime(dojoProvider, config.toriiUrl)
  const world = setupWorld(dojoProvider)
  const toriiClient = await new torii.ToriiClient({
    toriiUrl: config.toriiUrl,
    worldAddress: config.worldAddress,
  })

  return {
    config,
    dojoProvider,
    world,
    toriiClient,
  }
}

export async function acquireBlocDuelRuntime() {
  if (sharedRuntimeDisposeTimer) {
    clearTimeout(sharedRuntimeDisposeTimer)
    sharedRuntimeDisposeTimer = null
  }

  if (sharedRuntime) {
    sharedRuntimeUsers += 1
    return sharedRuntime
  }

  if (!sharedRuntimePromise) {
    const generation = sharedRuntimeGeneration
    const pendingRuntime = createBlocDuelRuntime()
    const pendingRuntimePromise: Promise<BlocDuelRuntime> = pendingRuntime
      .then((runtime) => {
        if (generation !== sharedRuntimeGeneration) {
          runtime.toriiClient.free()
          throw new Error('Discarded stale Dojo runtime bootstrap')
        }

        sharedRuntime = runtime
        return runtime
      })
      .catch((error) => {
        if (sharedRuntimePromise === pendingRuntimePromise) {
          sharedRuntimePromise = null
        }
        throw error
      })

    sharedRuntimePromise = pendingRuntimePromise
  }

  const runtime = await sharedRuntimePromise
  sharedRuntimeUsers += 1
  return runtime
}

export function releaseBlocDuelRuntime(runtime: BlocDuelRuntime | null | undefined) {
  if (!runtime) return

  sharedRuntimeUsers = Math.max(0, sharedRuntimeUsers - 1)

  if (sharedRuntimeUsers > 0 || sharedRuntimeDisposeTimer) {
    return
  }

  // Give React StrictMode a chance to remount without double-bootstrapping Torii.
  sharedRuntimeDisposeTimer = setTimeout(() => {
    sharedRuntimeDisposeTimer = null

    if (sharedRuntimeUsers > 0) {
      return
    }

    const runtimeToDispose = sharedRuntime
    sharedRuntime = null
    sharedRuntimePromise = null
    runtimeToDispose?.toriiClient.free()
  }, 1500)
}

export function resetBlocDuelRuntime() {
  sharedRuntimeGeneration += 1
  sharedRuntimeUsers = 0

  if (sharedRuntimeDisposeTimer) {
    clearTimeout(sharedRuntimeDisposeTimer)
    sharedRuntimeDisposeTimer = null
  }

  const runtimeToDispose = sharedRuntime
  sharedRuntime = null
  sharedRuntimePromise = null
  runtimeToDispose?.toriiClient.free()
}
