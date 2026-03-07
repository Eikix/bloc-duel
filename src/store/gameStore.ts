import { create } from "zustand";
import { useMemo } from "react";
import type { Hero } from "../game/heroes";
import type { ResourceCost } from "../game/cards";
import type { PyramidNode } from "../game/pyramid";
import type { SystemSymbol } from "../game/systems";
import { useGameActions, toSystemTypeEnum } from "../dojo/useGameActions";
import { useGameState, type GamePhase } from "../dojo/useGameState";

export type Faction = "ATLANTIC" | "CONTINENTAL";

interface Production {
  energy: number;
  materials: number;
  compute: number;
}

export interface Player {
  name: string;
  faction: Faction;
  capital: number;
  production: Production;
  systems: SystemSymbol[];
  activeSystemBonuses: SystemSymbol[];
  madeSystemChoice: boolean;
  heroes: Hero[];
  playedCards: string[];
}

interface UIState {
  gameId: number | null;
  selectedCard: number | null;
  heroPickerOpen: boolean;
  setGameId: (id: number | null) => void;
  selectCard: (position: number | null) => void;
  toggleHeroPicker: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  gameId: null,
  selectedCard: null,
  heroPickerOpen: false,

  setGameId: (id) => set({ gameId: id, selectedCard: null, heroPickerOpen: false }),
  selectCard: (position) => {
    const current = get().selectedCard;
    set({ selectedCard: current === position ? null : position });
  },
  toggleHeroPicker: () => set({ heroPickerOpen: !get().heroPickerOpen }),
}));

interface GameStoreState {
  players: [Player, Player];
  currentPlayer: 0 | 1;
  age: 1 | 2 | 3;
  agiTrack: [number, number];
  escalationTrack: number;
  pyramid: PyramidNode[];
  phase: GamePhase;
  selectedCard: number | null;
  availableHeroes: Hero[];
  heroPickerOpen: boolean;
  systemBonusChoice: { playerIndex: 0 | 1; options: SystemSymbol[] } | null;

  initGame: () => void;
  selectCard: (position: number | null) => void;
  playCard: () => void;
  discardCard: () => void;
  playCardAt: (position: number) => void;
  discardCardAt: (position: number) => void;
  invokeHero: (heroId: string) => void;
  toggleHeroPicker: () => void;
  chooseSystemBonus: (symbol: SystemSymbol) => void;
  nextAge: () => void;
}

export function canAfford(
  player: Pick<Player, "capital" | "production">,
  cost: ResourceCost,
  extraCapital: number = 0,
): boolean {
  const eNeed = Math.max(0, (cost.energy ?? 0) - player.production.energy);
  const mNeed = Math.max(0, (cost.materials ?? 0) - player.production.materials);
  const cNeed = Math.max(0, (cost.compute ?? 0) - player.production.compute);
  const capitalNeeded = eNeed + mNeed + cNeed + extraCapital;
  return player.capital >= capitalNeeded;
}

export function getSellValue(age: 1 | 2 | 3): number {
  return age;
}

export function useGameStore<T>(selector: (state: GameStoreState) => T): T {
  const { gameId, selectedCard, heroPickerOpen, selectCard, toggleHeroPicker } = useUIStore();
  const gameState = useGameState(gameId);
  const actions = useGameActions();

  const storeState = useMemo<GameStoreState>(() => {
    const playSelected = () => {
      if (selectedCard === null) return;
      void actions.playCard(selectedCard);
    };

    const discardSelected = () => {
      if (selectedCard === null) return;
      void actions.discardCard(selectedCard);
    };

    return {
      players: gameState.players,
      currentPlayer: gameState.currentPlayer,
      age: gameState.age,
      agiTrack: gameState.agiTrack,
      escalationTrack: gameState.escalationTrack,
      pyramid: gameState.pyramid,
      phase: gameState.phase,
      selectedCard,
      availableHeroes: gameState.availableHeroes,
      heroPickerOpen,
      systemBonusChoice: gameState.systemBonusChoice,

      initGame: () => {
        void actions.createGame();
      },
      selectCard,
      playCard: playSelected,
      discardCard: discardSelected,
      playCardAt: (position) => {
        void actions.playCard(position);
      },
      discardCardAt: (position) => {
        void actions.discardCard(position);
      },
      invokeHero: (heroId) => {
        const heroSlot = gameState.availableHeroes.findIndex((hero) => hero.id === heroId);
        if (heroSlot < 0) return;
        void actions.invokeHero(heroSlot);
      },
      toggleHeroPicker,
      chooseSystemBonus: (symbol) => {
        void actions.chooseSystemBonus(toSystemTypeEnum(symbol));
      },
      nextAge: () => {
        void actions.nextAge();
      },
    };
  }, [actions, gameState, heroPickerOpen, selectCard, selectedCard, toggleHeroPicker]);

  return selector(storeState);
}
