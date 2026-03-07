import { DojoProvider } from '@dojoengine/core'
import * as torii from '@dojoengine/torii-client'
import { getDojoConfig } from './config'
import { createBlocDuelWorld } from './world'

export type { BlocDuelWorld } from './world'

export async function createBlocDuelRuntime() {
  const config = getDojoConfig()
  const dojoProvider = new DojoProvider(config.manifest, config.rpcUrl)
  const world = createBlocDuelWorld(dojoProvider)
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
