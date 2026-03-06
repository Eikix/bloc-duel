# BLOC:DUEL

A two-player strategy card game set in a near-future geopolitical conflict. Draft cards from a shared pyramid, build your engine, and race to one of three victory conditions.

## Play

```bash
npm install
npm run dev
```

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
