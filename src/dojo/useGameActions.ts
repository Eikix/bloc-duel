import { useCallback, useMemo } from "react";
import { CairoCustomEnum } from "starknet";
import type { SystemSymbol } from "../game/systems";
import { useUIStore } from "../store/gameStore";
import { useDojo } from "./useDojo";

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);

  if (typeof value === "string") {
    try {
      return Number(BigInt(value));
    } catch {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
  }

  return null;
}

function extractGameId(value: unknown): number | null {
  const numeric = toNumber(value);
  if (numeric !== null) return numeric;

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractGameId(item);
      if (nested !== null) return nested;
    }
    return null;
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const directKeys = ["game_id", "gameId", "game", "id"];
    for (const key of directKeys) {
      if (key in record) {
        const nested = extractGameId(record[key]);
        if (nested !== null) return nested;
      }
    }
    for (const nestedValue of Object.values(record)) {
      const nested = extractGameId(nestedValue);
      if (nested !== null) return nested;
    }
  }

  return null;
}

export function toSystemTypeEnum(symbol: SystemSymbol): CairoCustomEnum {
  if (symbol === "COMPUTE") {
    return new CairoCustomEnum({ None: undefined, Compute: "", Finance: undefined, Cyber: undefined, Diplomacy: undefined });
  }
  if (symbol === "FINANCE") {
    return new CairoCustomEnum({ None: undefined, Compute: undefined, Finance: "", Cyber: undefined, Diplomacy: undefined });
  }
  if (symbol === "CYBER") {
    return new CairoCustomEnum({ None: undefined, Compute: undefined, Finance: undefined, Cyber: "", Diplomacy: undefined });
  }
  return new CairoCustomEnum({ None: undefined, Compute: undefined, Finance: undefined, Cyber: undefined, Diplomacy: "" });
}

export function useGameActions() {
  const { client, account } = useDojo();
  const { gameId } = useUIStore();

  const createGame = useCallback(async () => {
    if (!account) return;
    const result = await client.actions.createGame(account);
    const createdGameId = extractGameId(result);
    if (createdGameId !== null) {
      useUIStore.getState().setGameId(createdGameId);
    }
  }, [account, client]);

  const joinGame = useCallback(
    async (nextGameId: number) => {
      if (!account) return;
      await client.actions.joinGame(account, nextGameId);
      useUIStore.getState().setGameId(nextGameId);
    },
    [account, client],
  );

  const playCard = useCallback(
    async (position: number) => {
      if (!account || gameId === null) return;
      await client.actions.playCard(account, gameId, position);
      useUIStore.getState().selectCard(null);
    },
    [account, client, gameId],
  );

  const discardCard = useCallback(
    async (position: number) => {
      if (!account || gameId === null) return;
      await client.actions.discardCard(account, gameId, position);
      useUIStore.getState().selectCard(null);
    },
    [account, client, gameId],
  );

  const invokeHero = useCallback(
    async (heroSlot: number) => {
      if (!account || gameId === null) return;
      await client.actions.invokeHero(account, gameId, heroSlot);
      useUIStore.getState().toggleHeroPicker();
    },
    [account, client, gameId],
  );

  const chooseSystemBonus = useCallback(
    async (symbol: CairoCustomEnum) => {
      if (!account || gameId === null) return;
      await client.actions.chooseSystemBonus(account, gameId, symbol);
    },
    [account, client, gameId],
  );

  const nextAge = useCallback(async () => {
    if (!account || gameId === null) return;
    await client.actions.nextAge(account, gameId);
  }, [account, client, gameId]);

  return useMemo(
    () => ({
      createGame,
      joinGame,
      playCard,
      discardCard,
      invokeHero,
      chooseSystemBonus,
      nextAge,
    }),
    [chooseSystemBonus, createGame, discardCard, invokeHero, joinGame, nextAge, playCard],
  );
}
