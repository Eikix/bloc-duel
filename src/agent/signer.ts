import { Account, RpcProvider, type AccountInterface } from 'starknet'
import { fetchKatanaAccounts, getBurnerAddress } from '../dojo/burner'
import { normalizeAddress } from '../dojo/torii'
import type { AgentSignerConfig } from './types'

export interface ResolvedAgentSigner {
  account: AccountInterface
  address: string
}

function requireAddress(value: string | undefined, label: string): string {
  const normalized = normalizeAddress(value)
  if (normalized === '0x0') {
    throw new Error(`${label} is required`)
  }
  return normalized
}

export async function resolveAgentSigner(
  rpcUrl: string,
  signer: AgentSignerConfig,
): Promise<ResolvedAgentSigner> {
  if (signer.mode === 'session-key') {
    const address = requireAddress(
      signer.address ?? (signer.account as AccountInterface & { address?: string }).address,
      'Session key signer address',
    )
    return {
      account: signer.account,
      address,
    }
  }

  if (signer.mode === 'private-key') {
    const provider = new RpcProvider({ nodeUrl: rpcUrl })
    const address = requireAddress(signer.address, 'Private key signer address')
    return {
      account: new Account({
        provider,
        address,
        signer: signer.privateKey,
      }),
      address,
    }
  }

  const accounts = await fetchKatanaAccounts(rpcUrl)
  const selected = signer.address
    ? accounts.find((account) => normalizeAddress(getBurnerAddress(account)) === normalizeAddress(signer.address))
    : accounts[signer.burnerIndex ?? 0]

  if (!selected) {
    throw new Error('Unable to resolve the requested Katana burner account')
  }

  const address = requireAddress(getBurnerAddress(selected), 'Katana burner address')
  const privateKey = selected.private_key ?? selected.privateKey ?? selected.secret_key
  if (!privateKey) {
    throw new Error('Katana burner account is missing a private key')
  }

  const provider = new RpcProvider({ nodeUrl: rpcUrl })
  return {
    account: new Account({
      provider,
      address,
      signer: privateKey,
    }),
    address,
  }
}
