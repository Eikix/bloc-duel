import { KeysClause, ToriiQueryBuilder } from "@dojoengine/sdk";
import { useEntityId, useEntityQuery, useModel, useModels } from "@dojoengine/sdk/react";
import { useMemo } from "react";
import type { Hero } from "../game/heroes";
import { HEROES } from "../game/heroes";
import { ALL_CARDS } from "../game/cards";
import type { Card } from "../game/cards";
import type { PyramidNode } from "../game/pyramid";
import type { SystemSymbol } from "../game/systems";
import type { Game, HeroPool, PendingChoice, PlayerState, Pyramid, SchemaType, SystemTypeEnum } from "./models.gen";

export type Faction = "ATLANTIC" | "CONTINENTAL";
export type GamePhase = "DRAFTING" | "AGE_TRANSITION" | "GAME_OVER";

interface Production {
  energy: number;
  materials: number;
  compute: number;
}

export interface PlayerView {
  name: string;
  faction: Faction;
  capital: number;
  production: Production;
  systems: SystemSymbol[];
  activeSystemBonuses: SystemSymbol[];
  madeSystemChoice: boolean;
  heroes: Hero[];
  playedCards: string[];
  playedCardsMask: number;
}

export interface OnChainGameState {
  players: [PlayerView, PlayerView];
  currentPlayer: 0 | 1;
  age: 1 | 2 | 3;
  agiTrack: [number, number];
  escalationTrack: number;
  pyramid: PyramidNode[];
  phase: GamePhase;
  availableHeroes: Hero[];
  systemBonusChoice: { playerIndex: 0 | 1; options: SystemSymbol[] } | null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    try {
      return Number(BigInt(value));
    } catch {
      return Number(value);
    }
  }

  try {
    return Number(BigInt(String(value)));
  } catch {
    return 0;
  }
}

function toSystemSymbol(value: SystemTypeEnum | undefined): SystemSymbol | null {
  if (!value) return null;
  const active = value.activeVariant();
  if (active === "Compute") return "COMPUTE";
  if (active === "Finance") return "FINANCE";
  if (active === "Cyber") return "CYBER";
  if (active === "Diplomacy") return "DIPLOMACY";
  return null;
}

function toPhase(game: Game | undefined): GamePhase {
  if (!game) return "DRAFTING";
  const active = game.phase.activeVariant();
  if (active === "AgeTransition") return "AGE_TRANSITION";
  if (active === "GameOver") return "GAME_OVER";
  return "DRAFTING";
}

function rowForPosition(position: number): number {
  if (position === 0) return 0;
  if (position <= 2) return 1;
  if (position <= 5) return 2;
  return 3;
}

function cardById(cardId: number): Card {
  return ALL_CARDS[cardId] ?? ALL_CARDS[0];
}

function toPyramid(pyramid: Pyramid | undefined): PyramidNode[] {
  if (!pyramid) return [];
  const slots = [
    toNumber(pyramid.slot_0),
    toNumber(pyramid.slot_1),
    toNumber(pyramid.slot_2),
    toNumber(pyramid.slot_3),
    toNumber(pyramid.slot_4),
    toNumber(pyramid.slot_5),
    toNumber(pyramid.slot_6),
    toNumber(pyramid.slot_7),
    toNumber(pyramid.slot_8),
    toNumber(pyramid.slot_9),
  ];
  const takenMask = toNumber(pyramid.taken_mask);

  return slots.map((slot, position) => ({
    position,
    row: rowForPosition(position),
    card: cardById(slot),
    taken: ((takenMask >> position) & 1) === 1,
  }));
}

function playedCardsFromMask(mask: number): string[] {
  return ALL_CARDS.filter((_, index) => ((mask >> index) & 1) === 1).map((card) => card.id);
}

function makeHeroPlaceholders(count: number): Hero[] {
  return Array.from({ length: count }, (_, i) => {
    const base = HEROES[i % HEROES.length];
    return {
      ...base,
      id: `${base.id}-owned-${i}`,
    };
  });
}

function mapPlayer(state: PlayerState | undefined, index: 0 | 1): PlayerView {
  if (!state) {
    return {
      name: index === 0 ? "Atlantic Bloc" : "Continental Bloc",
      faction: index === 0 ? "ATLANTIC" : "CONTINENTAL",
      capital: 0,
      production: { energy: 0, materials: 0, compute: 0 },
      systems: [],
      activeSystemBonuses: [],
      madeSystemChoice: false,
      heroes: [],
      playedCards: [],
      playedCardsMask: 0,
    };
  }

  const computeCount = toNumber(state.compute_count);
  const financeCount = toNumber(state.finance_count);
  const cyberCount = toNumber(state.cyber_count);
  const diplomacyCount = toNumber(state.diplomacy_count);
  const playedCardsMask = toNumber(state.played_cards);

  const systems: SystemSymbol[] = [
    ...Array.from({ length: computeCount }, () => "COMPUTE" as const),
    ...Array.from({ length: financeCount }, () => "FINANCE" as const),
    ...Array.from({ length: cyberCount }, () => "CYBER" as const),
    ...Array.from({ length: diplomacyCount }, () => "DIPLOMACY" as const),
  ];

  const activeSystemBonuses: SystemSymbol[] = [];
  if (state.compute_bonus) activeSystemBonuses.push("COMPUTE");
  if (state.finance_bonus) activeSystemBonuses.push("FINANCE");
  if (state.cyber_bonus) activeSystemBonuses.push("CYBER");
  if (state.diplomacy_bonus) activeSystemBonuses.push("DIPLOMACY");

  return {
    name: index === 0 ? "Atlantic Bloc" : "Continental Bloc",
    faction: index === 0 ? "ATLANTIC" : "CONTINENTAL",
    capital: toNumber(state.capital),
    production: {
      energy: toNumber(state.energy_prod),
      materials: toNumber(state.materials_prod),
      compute: toNumber(state.compute_prod),
    },
    systems,
    activeSystemBonuses,
    madeSystemChoice: state.made_system_choice,
    heroes: makeHeroPlaceholders(toNumber(state.hero_count)),
    playedCards: playedCardsFromMask(playedCardsMask),
    playedCardsMask,
  };
}

function mapAvailableHeroes(heroPool: HeroPool | undefined): Hero[] {
  if (!heroPool) return [];

  const heroSlots = [
    { id: toNumber(heroPool.hero_0), taken: heroPool.hero_0_taken },
    { id: toNumber(heroPool.hero_1), taken: heroPool.hero_1_taken },
    { id: toNumber(heroPool.hero_2), taken: heroPool.hero_2_taken },
  ];

  return heroSlots
    .filter((slot) => !slot.taken)
    .map((slot) => HEROES[slot.id])
    .filter((hero): hero is Hero => Boolean(hero));
}

function mapPendingChoice(choice: PendingChoice | undefined): OnChainGameState["systemBonusChoice"] {
  if (!choice || !choice.active) return null;

  const optionCount = toNumber(choice.option_count);
  const optionsRaw = [choice.option_0, choice.option_1, choice.option_2, choice.option_3].slice(0, optionCount);
  const options = optionsRaw
    .map(toSystemSymbol)
    .filter((symbol): symbol is SystemSymbol => symbol !== null);

  if (options.length === 0) return null;

  return {
    playerIndex: toNumber(choice.player_index) === 0 ? 0 : 1,
    options,
  };
}

function findPlayerStateByIndex(models: Record<string, PlayerState | undefined>, gameId: number, index: 0 | 1): PlayerState | undefined {
  return Object.values(models).find((model) => {
    if (!model) return false;
    return toNumber(model.game_id) === gameId && toNumber(model.player_index) === index;
  });
}

export function useGameState(gameId: number | null): OnChainGameState {
  const currentGameId = gameId ?? -1;
  const gameKey = String(currentGameId);

  const gameQuery = useMemo(
    () => new ToriiQueryBuilder<SchemaType>().withClause(KeysClause<SchemaType>(["bloc_duel-Game"], [gameKey]).build()),
    [gameKey],
  );
  const playerQuery = useMemo(
    () =>
      new ToriiQueryBuilder<SchemaType>().withClause(
        KeysClause<SchemaType>(["bloc_duel-PlayerState"], [gameKey, undefined]).build(),
      ),
    [gameKey],
  );
  const pyramidQuery = useMemo(
    () =>
      new ToriiQueryBuilder<SchemaType>().withClause(
        KeysClause<SchemaType>(["bloc_duel-Pyramid"], [gameKey]).build(),
      ),
    [gameKey],
  );
  const heroPoolQuery = useMemo(
    () =>
      new ToriiQueryBuilder<SchemaType>().withClause(
        KeysClause<SchemaType>(["bloc_duel-HeroPool"], [gameKey]).build(),
      ),
    [gameKey],
  );
  const pendingChoiceQuery = useMemo(
    () =>
      new ToriiQueryBuilder<SchemaType>().withClause(
        KeysClause<SchemaType>(["bloc_duel-PendingChoice"], [gameKey]).build(),
      ),
    [gameKey],
  );

  useEntityQuery<SchemaType>(gameQuery);
  useEntityQuery<SchemaType>(playerQuery);
  useEntityQuery<SchemaType>(pyramidQuery);
  useEntityQuery<SchemaType>(heroPoolQuery);
  useEntityQuery<SchemaType>(pendingChoiceQuery);

  const gameEntityId = useEntityId(currentGameId);
  const playerOneEntityId = useEntityId(currentGameId, 0);
  const playerTwoEntityId = useEntityId(currentGameId, 1);

  const game = useModel(gameEntityId, "bloc_duel-Game") as Game | undefined;
  const pyramid = useModel(gameEntityId, "bloc_duel-Pyramid") as Pyramid | undefined;
  const heroPool = useModel(gameEntityId, "bloc_duel-HeroPool") as HeroPool | undefined;
  const pendingChoice = useModel(gameEntityId, "bloc_duel-PendingChoice") as PendingChoice | undefined;
  const allPlayerStates = useModels("bloc_duel-PlayerState") as Record<string, PlayerState | undefined>;
  const playerOneByEntity = useModel(playerOneEntityId, "bloc_duel-PlayerState") as PlayerState | undefined;
  const playerTwoByEntity = useModel(playerTwoEntityId, "bloc_duel-PlayerState") as PlayerState | undefined;

  return useMemo(() => {
    const playerOne = playerOneByEntity ?? findPlayerStateByIndex(allPlayerStates, currentGameId, 0);
    const playerTwo = playerTwoByEntity ?? findPlayerStateByIndex(allPlayerStates, currentGameId, 1);

    const ageRaw = toNumber(game?.age ?? 1);
    const age = ageRaw === 2 || ageRaw === 3 ? ageRaw : 1;
    const currentPlayer = toNumber(game?.current_player ?? 0) === 0 ? 0 : 1;

    return {
      players: [mapPlayer(playerOne, 0), mapPlayer(playerTwo, 1)],
      currentPlayer,
      age,
      agiTrack: [toNumber(game?.agi_one ?? 0), toNumber(game?.agi_two ?? 0)],
      escalationTrack: toNumber(game?.escalation ?? 6) - 6,
      pyramid: toPyramid(pyramid),
      phase: toPhase(game),
      availableHeroes: mapAvailableHeroes(heroPool),
      systemBonusChoice: mapPendingChoice(pendingChoice),
    };
  }, [allPlayerStates, currentGameId, game, heroPool, pendingChoice, playerOneByEntity, playerTwoByEntity, pyramid]);
}
