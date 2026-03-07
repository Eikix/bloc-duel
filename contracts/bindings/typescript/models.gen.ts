import type { SchemaType as ISchemaType } from "@dojoengine/sdk";

import { CairoCustomEnum, BigNumberish } from 'starknet';

// Type definition for `bloc_duel::models::Game` struct
export interface Game {
	game_id: BigNumberish;
	player_one: string;
	player_two: string;
	current_player: BigNumberish;
	age: BigNumberish;
	phase: GamePhaseEnum;
	agi_one: BigNumberish;
	agi_two: BigNumberish;
	escalation: BigNumberish;
	winner: BigNumberish;
	win_condition: WinConditionEnum;
	seed: BigNumberish;
}

// Type definition for `bloc_duel::models::HeroPool` struct
export interface HeroPool {
	game_id: BigNumberish;
	hero_0: BigNumberish;
	hero_1: BigNumberish;
	hero_2: BigNumberish;
	hero_0_taken: boolean;
	hero_1_taken: boolean;
	hero_2_taken: boolean;
	used_mask: BigNumberish;
}

// Type definition for `bloc_duel::models::PendingChoice` struct
export interface PendingChoice {
	game_id: BigNumberish;
	active: boolean;
	player_index: BigNumberish;
	option_count: BigNumberish;
	option_0: SystemTypeEnum;
	option_1: SystemTypeEnum;
	option_2: SystemTypeEnum;
	option_3: SystemTypeEnum;
}

// Type definition for `bloc_duel::models::PlayerState` struct
export interface PlayerState {
	game_id: BigNumberish;
	player_index: BigNumberish;
	address: string;
	capital: BigNumberish;
	energy_prod: BigNumberish;
	materials_prod: BigNumberish;
	compute_prod: BigNumberish;
	compute_count: BigNumberish;
	finance_count: BigNumberish;
	cyber_count: BigNumberish;
	diplomacy_count: BigNumberish;
	compute_bonus: boolean;
	finance_bonus: boolean;
	cyber_bonus: boolean;
	diplomacy_bonus: boolean;
	made_system_choice: boolean;
	hero_count: BigNumberish;
	played_cards: BigNumberish;
}

// Type definition for `bloc_duel::models::Pyramid` struct
export interface Pyramid {
	game_id: BigNumberish;
	slot_0: BigNumberish;
	slot_1: BigNumberish;
	slot_2: BigNumberish;
	slot_3: BigNumberish;
	slot_4: BigNumberish;
	slot_5: BigNumberish;
	slot_6: BigNumberish;
	slot_7: BigNumberish;
	slot_8: BigNumberish;
	slot_9: BigNumberish;
	taken_mask: BigNumberish;
}

// Type definition for `bloc_duel::models::GamePhase` enum
export const gamePhase = [
	'Lobby',
	'Drafting',
	'AgeTransition',
	'GameOver',
] as const;
export type GamePhase = { [key in typeof gamePhase[number]]: string };
export type GamePhaseEnum = CairoCustomEnum;

// Type definition for `bloc_duel::models::SystemType` enum
export const systemType = [
	'None',
	'Compute',
	'Finance',
	'Cyber',
	'Diplomacy',
] as const;
export type SystemType = { [key in typeof systemType[number]]: string };
export type SystemTypeEnum = CairoCustomEnum;

// Type definition for `bloc_duel::models::WinCondition` enum
export const winCondition = [
	'None',
	'AgiBreakthrough',
	'EscalationDominance',
	'SystemsDominance',
	'Points',
] as const;
export type WinCondition = { [key in typeof winCondition[number]]: string };
export type WinConditionEnum = CairoCustomEnum;

export interface SchemaType extends ISchemaType {
	bloc_duel: {
		Game: Game,
		HeroPool: HeroPool,
		PendingChoice: PendingChoice,
		PlayerState: PlayerState,
		Pyramid: Pyramid,
	},
}
export const schema: SchemaType = {
	bloc_duel: {
		Game: {
			game_id: 0,
			player_one: "",
			player_two: "",
			current_player: 0,
			age: 0,
		phase: new CairoCustomEnum({ 
					Lobby: "",
				Drafting: undefined,
				AgeTransition: undefined,
				GameOver: undefined, }),
			agi_one: 0,
			agi_two: 0,
			escalation: 0,
			winner: 0,
		win_condition: new CairoCustomEnum({ 
					None: "",
				AgiBreakthrough: undefined,
				EscalationDominance: undefined,
				SystemsDominance: undefined,
				Points: undefined, }),
			seed: 0,
		},
		HeroPool: {
			game_id: 0,
			hero_0: 0,
			hero_1: 0,
			hero_2: 0,
			hero_0_taken: false,
			hero_1_taken: false,
			hero_2_taken: false,
			used_mask: 0,
		},
		PendingChoice: {
			game_id: 0,
			active: false,
			player_index: 0,
			option_count: 0,
		option_0: new CairoCustomEnum({ 
					None: "",
				Compute: undefined,
				Finance: undefined,
				Cyber: undefined,
				Diplomacy: undefined, }),
		option_1: new CairoCustomEnum({ 
					None: "",
				Compute: undefined,
				Finance: undefined,
				Cyber: undefined,
				Diplomacy: undefined, }),
		option_2: new CairoCustomEnum({ 
					None: "",
				Compute: undefined,
				Finance: undefined,
				Cyber: undefined,
				Diplomacy: undefined, }),
		option_3: new CairoCustomEnum({ 
					None: "",
				Compute: undefined,
				Finance: undefined,
				Cyber: undefined,
				Diplomacy: undefined, }),
		},
		PlayerState: {
			game_id: 0,
			player_index: 0,
			address: "",
			capital: 0,
			energy_prod: 0,
			materials_prod: 0,
			compute_prod: 0,
			compute_count: 0,
			finance_count: 0,
			cyber_count: 0,
			diplomacy_count: 0,
			compute_bonus: false,
			finance_bonus: false,
			cyber_bonus: false,
			diplomacy_bonus: false,
			made_system_choice: false,
			hero_count: 0,
			played_cards: 0,
		},
		Pyramid: {
			game_id: 0,
			slot_0: 0,
			slot_1: 0,
			slot_2: 0,
			slot_3: 0,
			slot_4: 0,
			slot_5: 0,
			slot_6: 0,
			slot_7: 0,
			slot_8: 0,
			slot_9: 0,
			taken_mask: 0,
		},
	},
};
export enum ModelsMapping {
	Game = 'bloc_duel-Game',
	GamePhase = 'bloc_duel-GamePhase',
	HeroPool = 'bloc_duel-HeroPool',
	PendingChoice = 'bloc_duel-PendingChoice',
	PlayerState = 'bloc_duel-PlayerState',
	Pyramid = 'bloc_duel-Pyramid',
	SystemType = 'bloc_duel-SystemType',
	WinCondition = 'bloc_duel-WinCondition',
}