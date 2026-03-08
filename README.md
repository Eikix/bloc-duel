# BLOC:DUEL

A two-player strategy card game set in a near-future geopolitical conflict. Draft cards from a shared pyramid, build your engine, and race to one of three victory conditions.

## Development

Requires [Nix](https://nixos.org/) with flakes enabled. The dev environment provides all tools (Node.js, Katana, Torii, Sozo, Scarb).

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

Override with env vars: `BLOCDUEL_VITE_PORT`, `BLOCDUEL_TORII_PORT`, etc.

### Without Nix

```bash
npm install
npm run dev
```

This only starts the frontend — you'll need to run Katana/Torii/Sozo manually.

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
