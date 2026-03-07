use bloc_duel::models::{SystemType};

// ---------------------------------------------------------------------------
// Actions interface — all game mutations go through here.
// ---------------------------------------------------------------------------

#[starknet::interface]
pub trait IActions<T> {
    fn create_game(ref self: T) -> u32;
    fn join_game(ref self: T, game_id: u32);
    fn play_card(ref self: T, game_id: u32, position: u8);
    fn discard_card(ref self: T, game_id: u32, position: u8);
    fn invoke_hero(ref self: T, game_id: u32, hero_slot: u8);
    fn choose_system_bonus(ref self: T, game_id: u32, symbol: SystemType);
    fn next_age(ref self: T, game_id: u32);
}

#[dojo::contract]
pub mod actions {
    #[allow(unused_imports)]
    use dojo::model::ModelStorage;
    #[allow(unused_imports)]
    use starknet::{ContractAddress, get_caller_address};
    use super::{IActions, SystemType};

    #[abi(embed_v0)]
    impl ActionsImpl of IActions<ContractState> {
        fn create_game(ref self: ContractState) -> u32 {
            // TODO: implement
            0
        }

        fn join_game(ref self: ContractState, game_id: u32) {
            // TODO: implement
        }

        fn play_card(ref self: ContractState, game_id: u32, position: u8) {
            // TODO: implement
        }

        fn discard_card(ref self: ContractState, game_id: u32, position: u8) {
            // TODO: implement
        }

        fn invoke_hero(ref self: ContractState, game_id: u32, hero_slot: u8) {
            // TODO: implement
        }

        fn choose_system_bonus(ref self: ContractState, game_id: u32, symbol: SystemType) {
            // TODO: implement
        }

        fn next_age(ref self: ContractState, game_id: u32) {
            // TODO: implement
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"bloc_duel")
        }
    }
}
