# Three-Age System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade bloc-duel from a single-age prototype to a full three-age drafting game with typed resources, symbol chains, and reworked heroes.

**Architecture:** Replace the single flat resource with a typed resource system (Energy/Materials/Compute + Capital). Add an `age` field to cards, split the 30-card deck into 3 ages of 10. Add `chainTo`/`chainFrom` fields for named chain links. Rework heroes to use typed resource costs, replace-draft-pick mechanic, and escalating surcharge. Add age transitions to the store. Fix the card sizing bug.

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS v4, Framer Motion (all already installed).

**Design doc:** `docs/plans/2026-03-06-three-age-system-design.md`

---

### Task 1: Fix card sizing bug

The bottom-row cards stretch when siblings are removed. Fix by giving cards and placeholders explicit fixed dimensions.

**Files:**
- Modify: `src/components/Card.tsx`
- Modify: `src/components/CardPyramid.tsx`

**Step 1: Fix Card.tsx — add fixed height**

In `src/components/Card.tsx`, change the card's root `motion.div` className. Replace:
```
relative w-36 rounded-xl border-2
```
With:
```
relative w-36 h-48 rounded-xl border-2
```

**Step 2: Fix CardPyramid.tsx — fix placeholder dimensions**

In `src/components/CardPyramid.tsx`, replace the taken-card placeholder:
```tsx
<div
  key={`empty-${pos}`}
  className="w-36 rounded-xl border-2 border-dashed border-border/40 opacity-30"
  style={{ height: 0, paddingBottom: '58%' }}
/>
```
With:
```tsx
<div
  key={`empty-${pos}`}
  className="w-36 h-48 rounded-xl border-2 border-dashed border-border/40 opacity-30"
/>
```

**Step 3: Verify**

Run: `npm run build`
Expected: Build succeeds, no type errors.

Open browser at `http://localhost:5173/`, draft a bottom-row card, confirm remaining cards don't stretch.

**Step 4: Commit**

```bash
git add src/components/Card.tsx src/components/CardPyramid.tsx
git commit -m "fix: use fixed card dimensions to prevent layout stretch"
```

---

### Task 2: New type system — ResourceCost and typed resources

Replace the single `cost: number` and `resources: number` / `income: number` with typed resources.

**Files:**
- Rewrite: `src/game/cards.ts` (types only, card data in Task 5)
- Modify: `src/game/heroes.ts` (types only, hero data in Task 6)
- Keep: `src/game/systems.ts` (no changes)
- Keep: `src/game/pyramid.ts` (no changes)

**Step 1: Rewrite card types in `src/game/cards.ts`**

Replace the entire file with:

```typescript
import type { SystemSymbol } from './systems'

export type CardType = 'AI' | 'ECONOMY' | 'MILITARY' | 'SYSTEM'

export interface ResourceCost {
  energy?: number
  materials?: number
  compute?: number
}

export interface CardEffect {
  agi?: number
  escalation?: number
  capital?: number
  energyPerTurn?: number
  materialsPerTurn?: number
  computePerTurn?: number
  capitalPerTurn?: number
  symbol?: SystemSymbol
}

export interface Card {
  id: string
  name: string
  type: CardType
  age: 1 | 2 | 3
  cost: ResourceCost
  effect: CardEffect
  symbol?: SystemSymbol
  chainTo?: string
  chainFrom?: string
}

// Card data will be populated in Task 5
export const AGE_1_CARDS: Card[] = []
export const AGE_2_CARDS: Card[] = []
export const AGE_3_CARDS: Card[] = []
export const ALL_CARDS: Card[] = []
```

**Step 2: Update hero types in `src/game/heroes.ts`**

Replace the Hero interface and keep the data array (update data in Task 6):

```typescript
import type { ResourceCost } from './cards'
import type { SystemSymbol } from './systems'

export interface HeroEffect {
  agi?: number
  escalation?: number
  capital?: number
  energyPerTurn?: number
  materialsPerTurn?: number
  computePerTurn?: number
  symbol?: SystemSymbol
}

export interface Hero {
  id: string
  name: string
  title: string
  cost: ResourceCost
  effect: HeroEffect
  description: string
}

// Hero data will be updated in Task 6
export const HEROES: Hero[] = []
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: Errors in gameStore.ts, Card.tsx, HeroPicker.tsx, Game.tsx (they still reference old types). That's expected — we'll fix those in Task 3 and Task 4.

**Step 4: Commit**

```bash
git add src/game/cards.ts src/game/heroes.ts
git commit -m "feat: add typed resource system (ResourceCost, CardEffect, HeroEffect)"
```

---

### Task 3: Rewrite the Zustand store for typed resources and 3 ages

The store is the core of the game. Rewrite it to support typed resources, 3 ages, chain resolution, and the new hero mechanic.

**Files:**
- Rewrite: `src/store/gameStore.ts`

**Step 1: Write the new store**

Replace the entire `src/store/gameStore.ts` with the following. Key changes:
- `Player.resources` and `Player.income` → `Player.capital`, `Player.production: { energy, materials, compute }`
- `Player.playedCards: string[]` for chain lookups
- `GamePhase` adds `'AGE_TRANSITION'`
- `age: 1 | 2 | 3` state field
- `canAffordCost()` helper checks typed resources + capital substitution
- `payResourceCost()` helper deducts from production surplus then capital
- `playCard()` checks `chainFrom` — if player has the prerequisite card, cost is free
- `invokeHero()` replaces draft (calls `nextTurn()`), adds escalating surcharge (+2 capital per owned hero)
- `nextTurn()` grants typed production to incoming player
- `nextAge()` action: increments age, builds new pyramid from next age's deck, draws 3 new heroes, alternates first player
- `initGame()` sets age to 1, builds Age I pyramid

```typescript
import { create } from 'zustand'
import { AGE_1_CARDS, AGE_2_CARDS, AGE_3_CARDS } from '../game/cards'
import type { Card, ResourceCost } from '../game/cards'
import { HEROES } from '../game/heroes'
import type { Hero } from '../game/heroes'
import type { SystemSymbol } from '../game/systems'
import { buildPyramid, isAvailable } from '../game/pyramid'
import type { PyramidNode } from '../game/pyramid'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Faction = 'ATLANTIC' | 'CONTINENTAL'
export type GamePhase = 'DRAFTING' | 'AGE_TRANSITION' | 'GAME_OVER'

interface Production {
  energy: number
  materials: number
  compute: number
}

interface Player {
  name: string
  faction: Faction
  capital: number
  production: Production
  systems: SystemSymbol[]
  heroes: Hero[]
  playedCards: string[]
}

interface GameState {
  players: [Player, Player]
  currentPlayer: 0 | 1
  age: 1 | 2 | 3
  agiTrack: [number, number]
  escalationTrack: number
  pyramid: PyramidNode[]
  phase: GamePhase
  selectedCard: number | null
  availableHeroes: Hero[]
  heroPickerOpen: boolean
  usedHeroIds: string[]

  // Actions
  initGame: () => void
  selectCard: (position: number) => void
  playCard: () => void
  discardCard: () => void
  invokeHero: (heroId: string) => void
  toggleHeroPicker: () => void
  nextTurn: () => void
  nextAge: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function freshPlayers(): [Player, Player] {
  return [
    {
      name: 'Atlantic Bloc',
      faction: 'ATLANTIC',
      capital: 3,
      production: { energy: 0, materials: 0, compute: 0 },
      systems: [],
      heroes: [],
      playedCards: [],
    },
    {
      name: 'Continental Bloc',
      faction: 'CONTINENTAL',
      capital: 3,
      production: { energy: 0, materials: 0, compute: 0 },
      systems: [],
      heroes: [],
      playedCards: [],
    },
  ]
}

function totalCost(cost: ResourceCost): number {
  return (cost.energy ?? 0) + (cost.materials ?? 0) + (cost.compute ?? 0)
}

/** Check if a player can pay a resource cost using production surplus + capital. */
function canAfford(player: Player, cost: ResourceCost, extraCapital: number = 0): boolean {
  const eNeed = Math.max(0, (cost.energy ?? 0) - player.production.energy)
  const mNeed = Math.max(0, (cost.materials ?? 0) - player.production.materials)
  const cNeed = Math.max(0, (cost.compute ?? 0) - player.production.compute)
  const capitalNeeded = eNeed + mNeed + cNeed + extraCapital
  return player.capital >= capitalNeeded
}

/**
 * Deduct resource cost from player. Uses production first, then capital for the remainder.
 * Mutates the player object in place — caller must clone before calling.
 */
function payCost(player: Player, cost: ResourceCost, extraCapital: number = 0): void {
  const eNeed = Math.max(0, (cost.energy ?? 0) - player.production.energy)
  const mNeed = Math.max(0, (cost.materials ?? 0) - player.production.materials)
  const cNeed = Math.max(0, (cost.compute ?? 0) - player.production.compute)
  player.capital -= (eNeed + mNeed + cNeed + extraCapital)
}

function cardsForAge(age: 1 | 2 | 3): Card[] {
  switch (age) {
    case 1: return AGE_1_CARDS
    case 2: return AGE_2_CARDS
    case 3: return AGE_3_CARDS
  }
}

function clonePlayer(p: Player): Player {
  return {
    ...p,
    production: { ...p.production },
    systems: [...p.systems],
    heroes: [...p.heroes],
    playedCards: [...p.playedCards],
  }
}

function clonePlayers(players: [Player, Player]): [Player, Player] {
  return [clonePlayer(players[0]), clonePlayer(players[1])]
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useGameStore = create<GameState>((set, get) => ({
  players: freshPlayers(),
  currentPlayer: 0,
  age: 1,
  agiTrack: [0, 0],
  escalationTrack: 0,
  pyramid: [],
  phase: 'DRAFTING',
  selectedCard: null,
  availableHeroes: [],
  heroPickerOpen: false,
  usedHeroIds: [],

  // ---- initGame -----------------------------------------------------------
  initGame: () => {
    const cards = shuffle(cardsForAge(1)).slice(0, 10)
    const pyramid = buildPyramid(cards)
    const availableHeroes = shuffle(HEROES).slice(0, 3)

    set({
      players: freshPlayers(),
      currentPlayer: 0,
      age: 1,
      agiTrack: [0, 0],
      escalationTrack: 0,
      pyramid,
      phase: 'DRAFTING',
      selectedCard: null,
      availableHeroes,
      heroPickerOpen: false,
      usedHeroIds: [],
    })
  },

  // ---- selectCard ---------------------------------------------------------
  selectCard: (position: number) => {
    const { phase, pyramid, selectedCard } = get()
    if (phase !== 'DRAFTING') return

    const node = pyramid.find((n) => n.position === position)
    if (!node || node.taken) return
    if (!isAvailable(position, pyramid)) return

    set({ selectedCard: selectedCard === position ? null : position })
  },

  // ---- playCard -----------------------------------------------------------
  playCard: () => {
    const state = get()
    const { pyramid, selectedCard, currentPlayer } = state
    if (selectedCard === null) return

    const nodeIndex = pyramid.findIndex((n) => n.position === selectedCard)
    if (nodeIndex === -1) return

    const node = pyramid[nodeIndex]
    const card = node.card
    const player = state.players[currentPlayer]

    // Check if chain makes this free
    const isFreeViaChain = card.chainFrom
      ? player.playedCards.includes(card.chainFrom)
      : false

    const cost = isFreeViaChain ? {} : card.cost

    if (!isFreeViaChain && !canAfford(player, cost)) return

    // Clone mutable state
    const newPlayers = clonePlayers(state.players)
    const newAgiTrack: [number, number] = [...state.agiTrack]
    let newEscalation = state.escalationTrack
    let newPhase: GamePhase = state.phase

    const p = newPlayers[currentPlayer]

    // Pay cost
    if (!isFreeViaChain) {
      payCost(p, cost)
    }

    // Track played card for chain lookups
    p.playedCards.push(card.id)

    // Apply effects
    const effect = card.effect

    if (effect.agi) {
      newAgiTrack[currentPlayer] = clamp(newAgiTrack[currentPlayer] + effect.agi, 0, 6)
      if (newAgiTrack[currentPlayer] >= 6) newPhase = 'GAME_OVER'
    }

    if (effect.escalation) {
      if (currentPlayer === 0) {
        newEscalation = clamp(newEscalation + effect.escalation, -6, 6)
      } else {
        newEscalation = clamp(newEscalation - effect.escalation, -6, 6)
      }
      if (newEscalation === 6 || newEscalation === -6) newPhase = 'GAME_OVER'
    }

    if (effect.capital) p.capital += effect.capital
    if (effect.energyPerTurn) p.production.energy += effect.energyPerTurn
    if (effect.materialsPerTurn) p.production.materials += effect.materialsPerTurn
    if (effect.computePerTurn) p.production.compute += effect.computePerTurn
    if (effect.capitalPerTurn) p.capital += effect.capitalPerTurn
    if (effect.symbol) p.systems.push(effect.symbol)
    if (card.symbol) p.systems.push(card.symbol)

    const newPyramid = pyramid.map((n, i) =>
      i === nodeIndex ? { ...n, taken: true } : n,
    )

    set({
      players: newPlayers,
      agiTrack: newAgiTrack,
      escalationTrack: newEscalation,
      pyramid: newPyramid,
      phase: newPhase,
      selectedCard: null,
    })

    if (newPhase !== 'GAME_OVER') get().nextTurn()
  },

  // ---- discardCard --------------------------------------------------------
  discardCard: () => {
    const state = get()
    const { pyramid, selectedCard, currentPlayer } = state
    if (selectedCard === null) return

    const nodeIndex = pyramid.findIndex((n) => n.position === selectedCard)
    if (nodeIndex === -1) return

    const newPlayers = clonePlayers(state.players)
    newPlayers[currentPlayer].capital += 2

    const newPyramid = pyramid.map((n, i) =>
      i === nodeIndex ? { ...n, taken: true } : n,
    )

    set({
      players: newPlayers,
      pyramid: newPyramid,
      selectedCard: null,
    })

    get().nextTurn()
  },

  // ---- invokeHero ---------------------------------------------------------
  invokeHero: (heroId: string) => {
    const state = get()
    const { currentPlayer, availableHeroes } = state

    const hero = availableHeroes.find((h) => h.id === heroId)
    if (!hero) return

    const player = state.players[currentPlayer]
    const surcharge = player.heroes.length * 2

    if (!canAfford(player, hero.cost, surcharge)) return

    const newPlayers = clonePlayers(state.players)
    const p = newPlayers[currentPlayer]

    payCost(p, hero.cost, surcharge)
    p.heroes.push({ ...hero })

    // Apply hero effect
    const eff = hero.effect
    const newAgiTrack: [number, number] = [...state.agiTrack]
    let newEscalation = state.escalationTrack
    let newPhase: GamePhase = state.phase

    if (eff.agi) {
      newAgiTrack[currentPlayer] = clamp(newAgiTrack[currentPlayer] + eff.agi, 0, 6)
      if (newAgiTrack[currentPlayer] >= 6) newPhase = 'GAME_OVER'
    }
    if (eff.escalation) {
      if (currentPlayer === 0) {
        newEscalation = clamp(newEscalation + eff.escalation, -6, 6)
      } else {
        newEscalation = clamp(newEscalation - eff.escalation, -6, 6)
      }
      if (newEscalation === 6 || newEscalation === -6) newPhase = 'GAME_OVER'
    }
    if (eff.capital) p.capital += eff.capital
    if (eff.energyPerTurn) p.production.energy += eff.energyPerTurn
    if (eff.materialsPerTurn) p.production.materials += eff.materialsPerTurn
    if (eff.computePerTurn) p.production.compute += eff.computePerTurn
    if (eff.symbol) p.systems.push(eff.symbol)

    set({
      players: newPlayers,
      agiTrack: newAgiTrack,
      escalationTrack: newEscalation,
      phase: newPhase,
      availableHeroes: availableHeroes.filter((h) => h.id !== heroId),
      usedHeroIds: [...state.usedHeroIds, heroId],
      heroPickerOpen: false,
      selectedCard: null,
    })

    // Hero replaces your draft — end turn
    if (newPhase !== 'GAME_OVER') get().nextTurn()
  },

  // ---- toggleHeroPicker ---------------------------------------------------
  toggleHeroPicker: () => {
    set({ heroPickerOpen: !get().heroPickerOpen })
  },

  // ---- nextTurn -----------------------------------------------------------
  nextTurn: () => {
    const state = get()
    const { pyramid, currentPlayer, age } = state

    const allTaken = pyramid.every((n) => n.taken)
    if (allTaken) {
      if (age < 3) {
        set({ phase: 'AGE_TRANSITION' })
      } else {
        set({ phase: 'GAME_OVER' })
      }
      return
    }

    const nextPlayer: 0 | 1 = currentPlayer === 0 ? 1 : 0

    // Grant production income to incoming player
    const prod = state.players[nextPlayer].production
    const totalIncome = prod.energy + prod.materials + prod.compute
    if (totalIncome > 0) {
      const newPlayers = clonePlayers(state.players)
      // Production generates capital (typed resources are tracked as production capacity,
      // capital is the spendable currency — production effectively generates capital each turn)
      newPlayers[nextPlayer].capital += totalIncome
      set({ players: newPlayers, currentPlayer: nextPlayer })
    } else {
      set({ currentPlayer: nextPlayer })
    }
  },

  // ---- nextAge ------------------------------------------------------------
  nextAge: () => {
    const state = get()
    const nextAge = (state.age + 1) as 1 | 2 | 3
    if (nextAge > 3) return

    const cards = shuffle(cardsForAge(nextAge)).slice(0, 10)
    const pyramid = buildPyramid(cards)

    // Draw 3 new heroes not already used
    const remainingHeroes = HEROES.filter((h) => !state.usedHeroIds.includes(h.id))
    const availableHeroes = shuffle(remainingHeroes).slice(0, 3)

    // Alternate first player
    const firstPlayer: 0 | 1 = state.currentPlayer === 0 ? 1 : 0

    set({
      age: nextAge,
      pyramid,
      phase: 'DRAFTING',
      selectedCard: null,
      availableHeroes,
      heroPickerOpen: false,
      currentPlayer: firstPlayer,
    })
  },
}))
```

**Step 2: Verify store compiles in isolation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: Errors only from component files that reference old types (Card.tsx, Game.tsx, HeroPicker.tsx etc). The store itself should have no errors.

**Step 3: Commit**

```bash
git add src/store/gameStore.ts
git commit -m "feat: rewrite game store for typed resources, 3 ages, chain resolution, hero rework"
```

---

### Task 4: Update all UI components for typed resources

Update every component that references the old `player.resources`, `player.income`, `card.cost` (number), and `hero.cost` (number).

**Files:**
- Modify: `src/components/Card.tsx`
- Modify: `src/components/CardPyramid.tsx` (already fixed in Task 1 — no further changes)
- Modify: `src/components/HeroPicker.tsx`
- Modify: `src/components/HeroesPanel.tsx`
- Modify: `src/pages/Game.tsx`
- No changes: `src/components/AGITrack.tsx`, `src/components/EscalationTrack.tsx`, `src/components/SystemsPanel.tsx`

**Step 1: Add a shared cost formatting helper**

Create `src/game/format.ts`:

```typescript
import type { ResourceCost } from './cards'

/** Format a ResourceCost for display. E.g. "2E 1C" or "free" */
export function formatCost(cost: ResourceCost): string {
  const parts: string[] = []
  if (cost.energy) parts.push(`${cost.energy}E`)
  if (cost.materials) parts.push(`${cost.materials}M`)
  if (cost.compute) parts.push(`${cost.compute}C`)
  return parts.length > 0 ? parts.join(' ') : 'free'
}

/** Total resource units in a cost */
export function totalCost(cost: ResourceCost): number {
  return (cost.energy ?? 0) + (cost.materials ?? 0) + (cost.compute ?? 0)
}
```

**Step 2: Update Card.tsx**

Replace the `formatEffects` function to handle the new `CardEffect` shape. Replace the cost display to use `formatCost`. Add chain indicator at the bottom of the card if `card.chainTo` exists.

Key changes in Card.tsx:
- Import `formatCost` from `../game/format`
- `formatEffects` now checks `energyPerTurn`, `materialsPerTurn`, `computePerTurn`, `capitalPerTurn`, `capital`
- Cost display: replace `{card.cost}` / `free` with `formatCost(card.cost)` / check `totalCost(card.cost) === 0`
- Add chain indicator: if `card.chainTo`, show a small row at the bottom with `⛓` icon and the chained card name (look up from ALL_CARDS)

**Step 3: Update HeroPicker.tsx**

- Import `formatCost` from `../game/format`
- The `canAfford` check changes: import `canAfford`-like logic or compute inline — check typed resources + capital vs hero cost + surcharge
- Cost display: replace `{hero.cost}` with `formatCost(hero.cost)` plus surcharge display
- Show hero mechanical effect clearly (e.g. "AGI +2, +1 Compute/turn")
- Update subtitle text: "Replaces your draft pick this turn"
- Add surcharge display: "Surcharge: +{n} Capital" if player already has heroes

**Step 4: Update HeroesPanel.tsx**

- Hero already has `title` field — no type changes needed. Keep as-is since hero effects will be shown in the picker, not the small panel.

**Step 5: Update Game.tsx**

Major changes:
- `PlayerPanel`: Replace `player.resources` / `player.income` with `player.capital` and `player.production` display. Show 3 resource bars (Energy, Materials, Compute) + Capital amount.
- `canAffordCard`: Now uses the typed `canAfford` logic — check if production + capital covers `selectedNode.card.cost`. Also handle chain-free case.
- `hasAffordableHero`: Check typed resources + capital + surcharge.
- Play button label: Show `formatCost(card.cost)` instead of single number. Show "FREE (chained)" if chain applies.
- Hero button: Move OUT of the action bar. Place it as a standalone button next to/below the pyramid, always visible when heroes are available and it's DRAFTING phase.
- Add age indicator in the header (e.g. "Age I", "Age II", "Age III").
- Add age transition overlay: When `phase === 'AGE_TRANSITION'`, show a modal with "Age X Complete — proceed to Age Y" button that calls `nextAge()`.
- Sell button: Now gives +2 Capital instead of +2 resources.

**Step 6: Verify everything compiles**

Run: `npm run build`
Expected: Build succeeds. (Card data arrays are empty so the game won't render cards yet, but it should compile.)

**Step 7: Commit**

```bash
git add src/game/format.ts src/components/Card.tsx src/components/HeroPicker.tsx src/components/HeroesPanel.tsx src/pages/Game.tsx
git commit -m "feat: update all UI components for typed resources and 3-age system"
```

---

### Task 5: Create 30-card deck (10 per age) with chains

Write the actual card data for all 3 ages. ~5-6 chains spanning ages.

**Files:**
- Modify: `src/game/cards.ts` (populate the empty arrays)

**Step 1: Design the chains**

6 chains across 3 ages:
1. **AI Research:** `neural-relay` (I) → `quantum-lab` (II) → `agi-singularity` (III)
2. **Cyber Ops:** `signal-intercept` (I) → `cyber-division` (II) → `total-surveillance` (III)
3. **Energy Grid:** `solar-array` (I) → `fusion-plant` (II) → `dyson-collector` (III)
4. **Trade Network:** `trade-relay` (I) → `supply-network` (II) → `global-exchange` (III)
5. **Space Program:** `launch-pad` (I) → `orbital-station` (II) → `space-command` (III)
6. **Diplomacy:** `embassy` (I) → `summit-accord` (II) → `world-treaty` (III)

**Step 2: Write Age I cards (10 cards)**

Focus: cheap (0-2 total resources), production, first symbols, chain starters.

Mix: 4 economy/system, 2 AI, 2 military, 2 system.

All costs use `{ energy?, materials?, compute? }`.

Example cards (write all 10 with full data):
- `neural-relay`: AI, cost {compute:1}, effect {agi:1}, chainTo: 'quantum-lab'
- `signal-intercept`: SYSTEM, cost {energy:1}, effect {escalation:1}, symbol: CYBER, chainTo: 'cyber-division'
- `solar-array`: ECONOMY, cost {}, effect {energyPerTurn:2}, chainTo: 'fusion-plant'
- `trade-relay`: ECONOMY, cost {materials:1}, effect {capitalPerTurn:1, symbol: FINANCE}, chainTo: 'supply-network'
- `launch-pad`: SYSTEM, cost {energy:1, materials:1}, effect {computePerTurn:1}, symbol: COMPUTE, chainTo: 'orbital-station'
- `embassy`: SYSTEM, cost {}, effect {escalation:-1}, symbol: DIPLOMACY, chainTo: 'summit-accord'
- `mining-outpost`: ECONOMY, cost {}, effect {materialsPerTurn:2}
- `data-center`: ECONOMY, cost {compute:1}, effect {computePerTurn:1}, symbol: COMPUTE
- `recon-drone`: MILITARY, cost {energy:1}, effect {escalation:1}
- `propaganda-hub`: MILITARY, cost {materials:1}, effect {escalation:1, symbol: INDUSTRY}

**Step 3: Write Age II cards (10 cards)**

Focus: medium costs (2-4), chain mid-points, stronger effects.

Example cards (write all 10):
- `quantum-lab`: AI, cost {compute:2, energy:1}, effect {agi:2}, chainTo: 'agi-singularity', chainFrom: 'neural-relay'
- `cyber-division`: MILITARY, cost {energy:2, compute:1}, effect {escalation:2, symbol: CYBER}, chainTo: 'total-surveillance', chainFrom: 'signal-intercept'
- `fusion-plant`: ECONOMY, cost {energy:1, materials:2}, effect {energyPerTurn:3}, chainTo: 'dyson-collector', chainFrom: 'solar-array'
- `supply-network`: ECONOMY, cost {materials:2}, effect {capitalPerTurn:2, symbol: FINANCE}, chainTo: 'global-exchange', chainFrom: 'trade-relay'
- `orbital-station`: SYSTEM, cost {energy:2, compute:1}, effect {agi:1, computePerTurn:1}, symbol: COMPUTE, chainTo: 'space-command', chainFrom: 'launch-pad'
- `summit-accord`: SYSTEM, cost {materials:1}, effect {escalation:-2}, symbol: DIPLOMACY, chainTo: 'world-treaty', chainFrom: 'embassy'
- `deep-learning`: AI, cost {compute:3}, effect {agi:2}
- `drone-swarm`: MILITARY, cost {energy:2, materials:1}, effect {escalation:2}
- `biocompute-node`: AI, cost {compute:2}, effect {agi:1, computePerTurn:1}
- `arms-dealer`: ECONOMY, cost {materials:2}, effect {capital:3, escalation:1}

**Step 4: Write Age III cards (10 cards)**

Focus: expensive (3-6), chain endpoints, decisive.

Example cards (write all 10):
- `agi-singularity`: AI, cost {compute:4, energy:2}, effect {agi:3}, chainFrom: 'quantum-lab'
- `total-surveillance`: MILITARY, cost {compute:3, energy:2}, effect {escalation:3, symbol: CYBER}, chainFrom: 'cyber-division'
- `dyson-collector`: ECONOMY, cost {energy:3, materials:3}, effect {energyPerTurn:4, capital:2}, chainFrom: 'fusion-plant'
- `global-exchange`: ECONOMY, cost {materials:3, compute:1}, effect {capitalPerTurn:4}, chainFrom: 'supply-network'
- `space-command`: SYSTEM, cost {energy:3, compute:2, materials:1}, effect {agi:2, escalation:2}, symbol: COMPUTE, chainFrom: 'orbital-station'
- `world-treaty`: SYSTEM, cost {materials:2}, effect {escalation:-3}, symbol: DIPLOMACY, chainFrom: 'summit-accord'
- `neural-sovereign`: AI, cost {compute:4}, effect {agi:3}
- `orbital-strike`: MILITARY, cost {energy:4, materials:2}, effect {escalation:4}
- `quantum-supremacy`: AI, cost {compute:5}, effect {agi:2, computePerTurn:2}
- `nuclear-deterrent`: MILITARY, cost {energy:3, materials:3}, effect {escalation:3, capital:2}

**Step 5: Populate the exported arrays**

Set `AGE_1_CARDS`, `AGE_2_CARDS`, `AGE_3_CARDS` to the card arrays. Set `ALL_CARDS = [...AGE_1_CARDS, ...AGE_2_CARDS, ...AGE_3_CARDS]`.

**Step 6: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 7: Commit**

```bash
git add src/game/cards.ts
git commit -m "feat: add 30-card deck across 3 ages with 6 chain paths"
```

---

### Task 6: Update hero data with typed costs and effects

**Files:**
- Modify: `src/game/heroes.ts`

**Step 1: Write 10 heroes with typed costs and clear effects**

Each hero has:
- `cost: ResourceCost` (typed)
- `effect: HeroEffect` (mechanical — AGI, escalation, production, etc.)
- `description` now describes what the hero does mechanically

```typescript
export const HEROES: Hero[] = [
  {
    id: 'hero-turing',
    name: 'Alan Arden',
    title: 'Father of Computing',
    cost: { compute: 3, energy: 1 },
    effect: { agi: 2 },
    description: 'AGI +2',
  },
  {
    id: 'hero-oppenheimer',
    name: 'J.R. Oppen',
    title: 'Destroyer of Worlds',
    cost: { energy: 3, materials: 2 },
    effect: { escalation: 3 },
    description: 'Escalation +3',
  },
  {
    id: 'hero-lovelace',
    name: 'Ada Lovewell',
    title: 'The First Programmer',
    cost: { compute: 2 },
    effect: { computePerTurn: 2, agi: 1 },
    description: 'AGI +1, +2 Compute/turn',
  },
  {
    id: 'hero-vonneumann',
    name: 'Johann Neumann',
    title: 'The Polymath',
    cost: { compute: 2, energy: 1, materials: 1 },
    effect: { agi: 1, capital: 4 },
    description: 'AGI +1, +4 Capital',
  },
  {
    id: 'hero-tesla',
    name: 'Nikola Teslov',
    title: 'The Visionary',
    cost: { energy: 3 },
    effect: { energyPerTurn: 3 },
    description: '+3 Energy/turn',
  },
  {
    id: 'hero-shannon',
    name: 'Claude Shanley',
    title: 'Father of Information',
    cost: { compute: 2, materials: 1 },
    effect: { computePerTurn: 1, symbol: 'CYBER' },
    description: '+1 Compute/turn, gain CYBER',
  },
  {
    id: 'hero-curie',
    name: 'Maria Curev',
    title: 'Pioneer of the Atom',
    cost: { energy: 2, materials: 2 },
    effect: { energyPerTurn: 2, materialsPerTurn: 1 },
    description: '+2 Energy/turn, +1 Materials/turn',
  },
  {
    id: 'hero-dijkstra',
    name: 'Edsger Dahl',
    title: 'Master of Algorithms',
    cost: { compute: 2 },
    effect: { agi: 1, computePerTurn: 1 },
    description: 'AGI +1, +1 Compute/turn',
  },
  {
    id: 'hero-berners-lee',
    name: 'Tim Bernel',
    title: 'Weaver of the Web',
    cost: { compute: 1, materials: 1 },
    effect: { capital: 5 },
    description: '+5 Capital',
  },
  {
    id: 'hero-hopper',
    name: 'Grace Halper',
    title: 'The Admiral',
    cost: { energy: 2 },
    effect: { escalation: 2, energyPerTurn: 1 },
    description: 'Escalation +2, +1 Energy/turn',
  },
]
```

**Step 2: Verify**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/game/heroes.ts
git commit -m "feat: update heroes with typed costs and mechanical effects"
```

---

### Task 7: Wire up age transitions and hero-as-turn-action in the UI

**Files:**
- Modify: `src/pages/Game.tsx`

**Step 1: Add age transition overlay**

When `phase === 'AGE_TRANSITION'`, render a modal similar to the game-over overlay:
- Shows "Age {current} Complete"
- Button: "Begin Age {next}" that calls `nextAge()`

**Step 2: Move hero button out of action bar**

The "Invoke Hero" button should appear as a top-level action next to the pyramid (not inside the card selection bar). It's an alternative to drafting a card. Show it whenever `phase === 'DRAFTING'` and `availableHeroes.length > 0`, regardless of whether a card is selected.

When a card IS selected, show the card action bar (Play / Sell) WITHOUT the hero button.
When NO card is selected, the hero button is the visible action.

**Step 3: Update the header to show current age**

Add "Age {age}" indicator next to the player turn display.

**Step 4: Verify full game loop**

Run: `npm run dev`
- Start game: Age I pyramid with 10 cards renders
- Draft all 10 cards → age transition overlay appears
- Click "Begin Age II" → new pyramid with Age II cards
- Repeat for Age III → game over after all Age III cards drafted
- Test hero invocation: click "Invoke Hero" without selecting a card, pick a hero, turn ends
- Test chain: if you played a chain starter in Age I, the chained card in Age II should show "FREE" and cost nothing to play

**Step 5: Commit**

```bash
git add src/pages/Game.tsx
git commit -m "feat: add age transitions, hero-as-turn-action, age indicator"
```

---

### Task 8: Final polish and full playthrough verification

**Files:**
- Possibly minor tweaks to any component

**Step 1: Run a full 3-age game in the browser**

Verify:
1. Age I: 10 cards, cheap costs, production cards work
2. Age transition: overlay appears, new pyramid loads
3. Age II: medium costs, chains give free cards, military pressure increases
4. Age III: expensive cards, decisive plays, chain endpoints
5. Heroes: can invoke instead of drafting, surcharge increases, effects apply
6. Victory: AGI track reaching 6 or escalation hitting -6/+6 triggers game over
7. Points victory: all 30 cards drafted without track victory → game over with score
8. New Game button resets everything to Age I

**Step 2: Fix any issues found during playthrough**

**Step 3: Final commit**

```bash
git add -A
git commit -m "polish: verify full 3-age game loop"
```
