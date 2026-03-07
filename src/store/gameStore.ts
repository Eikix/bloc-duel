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

export interface Player {
  name: string
  faction: Faction
  capital: number
  production: Production
  systems: SystemSymbol[]
  activeSystemBonuses: SystemSymbol[]
  madeSystemChoice: boolean
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
  systemBonusChoice: { playerIndex: 0 | 1; options: SystemSymbol[] } | null
  bonusNotification: { playerName: string; symbol: SystemSymbol } | null

  // Actions
  initGame: () => void
  selectCard: (position: number) => void
  playCard: () => void
  discardCard: () => void
  playCardAt: (position: number) => void
  discardCardAt: (position: number) => void
  invokeHero: (heroId: string) => void
  toggleHeroPicker: () => void
  chooseSystemBonus: (symbol: SystemSymbol) => void
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
      activeSystemBonuses: [],
      madeSystemChoice: false,
      heroes: [],
      playedCards: [],
    },
    {
      name: 'Continental Bloc',
      faction: 'CONTINENTAL',
      capital: 3,
      production: { energy: 0, materials: 0, compute: 0 },
      systems: [],
      activeSystemBonuses: [],
      madeSystemChoice: false,
      heroes: [],
      playedCards: [],
    },
  ]
}

/** Check if a player can pay a resource cost using production surplus + capital. */
export function canAfford(player: Pick<Player, 'capital' | 'production'>, cost: ResourceCost, extraCapital: number = 0): boolean {
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

export function getEffectiveCost(card: Card, player: Player): ResourceCost {
  if (card.type === 'AI' && player.activeSystemBonuses.includes('COMPUTE')) {
    return {
      energy: Math.max(0, (card.cost.energy ?? 0) - 1) || undefined,
      materials: Math.max(0, (card.cost.materials ?? 0) - 1) || undefined,
      compute: Math.max(0, (card.cost.compute ?? 0) - 1) || undefined,
    }
  }
  return card.cost
}

export function getSellValue(age: 1 | 2 | 3, player: Player): number {
  const base = age
  return player.activeSystemBonuses.includes('FINANCE') ? base * 2 : base
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
    activeSystemBonuses: [...p.activeSystemBonuses],
    heroes: [...p.heroes],
    playedCards: [...p.playedCards],
  }
}

function clonePlayers(players: [Player, Player]): [Player, Player] {
  return [clonePlayer(players[0]), clonePlayer(players[1])]
}

// ---------------------------------------------------------------------------
// System bonus helpers
// ---------------------------------------------------------------------------

/** Check system state after gaining a new symbol. */
function checkSystemState(player: Player): {
  newPairBonuses: SystemSymbol[]
  offerChoice: SystemSymbol[] | null
  instantWin: boolean
} {
  const uniqueTypes = [...new Set(player.systems)]

  // All 4 types → instant Systems Victory
  if (uniqueTypes.length >= 4) {
    return { newPairBonuses: [], offerChoice: null, instantWin: true }
  }

  // Check for new pairs (count >= 2, not already bonused)
  const counts = new Map<SystemSymbol, number>()
  for (const s of player.systems) {
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }

  const newPairBonuses: SystemSymbol[] = []
  for (const [sym, count] of counts) {
    if (count >= 2 && !player.activeSystemBonuses.includes(sym)) {
      newPairBonuses.push(sym)
    }
  }

  // 3 different types → choose one bonus (if no choice made yet)
  if (uniqueTypes.length >= 3 && !player.madeSystemChoice) {
    const alreadyBonused = new Set([...player.activeSystemBonuses, ...newPairBonuses])
    const choiceOptions = uniqueTypes.filter(t => !alreadyBonused.has(t))
    if (choiceOptions.length > 0) {
      return { newPairBonuses, offerChoice: choiceOptions, instantWin: false }
    }
  }

  return { newPairBonuses, offerChoice: null, instantWin: false }
}

/** Apply a system bonus to a player. CYBER/DIPLOMACY mutate escalation. */
function applySystemBonus(
  player: Player,
  symbol: SystemSymbol,
  currentPlayer: 0 | 1,
  escalationTrack: number,
): { escalationTrack: number; phase: GamePhase | null } {
  player.activeSystemBonuses.push(symbol)

  if (symbol === 'CYBER') {
    let esc = escalationTrack
    if (currentPlayer === 0) esc = clamp(esc + 2, -6, 6)
    else esc = clamp(esc - 2, -6, 6)
    const phase = (esc === 6 || esc === -6) ? 'GAME_OVER' : null
    return { escalationTrack: esc, phase }
  }

  if (symbol === 'DIPLOMACY') {
    return { escalationTrack: 0, phase: null }
  }

  // COMPUTE and FINANCE: no immediate effect (permanent modifiers)
  return { escalationTrack, phase: null }
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
  systemBonusChoice: null,
  bonusNotification: null,

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
      systemBonusChoice: null,
      bonusNotification: null,
    })
  },

  // ---- selectCard ---------------------------------------------------------
  selectCard: (position: number) => {
    const { phase, pyramid, selectedCard, systemBonusChoice } = get()
    if (phase !== 'DRAFTING' || systemBonusChoice) return

    const node = pyramid.find((n) => n.position === position)
    if (!node || node.taken) return
    if (!isAvailable(position, pyramid)) return

    set({ selectedCard: selectedCard === position ? null : position })
  },

  // ---- playCard (click-based, delegates to playCardAt) --------------------
  playCard: () => {
    const { selectedCard } = get()
    if (selectedCard === null) return
    get().playCardAt(selectedCard)
  },

  // ---- discardCard (click-based, delegates to discardCardAt) --------------
  discardCard: () => {
    const { selectedCard } = get()
    if (selectedCard === null) return
    get().discardCardAt(selectedCard)
  },

  // ---- playCardAt (drag-drop + click) ------------------------------------
  playCardAt: (position: number) => {
    const state = get()
    if (state.phase !== 'DRAFTING' || state.systemBonusChoice) return

    const nodeIndex = state.pyramid.findIndex((n) => n.position === position)
    if (nodeIndex === -1) return
    const node = state.pyramid[nodeIndex]
    if (node.taken) return
    if (!isAvailable(position, state.pyramid)) return

    const card = node.card
    const player = state.players[state.currentPlayer]

    const isFreeViaChain = card.chainFrom
      ? player.playedCards.includes(card.chainFrom)
      : false

    const effectiveCost = getEffectiveCost(card, player)
    const cost = isFreeViaChain ? {} : effectiveCost
    if (!isFreeViaChain && !canAfford(player, cost)) return

    const newPlayers = clonePlayers(state.players)
    const newAgiTrack: [number, number] = [...state.agiTrack]
    let newEscalation = state.escalationTrack
    let newPhase: GamePhase = state.phase

    const p = newPlayers[state.currentPlayer]

    if (!isFreeViaChain) {
      payCost(p, cost)
    }

    p.playedCards.push(card.id)

    // Apply effects
    const effect = card.effect

    if (effect.agi) {
      newAgiTrack[state.currentPlayer] = clamp(newAgiTrack[state.currentPlayer] + effect.agi, 0, 6)
      if (newAgiTrack[state.currentPlayer] >= 6) newPhase = 'GAME_OVER'
    }

    if (effect.escalation) {
      if (state.currentPlayer === 0) {
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

    const newPyramid = state.pyramid.map((n, i) =>
      i === nodeIndex ? { ...n, taken: true } : n,
    )

    // Check system bonuses if a system symbol was gained
    let systemBonusChoice: GameState['systemBonusChoice'] = null
    let bonusNotification: GameState['bonusNotification'] = null
    if (newPhase !== 'GAME_OVER' && (effect.symbol || card.symbol)) {
      const systemCheck = checkSystemState(p)
      if (systemCheck.instantWin) {
        newPhase = 'GAME_OVER'
      } else {
        for (const bonus of systemCheck.newPairBonuses) {
          const result = applySystemBonus(p, bonus, state.currentPlayer, newEscalation)
          newEscalation = result.escalationTrack
          if (result.phase) newPhase = result.phase
          bonusNotification = { playerName: p.name, symbol: bonus }
        }
        if (systemCheck.offerChoice) {
          systemBonusChoice = {
            playerIndex: state.currentPlayer,
            options: systemCheck.offerChoice,
          }
        }
      }
    }

    set({
      players: newPlayers,
      agiTrack: newAgiTrack,
      escalationTrack: newEscalation,
      pyramid: newPyramid,
      phase: newPhase,
      selectedCard: null,
      systemBonusChoice,
      bonusNotification,
    })

    if (newPhase !== 'GAME_OVER' && !systemBonusChoice) get().nextTurn()
  },

  // ---- discardCardAt (drag-drop + click) ---------------------------------
  discardCardAt: (position: number) => {
    const state = get()
    if (state.phase !== 'DRAFTING' || state.systemBonusChoice) return

    const nodeIndex = state.pyramid.findIndex((n) => n.position === position)
    if (nodeIndex === -1) return
    const node = state.pyramid[nodeIndex]
    if (node.taken) return
    if (!isAvailable(position, state.pyramid)) return

    const newPlayers = clonePlayers(state.players)
    newPlayers[state.currentPlayer].capital += getSellValue(state.age, newPlayers[state.currentPlayer])

    const newPyramid = state.pyramid.map((n, i) =>
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
    if (state.systemBonusChoice) return

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

    // Check system bonuses if hero granted a symbol
    let systemBonusChoice: GameState['systemBonusChoice'] = null
    let bonusNotification: GameState['bonusNotification'] = null
    if (newPhase !== 'GAME_OVER' && eff.symbol) {
      const systemCheck = checkSystemState(p)
      if (systemCheck.instantWin) {
        newPhase = 'GAME_OVER'
      } else {
        for (const bonus of systemCheck.newPairBonuses) {
          const result = applySystemBonus(p, bonus, currentPlayer, newEscalation)
          newEscalation = result.escalationTrack
          if (result.phase) newPhase = result.phase
          bonusNotification = { playerName: p.name, symbol: bonus }
        }
        if (systemCheck.offerChoice) {
          systemBonusChoice = {
            playerIndex: currentPlayer,
            options: systemCheck.offerChoice,
          }
        }
      }
    }

    set({
      players: newPlayers,
      agiTrack: newAgiTrack,
      escalationTrack: newEscalation,
      phase: newPhase,
      availableHeroes: availableHeroes.filter((h) => h.id !== heroId),
      usedHeroIds: [...state.usedHeroIds, heroId],
      heroPickerOpen: false,
      selectedCard: null,
      systemBonusChoice,
      bonusNotification,
    })

    if (newPhase !== 'GAME_OVER' && !systemBonusChoice) get().nextTurn()
  },

  // ---- toggleHeroPicker ---------------------------------------------------
  toggleHeroPicker: () => {
    set({ heroPickerOpen: !get().heroPickerOpen })
  },

  // ---- chooseSystemBonus --------------------------------------------------
  chooseSystemBonus: (symbol: SystemSymbol) => {
    const state = get()
    if (!state.systemBonusChoice) return

    const { playerIndex } = state.systemBonusChoice
    const newPlayers = clonePlayers(state.players)
    const p = newPlayers[playerIndex]

    const result = applySystemBonus(p, symbol, playerIndex, state.escalationTrack)
    p.madeSystemChoice = true

    set({
      players: newPlayers,
      escalationTrack: result.escalationTrack,
      phase: result.phase ?? state.phase,
      systemBonusChoice: null,
    })

    if (!result.phase) get().nextTurn()
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

    const newPlayers = clonePlayers(state.players)
    const p = newPlayers[nextPlayer]

    // Grant production income
    const totalIncome = p.production.energy + p.production.materials + p.production.compute
    if (totalIncome > 0) {
      p.capital += totalIncome
    }

    set({
      players: newPlayers,
      currentPlayer: nextPlayer,
    })
  },

  // ---- nextAge ------------------------------------------------------------
  nextAge: () => {
    const state = get()
    const nextAge = (state.age + 1) as 1 | 2 | 3
    if (nextAge > 3) return

    const cards = shuffle(cardsForAge(nextAge)).slice(0, 10)
    const pyramid = buildPyramid(cards)

    // Recharge heroes back to 3: keep unpicked, draw from unused pool to fill
    const remainingPool = HEROES.filter((h) => !state.usedHeroIds.includes(h.id) && !state.availableHeroes.some((a) => a.id === h.id))
    const needed = 3 - state.availableHeroes.length
    const newDraws = shuffle(remainingPool).slice(0, needed)
    const availableHeroes = [...state.availableHeroes, ...newDraws]

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
      systemBonusChoice: null,
    })
  },
}))
