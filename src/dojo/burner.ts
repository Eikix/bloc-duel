import { Account, RpcProvider } from 'starknet'

const BURNER_INDEX_SESSION_KEY = 'bloc-duel:burner-index'
const BURNER_INDEX_COUNTER_KEY = 'bloc-duel:next-burner-index'

export interface KatanaAccountPayload {
  address?: string
  account_address?: string
  private_key?: string
  privateKey?: string
  secret_key?: string
}

function normalizeAddress(address: string | undefined): string {
  if (!address) return '0x0'

  const normalized = address.toLowerCase()
  if (!normalized.startsWith('0x')) return '0x0'

  const body = normalized.slice(2).replace(/^0+/, '')
  return body.length > 0 ? `0x${body}` : '0x0'
}

export function getBurnerAddress(account: KatanaAccountPayload): string {
  return account.address ?? account.account_address ?? '0x0'
}

function getBurnerPrivateKey(account: KatanaAccountPayload): string | null {
  return account.private_key ?? account.privateKey ?? account.secret_key ?? null
}

export function pickBurnerIndex(accountCount: number): number {
  if (accountCount <= 1 || typeof window === 'undefined') return 0

  const sessionValue = window.sessionStorage.getItem(BURNER_INDEX_SESSION_KEY)
  const persistedIndex = sessionValue === null ? Number.NaN : Number(sessionValue)
  if (Number.isInteger(persistedIndex) && persistedIndex >= 0 && persistedIndex < accountCount) {
    return persistedIndex
  }

  const counterValue = Number(window.localStorage.getItem(BURNER_INDEX_COUNTER_KEY) ?? '0')
  const nextIndex = Number.isInteger(counterValue) && counterValue >= 0 ? counterValue % accountCount : 0

  window.sessionStorage.setItem(BURNER_INDEX_SESSION_KEY, String(nextIndex))
  window.localStorage.setItem(BURNER_INDEX_COUNTER_KEY, String((nextIndex + 1) % accountCount))

  return nextIndex
}

export function rememberBurnerIndex(index: number, accountCount: number) {
  if (accountCount <= 0 || typeof window === 'undefined') return

  const normalizedIndex = ((index % accountCount) + accountCount) % accountCount
  window.sessionStorage.setItem(BURNER_INDEX_SESSION_KEY, String(normalizedIndex))
  window.localStorage.setItem(BURNER_INDEX_COUNTER_KEY, String((normalizedIndex + 1) % accountCount))
}

export async function fetchKatanaAccounts(rpcUrl: string): Promise<KatanaAccountPayload[]> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'dev_predeployedAccounts',
      params: [],
    }),
  })

  const payload = await response.json() as {
    error?: { message?: string }
    result?: KatanaAccountPayload[]
  }

  if (!response.ok || payload.error || !payload.result || payload.result.length === 0) {
    throw new Error(payload.error?.message ?? 'Unable to fetch Katana burner accounts')
  }

  return payload.result
}

export async function resolveKatanaAccount(rpcUrl: string, preferredAddress?: string) {
  const provider = new RpcProvider({ nodeUrl: rpcUrl })
  const katanaAccounts = await fetchKatanaAccounts(rpcUrl)

  const selected = preferredAddress
    ? katanaAccounts.find((entry) => normalizeAddress(getBurnerAddress(entry)) === normalizeAddress(preferredAddress))
    : katanaAccounts[pickBurnerIndex(katanaAccounts.length)]

  const burner = selected ?? katanaAccounts[0]
  if (!burner) {
    throw new Error('Unable to resolve a Katana burner account')
  }

  const address = getBurnerAddress(burner)
  const privateKey = getBurnerPrivateKey(burner)

  if (!privateKey) {
    throw new Error('Katana burner account is missing a private key in dev_predeployedAccounts response')
  }

  return new Account({
    provider,
    address,
    signer: privateKey,
  })
}
