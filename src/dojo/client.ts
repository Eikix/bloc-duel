import { DojoProvider } from '@dojoengine/core'
import { setupWorld } from '../../contracts/bindings/typescript/contracts.gen'
import * as torii from '@dojoengine/torii-client'
import { getDojoConfig } from './config'

export type BlocDuelWorld = ReturnType<typeof setupWorld>

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

export async function createBlocDuelRuntime() {
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

export type BlocDuelRuntime = Awaited<ReturnType<typeof createBlocDuelRuntime>>
