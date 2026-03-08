# BLOC:DUEL

A two-player strategy card game set in a near-future geopolitical conflict. Draft cards from a shared pyramid, build your engine, and race to one of three victory conditions.

## Development

Requires [Nix](https://nixos.org/) with flakes enabled. The dev environment provides all tools (Node.js, Katana, Torii, Sozo, Scarb).

The same Nix entrypoints work on Linux and macOS through native `cairo-nix` packages.

### Mode 1: Local Dev (Katana + Torii + Vite)

Full local stack — spins up a local Starknet devnet, deploys contracts, starts the indexer, and runs the frontend.

```bash
nix run .#start
```

What it does:
- Starts Katana devnet (port 5050)
- Builds & migrates Dojo contracts to Katana
- Starts Torii indexer (port 8080)
- Installs npm deps if needed
- Starts Vite dev server (port 5173)
- Uses local Katana burner accounts instead of Cartridge Controller

**When to use:** Day-to-day local development. No mainnet costs, fast iteration.

### Mode 2: Mainnet + Local Torii

Runs a local Torii instance indexing mainnet contracts. No Katana — reads from real Starknet.

```bash
nix run .#start-mainnet
```

What it does:
- Validates `contracts/dojo_mainnet.toml` (world address, manifest)
- Starts Torii indexing mainnet (port 8080)
- Installs npm deps if needed
- Starts Vite dev server (port 5173)

**Prerequisites:** Deploy contracts to mainnet first, set `world_address` and `world_block` in `contracts/dojo_mainnet.toml`.

**When to use:** Pre-production testing against real on-chain state.

### Mode 3: Mainnet + Remote Torii

Frontend only — connects to a remote Torii instance. Nothing local except the dev server.

```bash
nix run .#start-mainnet-torii
```

What it does:
- Installs npm deps if needed
- Starts Vite dev server (port 5173)

**Prerequisites:** Set `PUBLIC_TORII_URL` env var pointing to your hosted Torii.

**When to use:** Production-like setup, connecting to a hosted Torii indexer.

### Mode Comparison

| | Mode 1 (Local) | Mode 2 (Mainnet-Local) | Mode 3 (Remote Torii) |
|---|---|---|---|
| **Command** | `nix run .#start` | `nix run .#start-mainnet` | `nix run .#start-mainnet-torii` |
| **Katana** | Local devnet | -- | -- |
| **Torii** | Local | Local (indexing mainnet) | Remote |
| **Blockchain** | Local Katana | Starknet Mainnet | Starknet Mainnet |
| **Best for** | Development | Pre-production | Production |

### Ports

| Service | Port |
|---|---|
| Vite dev server | 5173 |
| Katana (local Starknet) | 5050 |
| Torii (indexer) | 8080 |
| Torii gRPC | 18093 |

Override with env vars: `BLOCDUEL_VITE_PORT`, `BLOCDUEL_TORII_PORT`, etc.

Disable local HTTPS when you need plain HTTP:

```bash
BLOCDUEL_DISABLE_MKCERT=1 nix run .#start
```

By default the Nix entrypoints keep `mkcert` enabled so localhost stays a trusted secure context.

### Without Nix

```bash
npm install
npm run dev
```

This only starts the frontend — you'll need to run Katana/Torii/Sozo manually.

## Headless Agent SDK

The repo also ships a headless agent client for programmatic play. It talks directly to Dojo actions and Torii, so it can:
- create and join matches
- inspect match state and legal actions
- submit moves turn by turn
- self-play locally for validation
- watch existing matches and continue them

### Core API

The public entrypoint is `src/agent/index.ts`.

Main primitives:
- `createAgentClient(options)`
- `client.listMatches()`
- `client.listJoinableMatches()`
- `client.getMatch(matchId)`
- `client.createMatch()`
- `client.joinMatch(matchId)`
- `client.getLegalActions(matchId)`
- `client.submitAction(matchId, action)`
- `client.playTurn(matchId, strategy)`
- `client.playMatch(matchId, strategy, options)`
- `client.selfPlay(options)`

Strategies currently bundled:
- `random`
- `balanced`
- `greedy-agi`
- `greedy-escalation`
- `systems-first`

### Local CLI

Local commands use the deployed world in `.data/world_address.txt` automatically.

```bash
npm run agent:matches
npm run agent:open
npm run agent:create
npm run agent:join -- <matchId>
npm run agent:show -- <matchId>
npm run agent:legal -- <matchId>
npm run agent:act -- <matchId> play <position>
npm run agent:play -- <matchId> --strategy balanced
npm run agent:watch -- <matchId>
npm run agent:selfplay
```

Signer modes:
- Local Katana defaults to burner accounts automatically
- Public networks should use `--signer-mode controller-session`
- Raw `private-key` mode is kept as a fallback, not the preferred path

If you need raw access to the underlying CLI:

```bash
npm run agent:cli -- matches list --json
```

Example session-backed usage:

```bash
npm run agent:cli -- \
  --network sepolia \
  --rpc-url https://api.cartridge.gg/x/starknet/sepolia \
  --torii-url <torii-url> \
  --world-address <world-address> \
  --signer-mode controller-session \
  --session-base-path .cartridge \
  match create --json
```

### Validation

Run the systematic local SDK validation with:

```bash
npm run agent:validate
```

This covers:
- match discovery
- open-match discovery
- create/join
- show/legal/act
- watch update propagation
- match play
- join through `match act ... join`
- repeated self-play across multiple strategy pairings

The full self-play loop is currently correct but still slow on local Katana/Torii. Expect repeated validation runs to take a few minutes until that throughput issue is improved.

## Balance Lab

The repo also ships a local balance harness on top of the headless SDK. It runs full match batches, collects telemetry, and scores the results against a mixed-win target meta.

Main commands:

```bash
npm run balance:run
npm run balance:report
```

What `balance:run` does:
- runs many full local games across a strategy matrix
- writes machine-readable JSON to `.data/balance/latest.json`
- prints a readable scorecard and representative sample list
- exits non-zero if any match stalls or fails

Useful options:

```bash
npm run balance:run -- --games 28 --seed lab-a
npm run balance:run -- --strategies race-agi,race-escalation,race-systems,adaptive-race
npm run balance:report -- --input .data/balance/latest.json
```

Environment overrides:
- `BLOCDUEL_BALANCE_GAMES`
- `BLOCDUEL_BALANCE_SEED`
- `BLOCDUEL_BALANCE_STRATEGIES`
- `BLOCDUEL_BALANCE_MAX_ACTIONS`
- `BLOCDUEL_BALANCE_MAX_IDLE_POLLS`
- `BLOCDUEL_BALANCE_POLL_INTERVAL_MS`
- `BLOCDUEL_BALANCE_OUTPUT`

The balance lab focuses on:
- win-condition distribution
- ending age distribution
- average turns
- first-player advantage
- discard and chain usage
- hero usage and hero win contribution
- abrupt ending rate
- matchup win rates

Bundled balance strategies:
- `race-agi`
- `race-escalation`
- `race-systems`
- `deny-agi`
- `deny-escalation`
- `deny-systems`
- `adaptive-race`

`balanced` still exists as a legacy smoke bot, but it is not the main balance signal.

## How It Works

Two rival blocs — **Atlantic** and **Continental** — compete across three ages. Each age deals 10 cards into a pyramid. Players take turns drafting: **play** a card for its effect, or **sell** it for capital.

### Win Conditions

| Victory | How |
|---|---|
| **AGI Breakthrough** | Push your AGI track to 6 |
| **Escalation Dominance** | Push the shared escalation track to your side's limit (±6) |
| **Systems Dominance** | Collect all 4 system types (COMPUTE, FINANCE, CYBER, DIPLOMACY) |
| **Points** | If no one wins by Age 3, highest score (AGI + systems + heroes) wins |

### Card Types

- **AI** (blue) — Advance the AGI track
- **MILITARY** (red) — Push the escalation track
- **ECONOMY** (amber) — Generate resources per turn
- **SYSTEM** (green) — Collect system symbols for bonuses and the instant win

### Systems & Bonuses

Each system type has a 3-card chain across the ages. System cards cost resources but give no immediate effect — they're an investment.

- **Pair bonus**: Collect 2 of the same system type to unlock a permanent bonus
- **3 different**: Collect 3 different types to choose one bonus
- **All 4**: Instant victory

### Resources

| Icon | Resource | Role |
|---|---|---|
| ⚡ | Energy | Powers military and AI cards |
| ⛏️ | Materials | Builds infrastructure and systems |
| 🖥️ | Compute | Fuels AI research |
| 💰 | Capital | Universal currency — production converts to capital each turn |

### Chains

Cards can chain across ages. If you played the prerequisite card, the next link in the chain is **free**. Chains reward long-term planning over opportunistic drafting.

### Heroes

Powerful one-time recruits available each age. Each hero costs resources plus a surcharge (+2 per hero you already own). Heroes provide large effects but replace your card draft for the turn.

## Stack

React 19, TypeScript, Tailwind CSS v4, Zustand, Framer Motion — zero backend, runs entirely in the browser.

## Status

Work in progress. Active development on game balance and system bonus mechanics.
