#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import {
  agentStrategyNames,
  createAgentClient,
  formatAgentAction,
  getExplorerUrl,
  getSnapshotVersion,
  type AgentAction,
  type AgentClientOptions,
  type AgentPolicy,
  type BlocDuelAgent,
  type AgentSignerConfig,
} from './index'

type ChooseSystemBonusAction = Extract<AgentAction, { kind: 'choose_system_bonus' }>

interface CliOptions {
  json: boolean
  network?: 'katana' | 'sepolia' | 'mainnet'
  rpcUrl?: string
  toriiUrl?: string
  worldAddress?: string
  actionsAddress?: string
  namespace?: string
  policyFile?: string
  signerMode?: AgentSignerConfig['mode']
  burnerIndex?: number
  burnerA?: number
  burnerB?: number
  accountAddress?: string
  privateKey?: string
  strategy?: string
  strategyA?: string
  strategyB?: string
  intervalMs?: number
  maxActions?: number
  maxIdlePolls?: number
}

function fail(message: string): never {
  throw new Error(message)
}

function parseNumber(value: string | undefined, label: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    fail(`${label} must be a number`)
  }
  return parsed
}

function parseOptions(args: string[]) {
  const options: CliOptions = { json: false }
  const positionals: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }

    const value = args[index + 1]
    switch (token) {
      case '--json':
        options.json = true
        break
      case '--network':
        options.network = value as CliOptions['network']
        index += 1
        break
      case '--rpc-url':
        options.rpcUrl = value
        index += 1
        break
      case '--torii-url':
        options.toriiUrl = value
        index += 1
        break
      case '--world-address':
        options.worldAddress = value
        index += 1
        break
      case '--actions-address':
        options.actionsAddress = value
        index += 1
        break
      case '--namespace':
        options.namespace = value
        index += 1
        break
      case '--policy-file':
        options.policyFile = value
        index += 1
        break
      case '--signer-mode':
        options.signerMode = value as AgentSignerConfig['mode']
        index += 1
        break
      case '--burner-index':
        options.burnerIndex = parseNumber(value, 'burner index')
        index += 1
        break
      case '--burner-a':
        options.burnerA = parseNumber(value, 'burner-a')
        index += 1
        break
      case '--burner-b':
        options.burnerB = parseNumber(value, 'burner-b')
        index += 1
        break
      case '--account-address':
        options.accountAddress = value
        index += 1
        break
      case '--private-key':
        options.privateKey = value
        index += 1
        break
      case '--strategy':
        options.strategy = value
        index += 1
        break
      case '--strategy-a':
        options.strategyA = value
        index += 1
        break
      case '--strategy-b':
        options.strategyB = value
        index += 1
        break
      case '--interval-ms':
        options.intervalMs = parseNumber(value, 'interval-ms')
        index += 1
        break
      case '--max-actions':
        options.maxActions = parseNumber(value, 'max-actions')
        index += 1
        break
      case '--max-idle-polls':
        options.maxIdlePolls = parseNumber(value, 'max-idle-polls')
        index += 1
        break
      default:
        fail(`Unknown option: ${token}`)
    }
  }

  return { options, positionals }
}

function pickEnv(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0)
}

function loadPolicy(policyFile: string | undefined): AgentPolicy | null {
  if (!policyFile) return null
  return JSON.parse(readFileSync(policyFile, 'utf8')) as AgentPolicy
}

function isLocalTarget(options: CliOptions): boolean {
  const network = options.network ?? pickEnv(process.env.BLOCDUEL_AGENT_NETWORK)
  if (network === 'katana') return true

  const urls = [options.rpcUrl, options.toriiUrl, process.env.BLOCDUEL_AGENT_RPC_URL, process.env.BLOCDUEL_AGENT_TORII_URL]
  return urls.some((value) => value?.includes('127.0.0.1') || value?.includes('localhost'))
}

function resolveSigner(options: CliOptions, mutating: boolean): AgentSignerConfig | undefined {
  const signerMode = options.signerMode ?? pickEnv(process.env.BLOCDUEL_AGENT_SIGNER_MODE) as AgentSignerConfig['mode'] | undefined
  const address = options.accountAddress ?? pickEnv(process.env.BLOCDUEL_AGENT_ACCOUNT_ADDRESS)
  const privateKey = options.privateKey ?? pickEnv(process.env.BLOCDUEL_AGENT_PRIVATE_KEY)

  if (!mutating && !signerMode && !address && !privateKey) {
    return undefined
  }

  if (!signerMode && address && privateKey) {
    return { mode: 'private-key', address, privateKey }
  }

  if ((signerMode ?? (isLocalTarget(options) ? 'katana-burner' : undefined)) === 'katana-burner') {
    return {
      mode: 'katana-burner',
      burnerIndex: options.burnerIndex ?? Number(process.env.BLOCDUEL_AGENT_BURNER_INDEX ?? 0),
    }
  }

  if (signerMode === 'private-key') {
    if (!address || !privateKey) {
      fail('private-key mode requires --account-address and --private-key')
    }
    return { mode: 'private-key', address, privateKey }
  }

  if (!mutating) {
    return undefined
  }

  fail('Mutating commands require a signer. Use local Katana, or pass --signer-mode private-key with credentials.')
}

function buildClientOptions(options: CliOptions, mutating: boolean): AgentClientOptions {
  return {
    network: options.network,
    rpcUrl: options.rpcUrl ?? pickEnv(process.env.BLOCDUEL_AGENT_RPC_URL),
    toriiUrl: options.toriiUrl ?? pickEnv(process.env.BLOCDUEL_AGENT_TORII_URL),
    worldAddress: options.worldAddress ?? pickEnv(process.env.BLOCDUEL_AGENT_WORLD_ADDRESS),
    actionsAddress: options.actionsAddress ?? pickEnv(process.env.BLOCDUEL_AGENT_ACTIONS_ADDRESS),
    namespace: options.namespace ?? pickEnv(process.env.BLOCDUEL_AGENT_NAMESPACE),
    signer: resolveSigner(options, mutating),
    policy: loadPolicy(options.policyFile ?? pickEnv(process.env.BLOCDUEL_AGENT_POLICY_FILE)),
  }
}

function print(value: unknown, asJson: boolean) {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2))
    return
  }

  console.log(String(value))
}

type AgentSnapshot = Awaited<ReturnType<BlocDuelAgent['getMatch']>>
type AgentMatches = Awaited<ReturnType<BlocDuelAgent['listMatches']>>

function renderMatches(matches: AgentMatches) {
  if (matches.length === 0) return 'No matches found.'
  return matches
    .map((match) => `#${match.gameId}  ${match.phase.padEnd(14)}  ${match.playerOne}  ${match.playerTwo}`)
    .join('\n')
}

function renderSnapshot(snapshot: AgentSnapshot) {
  if (!snapshot) return 'Match not found.'

  const legal = snapshot.systemBonusChoice
    ? `pending choice: ${snapshot.systemBonusChoice.options.join(', ')}`
    : `pyramid open: ${snapshot.pyramid.filter((node) => !node.taken).length}`

  return [
    `Match #${snapshot.gameId}  ${snapshot.phase}  Age ${snapshot.age}`,
    `Current player: ${snapshot.currentPlayer === 0 ? snapshot.players[0].name : snapshot.players[1].name}`,
    `Atlantic: cap ${snapshot.players[0].capital}, agi ${snapshot.agiTrack[0]}, heroes ${snapshot.players[0].heroCount}, systems ${snapshot.players[0].systems.join(', ') || '-'}`,
    `Continental: cap ${snapshot.players[1].capital}, agi ${snapshot.agiTrack[1]}, heroes ${snapshot.players[1].heroCount}, systems ${snapshot.players[1].systems.join(', ') || '-'}`,
    `Escalation: ${snapshot.escalationTrack}`,
    `State: ${legal}`,
    snapshot.winner === null ? 'Winner: pending' : `Winner: ${snapshot.winner} (${snapshot.winCondition})`,
  ].join('\n')
}

function usage() {
  return [
    'Usage:',
    '  matches list [--json]',
    '  matches open [--json]',
    '  match create [--json]',
    '  match join <id> [--json]',
    '  match show <id> [--json]',
    '  match legal <id> [--json]',
    '  match act <id> <play|discard|hero|bonus|next-age|join> [value] [--json]',
    '  match play <id> [--strategy balanced] [--max-actions 200] [--json]',
    '  match selfplay [--strategy-a balanced] [--strategy-b balanced] [--burner-a 0] [--burner-b 1] [--json]',
    '  match watch <id> [--interval-ms 1000] [--json]',
    '',
    `Strategies: ${agentStrategyNames.join(', ')}`,
  ].join('\n')
}

function parseAction(matchId: number, verb: string | undefined, value: string | undefined): AgentAction {
  switch (verb) {
    case 'play':
      return { kind: 'play_card', gameId: matchId, position: parseNumber(value, 'position') }
    case 'discard':
      return { kind: 'discard_card', gameId: matchId, position: parseNumber(value, 'position') }
    case 'hero':
      return { kind: 'invoke_hero', gameId: matchId, slot: parseNumber(value, 'hero slot') as 0 | 1 | 2 }
    case 'bonus':
      return { kind: 'choose_system_bonus', gameId: matchId, symbol: String(value).toUpperCase() as ChooseSystemBonusAction['symbol'] }
    case 'next-age':
      return { kind: 'next_age', gameId: matchId }
    case 'join':
      return { kind: 'join_game', gameId: matchId }
    default:
      fail(`Unknown action verb: ${verb}`)
  }
}

async function main() {
  const { options, positionals } = parseOptions(process.argv.slice(2))
  const [scope, command, ...rest] = positionals

  if (!scope) {
    print(usage(), false)
    return
  }

  if (scope === 'matches' && command === 'list') {
    const client = await createAgentClient(buildClientOptions(options, false))
    try {
      const matches = await client.listMatches()
      print(options.json ? matches : renderMatches(matches), options.json)
    } finally {
      client.close()
    }
    return
  }

  if (scope === 'matches' && command === 'open') {
    const client = await createAgentClient(buildClientOptions(options, false))
    try {
      const matches = await client.listJoinableMatches()
      print(options.json ? matches : renderMatches(matches), options.json)
    } finally {
      client.close()
    }
    return
  }

  if (scope !== 'match') {
    fail(usage())
  }

  if (command === 'selfplay') {
    const client = await createAgentClient(buildClientOptions(options, true))
    try {
      const result = await client.selfPlay({
        strategyA: options.strategyA ?? options.strategy ?? 'balanced',
        strategyB: options.strategyB ?? options.strategy ?? 'balanced',
        burnerA: options.burnerA,
        burnerB: options.burnerB,
        maxActions: options.maxActions,
        maxIdlePolls: options.maxIdlePolls,
        pollIntervalMs: options.intervalMs,
      })
      const payload = {
        matchId: result.matchId,
        turns: result.turns,
        finalSnapshot: result.finalSnapshot,
      }
      print(options.json ? payload : renderSnapshot(result.finalSnapshot), options.json)
    } finally {
      client.close()
    }
    return
  }

  const matchId = rest[0] ? parseNumber(rest[0], 'match id') : undefined
  const mutating = command === 'create' || command === 'join' || command === 'act' || command === 'play'
  const client = await createAgentClient(buildClientOptions(options, mutating))

  try {
    if (command === 'create') {
      const created = await client.createMatch()
      const payload = {
        ...created,
        explorerUrl: getExplorerUrl(created.txHash),
      }
      if (options.json) print(payload, true)
      else console.log(`Created match: ${created.matchId ?? 'pending index'}${created.txHash ? `\nTx: ${created.txHash}` : ''}`)
      return
    }

    if (matchId === undefined) {
      fail('match id is required')
    }

    if (command === 'join') {
      const joined = await client.joinMatch(matchId)
      if (options.json) print(joined, true)
      else console.log(renderSnapshot(joined.snapshot))
      return
    }

    if (command === 'show') {
      const snapshot = await client.getMatch(matchId)
      print(options.json ? snapshot : renderSnapshot(snapshot), options.json)
      return
    }

    if (command === 'legal') {
      const actions = await client.getLegalActions(matchId)
      print(options.json ? actions : actions.map(formatAgentAction).join('\n') || 'No legal actions.', options.json)
      return
    }

    if (command === 'act') {
      const action = parseAction(matchId, rest[1], rest[2])
      const result = await client.submitAction(matchId, action)
      if (options.json) print(result, true)
      else console.log([
        `Action: ${formatAgentAction(action)}`,
        result.txHash ? `Tx: ${result.txHash}` : 'Tx: dry-run',
        getExplorerUrl(result.txHash) ? `Explorer: ${getExplorerUrl(result.txHash)}` : null,
        renderSnapshot(result.snapshot),
      ].filter(Boolean).join('\n'))
      return
    }

    if (command === 'play') {
      const result = await client.playMatch(matchId, options.strategy ?? 'balanced', {
        pollIntervalMs: options.intervalMs,
        maxActions: options.maxActions,
        maxIdlePolls: options.maxIdlePolls,
      })
      if (options.json) print(result, true)
      else console.log(renderSnapshot(result.finalSnapshot))
      return
    }

    if (command === 'watch') {
      let snapshot = await client.getMatch(matchId)
      let version = getSnapshotVersion(snapshot)
      print(options.json ? snapshot : renderSnapshot(snapshot), options.json)

      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, options.intervalMs ?? 1000))
        const updated = await client.getMatch(matchId)
        const nextVersion = getSnapshotVersion(updated)
        if (nextVersion !== version) {
          version = nextVersion
          snapshot = updated
          print(options.json ? snapshot : `\n${renderSnapshot(snapshot)}`, options.json)
        }
      }
    }

    fail(usage())
  } finally {
    client.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
