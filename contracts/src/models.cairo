use starknet::ContractAddress;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug, DojoStore, Default)]
pub enum GamePhase {
    #[default]
    Lobby, // Waiting for player 2
    Drafting, // Normal play — draft cards or invoke heroes
    AgeTransition, // All pyramid cards taken, waiting for next_age
    GameOver,
}

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug, DojoStore, Default)]
pub enum CardType {
    #[default]
    AI, // Blue — advances AGI track
    Economy, // Amber — generates per-turn production
    Military, // Red — pushes escalation track
    System // Green — collects system symbols for bonuses/win
}

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug, DojoStore, Default)]
pub enum SystemType {
    #[default]
    None,
    Compute, // Pair bonus: +2 compute/turn
    Finance, // Pair bonus: +3 capital/turn
    Cyber, // Pair bonus: +2 energy/turn
    Diplomacy // Pair bonus: +2 materials/turn
}

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug, DojoStore, Default)]
pub enum WinCondition {
    #[default]
    None,
    AgiBreakthrough, // AGI track reached 6
    EscalationDominance, // Escalation track reached ±6
    SystemsDominance, // Collected all 4 system types
    Points // Highest score after age 3
}

// ---------------------------------------------------------------------------
// CardData — static card definition (NOT a dojo::model)
//
// All 30 cards are constants defined in a lookup function.
// No on-chain storage needed — the contract computes card data from IDs.
//
// BALANCING KNOBS PER CARD:
//   3 cost inputs:  energy_cost, materials_cost, compute_cost
//   7 effect outputs: agi, escalation, capital,
//                     energy_per_turn, materials_per_turn,
//                     compute_per_turn, capital_per_turn
//   1 system symbol: symbol (None / Compute / Finance / Cyber / Diplomacy)
//   1 chain link:    chain_from (prerequisite card ID, 255 = none)
// ---------------------------------------------------------------------------

#[derive(Copy, Drop, Serde, Introspect, Debug)]
pub struct CardData {
    pub id: u8, // 0-29, unique across all ages
    pub card_type: CardType,
    pub age: u8, // 1, 2, 3
    // --- Cost (3 knobs) ---
    // Resources required to play this card.
    // Production covers costs first; capital covers the remainder.
    // If chain_from was played, cost is waived entirely.
    pub energy_cost: u8, // 0-4
    pub materials_cost: u8, // 0-3
    pub compute_cost: u8, // 0-4
    // --- Effect: win-condition pushers (2 knobs) ---
    pub agi: u8, // +N to player's AGI track (win at 6)
    pub escalation: u8, // +N toward player's escalation side (win at ±6)
    // --- Effect: economy (5 knobs) ---
    pub capital: u8, // one-time capital grant on play
    pub energy_per_turn: u8, // permanent +N energy production
    pub materials_per_turn: u8, // permanent +N materials production
    pub compute_per_turn: u8, // permanent +N compute production
    pub capital_per_turn: u8, // permanent +N capital income (currently unused — available for future balancing)
    // --- Effect: system symbol (1 knob) ---
    // System cards grant a symbol toward the systems victory path.
    // Pair (2x same) = auto-bonus. 3 different = choose bonus. 4 different = instant win.
    pub symbol: SystemType,
    // --- Chain link (1 structural knob) ---
    // If the player already played chain_from, this card is FREE.
    // Chains reward long-term planning across ages.
    // 255 = no prerequisite (standalone card).
    pub chain_from: u8,
}

// ---------------------------------------------------------------------------
// HeroData — static hero definition (NOT a dojo::model)
//
// 10 heroes total, 3 available per age. Same cost/effect knob structure
// as cards, plus a surcharge (+2 capital per hero already owned).
// Heroes replace the card draft for the turn.
// ---------------------------------------------------------------------------

#[derive(Copy, Drop, Serde, Introspect, Debug)]
pub struct HeroData {
    pub id: u8, // 0-9, unique
    // --- Cost (3 knobs + implicit surcharge) ---
    pub energy_cost: u8, // 0-3
    pub materials_cost: u8, // 0-2
    pub compute_cost: u8, // 0-3
    // Surcharge: +2 capital per hero already owned (computed, not stored)

    // --- Effect (7 knobs) ---
    pub agi: u8, // 0-2
    pub escalation: u8, // 0-3
    pub capital: u8, // 0-5 (one-time)
    pub energy_per_turn: u8, // 0-3
    pub materials_per_turn: u8, // 0-1
    pub compute_per_turn: u8, // 0-2
    pub symbol: SystemType // system symbol grant (None if no symbol)
}

// ---------------------------------------------------------------------------
// Game — core match state (dojo::model)
//
// One instance per match. Tracks shared state: players, age, phase,
// win-condition tracks, and randomness seed for pyramid shuffling.
// ---------------------------------------------------------------------------

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Game {
    #[key]
    pub game_id: u32,
    // --- Players ---
    pub player_one: ContractAddress, // Atlantic — pushes escalation positive
    pub player_two: ContractAddress, // Continental — pushes escalation negative
    pub current_player: u8, // 0 = player_one's turn, 1 = player_two's turn
    // --- Age & phase ---
    pub age: u8, // 1, 2, 3
    pub phase: GamePhase,
    // --- Win-condition tracks ---
    // AGI: per-player, 0-6. Win at 6.
    pub agi_one: u8,
    pub agi_two: u8,
    // Escalation: shared, offset-encoded as 0-12 where 6 = neutral.
    //   0 = Continental wins (-6), 12 = Atlantic wins (+6).
    //   Player one (Atlantic) pushes toward 12.
    //   Player two (Continental) pushes toward 0.
    //   Win when track reaches 0 or 12.
    pub escalation: u8, // 0-12 (6 = neutral center)
    // --- Outcome ---
    pub winner: u8, // 0 = none, 1 = player_one, 2 = player_two, 3 = draw
    pub win_condition: WinCondition,
    // --- Randomness ---
    // Seed from Cartridge VRF, used for deterministic pyramid shuffling.
    pub seed: felt252,
}

// ---------------------------------------------------------------------------
// PlayerState — per-player resources and progress (dojo::model)
//
// Two instances per match (player_index 0 and 1).
// Tracks everything about a player's tableau: resources, production rates,
// system symbols, bonuses, heroes, and played cards.
// ---------------------------------------------------------------------------

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct PlayerState {
    #[key]
    pub game_id: u32,
    #[key]
    pub player_index: u8, // 0 = player_one, 1 = player_two
    pub address: ContractAddress,
    // --- Economy ---
    pub capital: u16, // Universal currency. Starts at 3. Uncapped.
    // Production converts to capital each turn.

    // --- Production rates (per-turn income → converted to capital) ---
    pub energy_prod: u8, // Accumulated from economy cards + bonuses
    pub materials_prod: u8,
    pub compute_prod: u8,
    // Total income per turn = energy_prod + materials_prod + compute_prod + finance_bonus(3)
    // All production is added to capital at the START of each turn.

    // --- System symbol counts ---
    // Not just presence — tracks COUNT per type for pair detection.
    // Pair bonus triggers when count >= 2 for any type.
    // 3 unique types → player chooses one bonus.
    // 4 unique types → instant Systems Dominance win.
    pub compute_count: u8, // How many COMPUTE symbols collected
    pub finance_count: u8, // How many FINANCE symbols collected
    pub cyber_count: u8, // How many CYBER symbols collected
    pub diplomacy_count: u8, // How many DIPLOMACY symbols collected
    // --- Active system bonus flags ---
    // Each pair bonus is applied at most once.
    // COMPUTE: +2 compute_prod, FINANCE: +3 capital/turn,
    // CYBER: +2 energy_prod, DIPLOMACY: +2 materials_prod.
    pub compute_bonus: bool,
    pub finance_bonus: bool,
    pub cyber_bonus: bool,
    pub diplomacy_bonus: bool,
    pub made_system_choice: bool, // True after 3-type choice is made (one-time)
    // --- Heroes ---
    pub hero_count: u8, // Number of heroes recruited.
    // Surcharge = hero_count * 2 capital.

    // --- Played cards bitmap ---
    // Bit N = 1 means card with ID N has been played by this player.
    // Used for O(1) chain verification: played_cards & (1 << chain_from) != 0.
    // 30 cards fit in 30 bits of a u32.
    pub played_cards: u32,
}

// ---------------------------------------------------------------------------
// Pyramid — current age's card layout (dojo::model)
//
// One instance per match. Rebuilt each age with shuffled cards.
// 10 slots arranged as: Row 0 [0], Row 1 [1,2], Row 2 [3,4,5], Row 3 [6,7,8,9].
// A card is available when ALL cards covering it have been taken (bottom row always available).
// Covering map: 0←[1,2], 1←[3,4], 2←[4,5], 3←[6,7], 4←[7,8], 5←[8,9].
// ---------------------------------------------------------------------------

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Pyramid {
    #[key]
    pub game_id: u32,
    // Card IDs at positions 0-9 (each u8, index into static card table)
    pub slot_0: u8,
    pub slot_1: u8,
    pub slot_2: u8,
    pub slot_3: u8,
    pub slot_4: u8,
    pub slot_5: u8,
    pub slot_6: u8,
    pub slot_7: u8,
    pub slot_8: u8,
    pub slot_9: u8,
    // Bitmask: bit N = 1 means position N has been taken.
    // All 10 taken (taken_mask == 0x3FF) → age transition.
    pub taken_mask: u16,
}

// ---------------------------------------------------------------------------
// HeroPool — available heroes for the current age (dojo::model)
//
// One instance per match. 3 heroes drawn each age from the unused pool.
// Heroes are never repeated across ages (tracked by used_mask).
// ---------------------------------------------------------------------------

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct HeroPool {
    #[key]
    pub game_id: u32,
    // Current age's 3 available hero IDs (index into static hero table)
    pub hero_0: u8,
    pub hero_1: u8,
    pub hero_2: u8,
    // Which of the 3 slots have been taken this age
    pub hero_0_taken: bool,
    pub hero_1_taken: bool,
    pub hero_2_taken: bool,
    // Bitmap: bit N = 1 means hero ID N has been used in a previous age.
    // 10 heroes fit in 10 bits. Prevents repeats when re-rolling each age.
    pub used_mask: u16,
}

// ---------------------------------------------------------------------------
// PendingChoice — blocking system bonus choice (dojo::model)
//
// When a player collects 3 unique system types, the game blocks until
// they choose which bonus to activate. This model captures that state.
// Cleared after choose_system_bonus() is called.
// ---------------------------------------------------------------------------

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct PendingChoice {
    #[key]
    pub game_id: u32,
    pub active: bool,
    pub player_index: u8,
    // Available options (up to 4 system types the player can pick from)
    pub option_count: u8,
    pub option_0: SystemType,
    pub option_1: SystemType,
    pub option_2: SystemType,
    pub option_3: SystemType,
}
