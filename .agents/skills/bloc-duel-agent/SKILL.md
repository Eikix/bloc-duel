---
name: bloc-duel-agent
description: Play Bloc Duel programmatically through the headless agent SDK. Use when creating matches, joining matches, inspecting on-chain game state, submitting legal actions, self-playing locally, or continuing a live match against a human or another agent.
---

# Bloc Duel Agent

Use this skill when you need to play Bloc Duel through the repo's headless SDK instead of the browser.

Default to the SDK/CLI for gameplay logic. Use the browser only for UI checks or when a human is one of the players.

## Core rule

Do not treat the game like a generic value engine.

Winning usually means:
- pick a line early: `AGI`, `ESCALATION`, or `SYSTEMS`
- race that line hard
- deny the opponent when one pick or discard materially slows their line

Do not default to `balanced` as a strategic recommendation. The bundled autoplay strategies are validation bots, not strong theory-of-the-game agents.

## What the SDK can do

The SDK and CLI can:
- list matches
- list joinable matches
- create a match
- join a match
- inspect full match state
- compute legal actions for the current actor
- submit actions on-chain
- watch a match for updates
- self-play locally

Main code:
- `src/agent/index.ts`
- `src/agent/runtime.ts`
- `src/agent/cli.ts`
- `src/agent/types.ts`

## Prefer these commands

Use the package scripts, not raw `node dist-agent/cli.js`.

Local commands:

```bash
npm run agent:matches
npm run agent:open
npm run agent:create
npm run agent:join -- <matchId>
npm run agent:show -- <matchId> --json
npm run agent:legal -- <matchId> --json
npm run agent:act -- <matchId> <play|discard|hero|bonus|next-age|join> [value] --json
npm run agent:watch -- <matchId>
npm run agent:selfplay
```

Examples:

```bash
npm run agent:create -- --json
npm run agent:join -- 123456789 --json
npm run agent:act -- 123456789 play 9 --json
npm run agent:act -- 123456789 hero 0 --json
npm run agent:act -- 123456789 next-age --json
```

Use `--json` whenever another agent needs to parse the output.

## Local workflow

Start the local stack first:

```bash
nix run .#start
```

If localhost HTTPS is getting in the way for SDK work:

```bash
BLOCDUEL_DISABLE_MKCERT=1 nix run .#start
```

Then:
1. `npm run agent:create -- --json`
2. note the `matchId`
3. either:
   - join from another burner with `npm run agent:join -- <matchId> --json`, or
   - have a human join in the browser
4. before every move, read:
   - `npm run agent:show -- <matchId> --json`
   - `npm run agent:legal -- <matchId> --json`
5. submit one legal move with `npm run agent:act`
6. repeat until `winner` is set or the phase becomes `GAME_OVER`

For local play, the default signer should stay `katana-burner`.

## Human vs agent workflow

When playing against a human:
1. create the match with the SDK
2. give the human the `matchId`
3. after every human move, refresh with `match show`
4. use `match legal` as the source of truth for what the SDK can do next
5. submit exactly one action
6. if the game enters `AGE_TRANSITION`, the current player must advance with `next-age`

`match watch` is useful, but `match show --json` is the authoritative snapshot.

## Public network workflow

For testnet or mainnet, prefer `controller-session`.

Do not default to raw private keys when session-based execution is available.

Example:

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

Relevant code:
- `src/agent/signer.ts`
- `src/dojo/policies.ts`

If session behavior is unclear, also read:
- `.agents/skills/controller-backend/SKILL.md`
- `.agents/skills/controller-sessions/SKILL.md`

## How to think about moves

Evaluate the board in this order:

1. Can I win immediately this turn?
2. Can the opponent win on their next turn or next reveal window?
3. Which line is currently fastest for me:
   - `AGI`
   - `ESCALATION`
   - `SYSTEMS`
4. Which single action best advances my line or delays theirs?

Heuristics:
- `AGI`: prioritize compute and direct AGI gain
- `ESCALATION`: prioritize tempo and direct escalation pushes
- `SYSTEMS`: prioritize symbol acquisition and denial of the opponent's third/fourth unique type
- `DISCARD`: use it when a visible card is much better for the opponent than for you
- `HEROES`: treat them as major tempo buys, not filler; current game balance may make them too efficient

## Robust execution rules

Always:
- re-read match state before acting
- use `match legal` instead of assuming a move is legal
- treat on-chain state as truth
- expect local indexing/write-read loops to be slower than ideal

If a command seems slow:
- poll with `match show`
- do not submit duplicate actions blindly
- wait for the phase or `currentPlayer` to change before moving again

## Self-play and validation

Use self-play for SDK validation, not as proof of strong strategy quality.

Commands:

```bash
npm run agent:selfplay
npm run agent:validate
```

Current reality:
- self-play works
- large batches can be slow on local Katana/Torii
- bundled strategies are useful for smoke testing, not final competitive play

## When to inspect code directly

Open these files if behavior is unclear:
- `src/agent/runtime.ts` for match flow
- `src/agent/cli.ts` for command syntax
- `src/game/rules.ts` for legality, affordability, and hero surcharge
- `src/dojo/torii.ts` for snapshot shape
- `src/store/gameStore.ts` for browser-side usage of the same actions
