import { create } from 'zustand'

export type TransactionStatus = 'pending' | 'success' | 'error'

export interface TransactionToast {
  id: number
  title: string
  description: string
  status: TransactionStatus
  txHash?: string
}

interface TransactionState {
  items: TransactionToast[]
  push: (title: string, description: string) => number
  markSubmitted: (id: number, txHash: string, description?: string) => void
  markSuccess: (id: number, description: string, txHash?: string) => void
  markError: (id: number, description: string) => void
  dismiss: (id: number) => void
}

const MAX_TOASTS = 4
const SUCCESS_DISMISS_MS = 5000
const ERROR_DISMISS_MS = 8000

let nextToastId = 1

function scheduleDismiss(id: number, delayMs: number) {
  globalThis.setTimeout(() => {
    useTransactionStore.getState().dismiss(id)
  }, delayMs)
}

export const useTransactionStore = create<TransactionState>((set) => ({
  items: [],

  push: (title, description) => {
    const id = nextToastId
    nextToastId += 1
    const nextItem: TransactionToast = { id, title, description, status: 'pending' }

    set((state) => ({
      items: [nextItem, ...state.items].slice(0, MAX_TOASTS),
    }))

    return id
  },

  markSubmitted: (id, txHash, description) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              txHash,
              description: description ?? item.description,
            }
          : item,
      ),
    }))
  },

  markSuccess: (id, description, txHash) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'success',
              description,
              txHash: txHash ?? item.txHash,
            }
          : item,
      ),
    }))

    scheduleDismiss(id, SUCCESS_DISMISS_MS)
  },

  markError: (id, description) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'error',
              description,
            }
          : item,
      ),
    }))

    scheduleDismiss(id, ERROR_DISMISS_MS)
  },

  dismiss: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }))
  },
}))
