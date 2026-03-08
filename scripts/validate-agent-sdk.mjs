#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'

const rpcUrl = process.env.BLOCDUEL_AGENT_RPC_URL ?? 'http://127.0.0.1:5050'
const toriiUrl = process.env.BLOCDUEL_AGENT_TORII_URL ?? 'http://127.0.0.1:8080'
const worldAddress = process.env.BLOCDUEL_AGENT_WORLD_ADDRESS ?? readFileSync('.data/world_address.txt', 'utf8').trim()
const selfPlayRuns = Number(process.env.BLOCDUEL_AGENT_VALIDATE_GAMES ?? 12)
const maxActions = Number(process.env.BLOCDUEL_AGENT_VALIDATE_MAX_ACTIONS ?? 300)
const commandTimeoutMs = Number(process.env.BLOCDUEL_AGENT_VALIDATE_TIMEOUT_MS ?? 600_000)

const baseArgs = ['--no-warnings', 'dist-agent/cli.js', '--rpc-url', rpcUrl, '--torii-url', toriiUrl, '--world-address', worldAddress]

function logStep(message) {
  console.error(`[validate-agent-sdk] ${message}`)
}

function fail(message, details) {
  console.error(message)
  if (details) console.error(details)
  process.exit(1)
}

function assert(condition, message, details) {
  if (!condition) fail(message, details)
}

function parseJson(stdout, context) {
  try {
    return JSON.parse(stdout)
  } catch (error) {
    fail(`Failed to parse JSON for ${context}`, stdout || String(error))
  }
}

function runCli(args, options = {}) {
  const cliArgs = [...baseArgs]
  if (options.burnerIndex !== undefined) {
    cliArgs.push('--burner-index', String(options.burnerIndex))
  }
  cliArgs.push(...args)

  logStep(`run ${args.join(' ')}${options.burnerIndex !== undefined ? ` (burner ${options.burnerIndex})` : ''}`)

  const result = spawnSync('node', cliArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: options.timeoutMs ?? commandTimeoutMs,
    killSignal: 'SIGKILL',
  })

  if (result.error?.name === 'Error' && /ETIMEDOUT/.test(result.error.message)) {
    fail(
      `Command timed out after ${options.timeoutMs ?? commandTimeoutMs}ms: node ${cliArgs.join(' ')}`,
      result.stderr || result.stdout,
    )
  }

  if (result.signal === 'SIGKILL' && result.status === null) {
    fail(
      `Command was killed after exceeding timeout: node ${cliArgs.join(' ')}`,
      result.stderr || result.stdout,
    )
  }

  if (result.status !== 0) {
    fail(`Command failed: node ${cliArgs.join(' ')}`, result.stderr || result.stdout)
  }

  return options.json === false ? result.stdout : parseJson(result.stdout, args.join(' '))
}

function toActArgs(action) {
  switch (action.kind) {
    case 'join_game':
      return ['join']
    case 'play_card':
      return ['play', String(action.position)]
    case 'discard_card':
      return ['discard', String(action.position)]
    case 'invoke_hero':
      return ['hero', String(action.slot)]
    case 'choose_system_bonus':
      return ['bonus', action.symbol]
    case 'next_age':
      return ['next-age']
    default:
      fail(`Unsupported action kind in validator: ${action.kind}`)
  }
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function stopProcess(proc) {
  proc.kill('SIGTERM')
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      proc.kill('SIGKILL')
      resolve()
    }, 2_000)

    proc.once('close', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function testWatch(matchId, burnerIndex) {
  logStep(`watch match ${matchId} (burner ${burnerIndex})`)
  const proc = spawn(
    'node',
    [...baseArgs, '--burner-index', String(burnerIndex), 'match', 'watch', String(matchId)],
    { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] },
  )

  let stdout = ''
  proc.stdout.on('data', (chunk) => {
    stdout += String(chunk)
  })

  const startedAt = Date.now()
  while (!stdout.includes(`Match #${matchId}`) && Date.now() - startedAt < 10_000) {
    await wait(200)
  }
  assert(stdout.includes(`Match #${matchId}`), 'Watch command did not print initial snapshot', stdout)

  const before = stdout
  const legal = runCli(['match', 'legal', String(matchId), '--json'], { burnerIndex })
  assert(Array.isArray(legal) && legal.length > 0, 'Expected legal actions while testing watch')
  runCli(['match', 'act', String(matchId), ...toActArgs(legal[0]), '--json'], { burnerIndex })

  const changedAt = Date.now()
  while (stdout === before && Date.now() - changedAt < 15_000) {
    await wait(200)
  }

  await stopProcess(proc)
  assert(stdout !== before, 'Watch command did not emit an update after a state change', stdout)
}

function summarize(result, strategyA, strategyB) {
  const finalSnapshot = result.finalSnapshot ?? result.final
  return {
    matchId: result.matchId,
    strategyA,
    strategyB,
    turns: result.turns,
    phase: finalSnapshot?.phase ?? null,
    age: finalSnapshot?.age ?? null,
    winner: finalSnapshot?.winner ?? null,
    winCondition: finalSnapshot?.winCondition ?? null,
  }
}

async function main() {
  logStep(`start validation with ${selfPlayRuns} self-play matches`)
  const smoke = {}

  smoke.beforeMatches = runCli(['matches', 'list', '--json']).length

  const created = runCli(['match', 'create', '--json'], { burnerIndex: 0 })
  assert(created.matchId, 'Expected match create to return a match id')
  assert(created.snapshot?.phase === 'LOBBY', 'Expected created match to start in LOBBY', JSON.stringify(created))
  smoke.createdMatchId = created.matchId

  const openMatches = runCli(['matches', 'open', '--json'], { burnerIndex: 1 })
  assert(openMatches.some((match) => match.gameId === created.matchId), 'Expected open matches to include created match')

  const joined = runCli(['match', 'join', String(created.matchId), '--json'], { burnerIndex: 1 })
  assert(joined.snapshot?.phase === 'DRAFTING', 'Expected joined match to enter DRAFTING')

  const shown = runCli(['match', 'show', String(created.matchId), '--json'], { burnerIndex: 0 })
  assert(shown.gameId === created.matchId, 'Expected match show to return the created match')

  let activeBurner = joined.snapshot.currentPlayer
  const legalA = runCli(['match', 'legal', String(created.matchId), '--json'], { burnerIndex: activeBurner })
  assert(Array.isArray(legalA) && legalA.length > 0, 'Expected legal actions for active player after join')

  const acted = runCli(['match', 'act', String(created.matchId), ...toActArgs(legalA[0]), '--json'], { burnerIndex: activeBurner })
  assert(acted.snapshot?.gameId === created.matchId, 'Expected match act to return updated snapshot')
  activeBurner = acted.snapshot.currentPlayer

  await testWatch(created.matchId, activeBurner)
  activeBurner = 1 - activeBurner

  const played = runCli(
    ['match', 'play', String(created.matchId), '--strategy', 'balanced', '--max-actions', '1', '--json'],
    { burnerIndex: activeBurner },
  )
  assert(Array.isArray(played.actions), 'Expected match play to return action history')

  const createdViaAct = runCli(['match', 'create', '--json'], { burnerIndex: 0 })
  const joinedViaAct = runCli(['match', 'act', String(createdViaAct.matchId), 'join', '--json'], { burnerIndex: 1 })
  assert(joinedViaAct.snapshot?.phase === 'DRAFTING', 'Expected match act join to work')

  const strategies = [
    ['balanced', 'balanced'],
    ['greedy-agi', 'balanced'],
    ['greedy-escalation', 'systems-first'],
    ['systems-first', 'balanced'],
    ['random', 'balanced'],
    ['balanced', 'greedy-agi'],
  ]

  const runs = []
  for (let index = 0; index < selfPlayRuns; index += 1) {
    const [strategyA, strategyB] = strategies[index % strategies.length]
    logStep(`self-play ${index + 1}/${selfPlayRuns}: ${strategyA} vs ${strategyB}`)
    const result = runCli(
      [
        'match',
        'selfplay',
        '--strategy-a',
        strategyA,
        '--strategy-b',
        strategyB,
        '--max-actions',
        String(maxActions),
        '--json',
      ],
      { burnerIndex: 0, timeoutMs: commandTimeoutMs },
    )

    const summary = summarize(result, strategyA, strategyB)
    assert(summary.phase === 'GAME_OVER', 'Expected selfplay match to finish', JSON.stringify(summary))
    runs.push(summary)
    logStep(`completed self-play ${index + 1}/${selfPlayRuns}: match ${summary.matchId} -> ${summary.winCondition}`)
  }

  const winConditions = Object.fromEntries(
    runs.reduce((map, run) => {
      map.set(run.winCondition, (map.get(run.winCondition) ?? 0) + 1)
      return map
    }, new Map()),
  )

  console.log(JSON.stringify({
    smoke,
    selfPlayRuns: runs.length,
    winConditions,
    runs,
  }, null, 2))
}

await main()
