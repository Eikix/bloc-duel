import { DojoProvider } from '@dojoengine/core'
import type { DojoCall } from '@dojoengine/core'
import type { Account, AccountInterface, BigNumberish, CairoCustomEnum } from 'starknet'

async function executeAction(
  provider: DojoProvider,
  account: Account | AccountInterface,
  entrypoint: string,
  calldata: DojoCall['calldata'],
) {
  return provider.execute(
    account,
    {
      contractName: 'actions',
      entrypoint,
      calldata,
    },
    'bloc_duel',
    { tip: 0 },
  )
}

export function createBlocDuelWorld(provider: DojoProvider) {
  return {
    actions: {
      chooseSystemBonus: (
        account: Account | AccountInterface,
        gameId: BigNumberish,
        symbol: CairoCustomEnum,
      ) => executeAction(provider, account, 'choose_system_bonus', [gameId, symbol]),
      createGame: (account: Account | AccountInterface) => executeAction(provider, account, 'create_game', []),
      discardCard: (account: Account | AccountInterface, gameId: BigNumberish, position: BigNumberish) =>
        executeAction(provider, account, 'discard_card', [gameId, position]),
      invokeHero: (account: Account | AccountInterface, gameId: BigNumberish, heroSlot: BigNumberish) =>
        executeAction(provider, account, 'invoke_hero', [gameId, heroSlot]),
      joinGame: (account: Account | AccountInterface, gameId: BigNumberish) =>
        executeAction(provider, account, 'join_game', [gameId]),
      nextAge: (account: Account | AccountInterface, gameId: BigNumberish) =>
        executeAction(provider, account, 'next_age', [gameId]),
      playCard: (account: Account | AccountInterface, gameId: BigNumberish, position: BigNumberish) =>
        executeAction(provider, account, 'play_card', [gameId, position]),
    },
  }
}

export type BlocDuelWorld = ReturnType<typeof createBlocDuelWorld>
