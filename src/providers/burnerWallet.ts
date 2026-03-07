import { createContext, useContext } from 'react'

export interface BurnerWalletContextValue {
  burnerAddresses: string[]
  burnerIndex: number | null
  switchBurner: (index: number) => void
  cycleBurner: () => void
}

export const BurnerWalletContext = createContext<BurnerWalletContextValue>({
  burnerAddresses: [],
  burnerIndex: null,
  switchBurner: () => {},
  cycleBurner: () => {},
})

export function useBurnerWallet() {
  return useContext(BurnerWalletContext)
}
