import type { AccountInterface, RpcProvider } from 'starknet'
import type { StarknetNetwork } from './config'

const KATANA_WAIT_OPTIONS = { retries: 40, retryInterval: 250 } as const

type PreparedTransactionWait = {
  address: string
  nonce: string
}

function getAccountAddress(account: AccountInterface): string | null {
  const address = (account as AccountInterface & { address?: string }).address
  return typeof address === 'string' && address.length > 0 ? address : null
}

function getReceiptField(receipt: unknown, key: 'execution_status' | 'finality_status' | 'revert_reason') {
  const value = (receipt as Record<string, unknown> | null)?.[key]
  return typeof value === 'string' ? value : null
}

function assertSuccessfulReceipt(receipt: unknown, transactionHash: string) {
  const executionStatus = getReceiptField(receipt, 'execution_status')
  if (executionStatus && executionStatus !== 'SUCCEEDED') {
    const revertReason = getReceiptField(receipt, 'revert_reason')
    const reason = revertReason ? ` ${revertReason}` : ''
    throw new Error(`Transaction ${transactionHash} failed with ${executionStatus}.${reason}`.trim())
  }

  if (getReceiptField(receipt, 'finality_status') === 'REJECTED') {
    throw new Error(`Transaction ${transactionHash} was rejected`)
  }
}

export async function prepareTransactionWait(
  network: StarknetNetwork,
  account: AccountInterface,
): Promise<PreparedTransactionWait | null> {
  if (network !== 'katana') return null

  const address = getAccountAddress(account)
  if (!address) return null

  return {
    address,
    nonce: await account.getNonce(),
  }
}

export async function waitForAcceptedTransaction(
  network: StarknetNetwork,
  rpcProvider: RpcProvider,
  transactionHash: string,
  prepared: PreparedTransactionWait | null = null,
) {
  if (network === 'katana' && prepared) {
    try {
      const ready = await rpcProvider.fastWaitForTransaction(
        transactionHash,
        prepared.address,
        prepared.nonce,
        KATANA_WAIT_OPTIONS,
      )

      if (ready) {
        const receipt = await rpcProvider.getTransactionReceipt(transactionHash)
        assertSuccessfulReceipt(receipt, transactionHash)
        return receipt
      }
    } catch {
      // Fall through to the standard receipt wait path.
    }
  }

  const receipt = await rpcProvider.waitForTransaction(
    transactionHash,
    network === 'katana' ? { retryInterval: KATANA_WAIT_OPTIONS.retryInterval } : undefined,
  )
  assertSuccessfulReceipt(receipt, transactionHash)
  return receipt
}
