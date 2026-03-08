import SessionProvider from '@cartridge/controller/session/node'
import { Account, RpcProvider, type AccountInterface } from 'starknet'
import type { BlocDuelConfig } from '../dojo/config'
import { fetchKatanaAccounts, getBurnerAddress } from '../dojo/burner'
import { getBlocDuelSessionPolicies, getStarknetChainId } from '../dojo/policies'
import { normalizeAddress } from '../dojo/torii'
import type { AgentSignerConfig } from './types'

export interface ResolvedAgentSigner {
  account: AccountInterface
  address: string
}

interface NodeSessionProvider {
  probe(): Promise<AccountInterface | undefined>
  connect(): Promise<AccountInterface | undefined>
}

function maybeWrapDebugAccount(account: AccountInterface) {
  if (process.env.BLOCDUEL_AGENT_DEBUG_TX !== '1' || typeof account.execute !== 'function') {
    return account
  }

  const original = account.execute.bind(account)
  account.execute = async (...args) => {
    console.error(
      '[agent-sdk] execute details',
      JSON.stringify(args[1], (_, value) => typeof value === 'bigint' ? `${value}n` : value),
    )
    return original(...args)
  }
  return account
}

function requireAddress(value: string | undefined, label: string): string {
  const normalized = normalizeAddress(value)
  if (normalized === '0x0') {
    throw new Error(`${label} is required`)
  }
  return normalized
}

export async function resolveAgentSigner(
  config: BlocDuelConfig,
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

  if (signer.mode === 'controller-session') {
    const sessionProvider = new (SessionProvider as unknown as new (options: {
      rpc: string
      chainId: string
      policies: unknown
      basePath: string
      keychainUrl?: string
    }) => NodeSessionProvider)({
      rpc: config.rpcUrl,
      chainId: getStarknetChainId(config.network),
      policies: signer.policies ?? getBlocDuelSessionPolicies(config),
      basePath: signer.basePath ?? process.env.BLOCDUEL_AGENT_SESSION_BASE_PATH ?? '.cartridge',
      keychainUrl: signer.keychainUrl ?? process.env.BLOCDUEL_AGENT_SESSION_KEYCHAIN_URL,
    })

    const account = await sessionProvider.probe() ?? await sessionProvider.connect()
    if (!account) {
      throw new Error('Unable to establish a Cartridge session. Complete the browser session flow and retry.')
    }

    const address = requireAddress(
      (account as AccountInterface & { address?: string }).address,
      'Controller session signer address',
    )

    return {
      account: maybeWrapDebugAccount(account),
      address,
    }
  }

  if (signer.mode === 'private-key') {
    const provider = new RpcProvider({ nodeUrl: config.rpcUrl })
    const address = requireAddress(signer.address, 'Private key signer address')
    return {
      account: maybeWrapDebugAccount(new Account({
        provider,
        address,
        signer: signer.privateKey,
      })),
      address,
    }
  }

  const accounts = await fetchKatanaAccounts(config.rpcUrl)
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

  const provider = new RpcProvider({ nodeUrl: config.rpcUrl })
  return {
    account: maybeWrapDebugAccount(new Account({
      provider,
      address,
      signer: privateKey,
    })),
    address,
  }
}
