import { DojoProvider, DojoCall } from "@dojoengine/core";
import { Account, AccountInterface, BigNumberish, CairoOption, CairoCustomEnum } from "starknet";
import * as models from "./models.gen";

export function setupWorld(provider: DojoProvider) {

	const build_actions_chooseSystemBonus_calldata = (gameId: BigNumberish, symbol: CairoCustomEnum): DojoCall => {
		return {
			contractName: "actions",
			entrypoint: "choose_system_bonus",
			calldata: [gameId, symbol],
		};
	};

	const actions_chooseSystemBonus = async (snAccount: Account | AccountInterface, gameId: BigNumberish, symbol: CairoCustomEnum) => {
		try {
			return await provider.execute(
				snAccount,
				build_actions_chooseSystemBonus_calldata(gameId, symbol),
				"bloc_duel",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_actions_createGame_calldata = (): DojoCall => {
		return {
			contractName: "actions",
			entrypoint: "create_game",
			calldata: [],
		};
	};

	const actions_createGame = async (snAccount: Account | AccountInterface) => {
		try {
			return await provider.execute(
				snAccount,
				build_actions_createGame_calldata(),
				"bloc_duel",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_actions_discardCard_calldata = (gameId: BigNumberish, position: BigNumberish): DojoCall => {
		return {
			contractName: "actions",
			entrypoint: "discard_card",
			calldata: [gameId, position],
		};
	};

	const actions_discardCard = async (snAccount: Account | AccountInterface, gameId: BigNumberish, position: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_actions_discardCard_calldata(gameId, position),
				"bloc_duel",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_actions_invokeHero_calldata = (gameId: BigNumberish, heroSlot: BigNumberish): DojoCall => {
		return {
			contractName: "actions",
			entrypoint: "invoke_hero",
			calldata: [gameId, heroSlot],
		};
	};

	const actions_invokeHero = async (snAccount: Account | AccountInterface, gameId: BigNumberish, heroSlot: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_actions_invokeHero_calldata(gameId, heroSlot),
				"bloc_duel",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_actions_joinGame_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "actions",
			entrypoint: "join_game",
			calldata: [gameId],
		};
	};

	const actions_joinGame = async (snAccount: Account | AccountInterface, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_actions_joinGame_calldata(gameId),
				"bloc_duel",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_actions_nextAge_calldata = (gameId: BigNumberish): DojoCall => {
		return {
			contractName: "actions",
			entrypoint: "next_age",
			calldata: [gameId],
		};
	};

	const actions_nextAge = async (snAccount: Account | AccountInterface, gameId: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_actions_nextAge_calldata(gameId),
				"bloc_duel",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	const build_actions_playCard_calldata = (gameId: BigNumberish, position: BigNumberish): DojoCall => {
		return {
			contractName: "actions",
			entrypoint: "play_card",
			calldata: [gameId, position],
		};
	};

	const actions_playCard = async (snAccount: Account | AccountInterface, gameId: BigNumberish, position: BigNumberish) => {
		try {
			return await provider.execute(
				snAccount,
				build_actions_playCard_calldata(gameId, position),
				"bloc_duel",
			);
		} catch (error) {
			console.error(error);
			throw error;
		}
	};



	return {
		actions: {
			chooseSystemBonus: actions_chooseSystemBonus,
			buildChooseSystemBonusCalldata: build_actions_chooseSystemBonus_calldata,
			createGame: actions_createGame,
			buildCreateGameCalldata: build_actions_createGame_calldata,
			discardCard: actions_discardCard,
			buildDiscardCardCalldata: build_actions_discardCard_calldata,
			invokeHero: actions_invokeHero,
			buildInvokeHeroCalldata: build_actions_invokeHero_calldata,
			joinGame: actions_joinGame,
			buildJoinGameCalldata: build_actions_joinGame_calldata,
			nextAge: actions_nextAge,
			buildNextAgeCalldata: build_actions_nextAge_calldata,
			playCard: actions_playCard,
			buildPlayCardCalldata: build_actions_playCard_calldata,
		},
	};
}