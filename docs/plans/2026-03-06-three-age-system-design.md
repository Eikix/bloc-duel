# BLOC:DUEL v2 — Three-Age System Design

## Overview

Evolve the single-age prototype into a full three-age drafting game with typed resources, symbol chains, and reworked heroes.

## 1. Resource System

Three typed resources plus flexible capital:

- **Energy** — powers military and AI cards
- **Materials** — powers economy and infrastructure cards
- **Compute** — powers AI and system cards
- **Capital** — flexible currency, 1 Capital = 1 of any typed resource

### Production

Economy and system cards generate typed resources per turn (e.g. `+2 Energy/turn`). Production persists across ages.

### Card Costs

Multi-resource notation: `2E + 1C` means 2 Energy + 1 Compute. Capital substitutes 1:1 for any missing resource.

### Starting State

Each player begins with 3 Capital, 0 production. Age I cards cost 0-2 total resources so early turns are playable.

## 2. Symbol Chains

Named chain links across ages. A card's `chainTo` field names a card in the next age. Owning the prerequisite makes the chained card **free**.

### Example Chain

```
Age I:   Data Relay        → chains to Satellite Network
Age II:  Satellite Network → chains to Orbital Command
Age III: Orbital Command   (endpoint)
```

### Design Rules

- ~5-6 chains span the full game
- 1 card per chain per age
- ~6 of 10 cards per age participate in chains
- Not every card is chained — standalone cards exist
- Chain indicator shown on card UI: icon + destination name

## 3. Age Structure

Three ages, 10-card pyramid each (identical 4-row layout). 30 unique cards total.

### Age I — Foundations

- Costs: 0-2 resources
- Focus: production, first symbols, light AGI/escalation
- Mix: ~6 economy/system, ~2 AI, ~2 military

### Age II — Competition

- Costs: 2-4 resources
- Focus: chain payoffs, military pressure, strategic identity
- Mix: ~3 economy, ~3 AI, ~2 military, ~2 system

### Age III — Resolution

- Costs: 3-6 resources
- Focus: breakthroughs, decisive plays, chain endpoints
- Mix: ~4 AI, ~3 military, ~2 system, ~1 economy

### Age Transitions

- New pyramid built from next age's card deck
- Player state carries over (resources, production, symbols, heroes)
- Turn order alternates: whoever went second in the previous age goes first

### Heroes at Age Boundaries

3 new heroes drawn from the pool at each age start.

## 4. Heroes

### Core Mechanic

Invoking a hero **replaces your draft pick**. You skip drafting a card from the pyramid. This is a real tempo sacrifice balanced by the hero's powerful effect.

### Turn Options

On your turn, choose one:
1. Draft a card from the pyramid (play or sell)
2. Invoke a hero (spend resources, skip draft)

### Costs

Each hero has a unique multi-resource cost (e.g. `3 Compute + 2 Energy`).

**Escalating surcharge:** Each hero you already own adds +2 Capital to the next hero's cost.
- First hero: base cost
- Second hero: base cost + 2 Capital
- Third hero: base cost + 4 Capital

### Effects

Every hero has a clear, impactful mechanical effect:
- AGI advancement
- Escalation swing
- Production boost
- Free symbol
- Resource burst

### Availability

- 10 heroes in the full pool
- 3 randomly available per age
- New 3 drawn at each age transition
- Once invoked, removed from the available pool

### UI

Hero picker is a top-level action button, always visible next to the pyramid. Not nested inside the card action bar.

## 5. Card Size Fix

Cards use fixed width (`w-36`) and consistent min-height. Empty pyramid slots render as fixed-size placeholders. No flex-grow or stretching.

## 6. Card Data Requirements

### Card Interface (updated)

```typescript
interface ResourceCost {
  energy?: number
  materials?: number
  compute?: number
}

interface CardEffect {
  agi?: number
  escalation?: number
  capital?: number              // instant capital gain
  energyPerTurn?: number
  materialsPerTurn?: number
  computePerTurn?: number
  capitalPerTurn?: number
  symbol?: SystemSymbol
}

interface Card {
  id: string
  name: string
  type: CardType
  age: 1 | 2 | 3
  cost: ResourceCost
  effect: CardEffect
  symbol?: SystemSymbol
  chainTo?: string              // id of the card this unlocks for free
  chainFrom?: string            // id of the prerequisite card (for display)
}
```

### Hero Interface (updated)

```typescript
interface Hero {
  id: string
  name: string
  title: string
  cost: ResourceCost
  effect: HeroEffect
  description: string
}

interface HeroEffect {
  agi?: number
  escalation?: number
  capital?: number
  energyPerTurn?: number
  materialsPerTurn?: number
  computePerTurn?: number
  symbol?: SystemSymbol
}
```

### Player State (updated)

```typescript
interface Player {
  name: string
  faction: Faction
  capital: number
  production: {
    energy: number
    materials: number
    compute: number
  }
  systems: SystemSymbol[]
  heroes: Hero[]
  playedCards: string[]         // card ids, for chain lookups
}
```

## 7. Victory Conditions

Unchanged from prototype:
- **AGI Victory:** First player to reach 6 on the AGI track
- **Escalation Victory:** Push escalation track to the opponent's end (-6 or +6)
- **Points Victory:** If all three ages complete without the above, highest combined score (AGI + systems + heroes) wins
