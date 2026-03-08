import { constants } from 'starknet'
import type { BlocDuelConfig, StarknetNetwork } from './config'

export interface BlocDuelSessionMethodPolicy {
  name: string
  entrypoint: string
  description?: string
  spender?: string
  amount?: string
  authorized?: boolean
}

export interface BlocDuelSessionPolicies {
  contracts?: Record<string, {
    name: string
    description?: string
    methods: BlocDuelSessionMethodPolicy[]
  }>
  messages?: unknown[]
}

export function getStarknetChainId(network: StarknetNetwork) {
  switch (network) {
    case 'mainnet':
      return constants.StarknetChainId.SN_MAIN
    case 'sepolia':
      return constants.StarknetChainId.SN_SEPOLIA
    case 'katana':
      return '0x4b4154414e41'
  }
}

export function getBlocDuelSessionPolicies(config: Pick<BlocDuelConfig, 'actionsAddress'>): BlocDuelSessionPolicies {
  return {
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
}
