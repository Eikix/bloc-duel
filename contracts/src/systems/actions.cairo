use bloc_duel::models::SystemType;

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
    use core::poseidon::poseidon_hash_span;
    #[allow(unused_imports)]
    use starknet::{ContractAddress, get_caller_address, get_tx_info};
    use bloc_duel::cards::{get_card, get_cards_for_age};
    use bloc_duel::heroes::{get_hero, hero_count};
    use bloc_duel::pyramid as pyramid_logic;
    use bloc_duel::shuffle::{select_n, shuffle_with_seed};
    use bloc_duel::models::{
        Game, GamePhase, HeroPool, PendingChoice, PlayerState, Pyramid, SystemType, WinCondition,
    };
    use super::IActions;

    #[abi(embed_v0)]
    impl ActionsImpl of IActions<ContractState> {
        fn create_game(ref self: ContractState) -> u32 {
            let caller = get_caller_address();
            let tx_info = get_tx_info().unbox();
            let game_seed = poseidon_hash_span(array![caller.into(), tx_info.transaction_hash].span());
            let raw_id = felt_to_u32(game_seed);
            let game_id = if raw_id == 0 { 1 } else { raw_id };

            let empty_address = zero_address();

            let game = Game {
                game_id,
                player_one: caller,
                player_two: empty_address,
                current_player: 0,
                age: 1,
                phase: GamePhase::Lobby,
                agi_one: 0,
                agi_two: 0,
                escalation: 6,
                winner: 0,
                win_condition: WinCondition::None,
                seed: game_seed,
            };

            let p0 = PlayerState {
                game_id,
                player_index: 0,
                address: caller,
                capital: 3,
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
            };

            let p1 = PlayerState {
                game_id,
                player_index: 1,
                address: empty_address,
                capital: 3,
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
            };

            let pyramid = Pyramid {
                game_id,
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
            };

            let heroes = HeroPool {
                game_id,
                hero_0: 0,
                hero_1: 0,
                hero_2: 0,
                hero_0_taken: false,
                hero_1_taken: false,
                hero_2_taken: false,
                used_mask: 0,
            };

            let pending = PendingChoice {
                game_id,
                active: false,
                player_index: 0,
                option_count: 0,
                option_0: SystemType::None,
                option_1: SystemType::None,
                option_2: SystemType::None,
                option_3: SystemType::None,
            };

            let mut world = self.world_default();
            world.write_model(@game);
            world.write_model(@p0);
            world.write_model(@p1);
            world.write_model(@pyramid);
            world.write_model(@heroes);
            world.write_model(@pending);

            game_id
        }

        fn join_game(ref self: ContractState, game_id: u32) {
            let caller = get_caller_address();
            let mut world = self.world_default();

            let mut game: Game = world.read_model(game_id);
            assert(game.phase == GamePhase::Lobby, 'not in lobby');
            assert(game.player_one != zero_address(), 'game missing');
            assert(caller != game.player_one, 'same player');

            game.player_two = caller;
            game.phase = GamePhase::Drafting;

            let mut p1: PlayerState = world.read_model((game_id, 1_u8));
            p1.address = caller;
            p1.capital = 3;

            let tx_seed = poseidon_hash_span(array![get_tx_info().unbox().transaction_hash].span());
            game.seed = poseidon_hash_span(array![tx_seed, game_id.into(), 1].span());

            let shuffled = deal_age_cards(game.seed, 1);
            let pyramid = pyramid_from_cards(game_id, shuffled);

            let (hero_ids, used_mask) = select_n(
                poseidon_hash_span(array![game.seed, 999].span()),
                hero_count(),
                3,
                0,
            );
            let hero_pool = HeroPool {
                game_id,
                hero_0: *hero_ids.at(0),
                hero_1: *hero_ids.at(1),
                hero_2: *hero_ids.at(2),
                hero_0_taken: false,
                hero_1_taken: false,
                hero_2_taken: false,
                used_mask,
            };

            let pending = PendingChoice {
                game_id,
                active: false,
                player_index: 0,
                option_count: 0,
                option_0: SystemType::None,
                option_1: SystemType::None,
                option_2: SystemType::None,
                option_3: SystemType::None,
            };

            world.write_model(@game);
            world.write_model(@p1);
            world.write_model(@pyramid);
            world.write_model(@hero_pool);
            world.write_model(@pending);
        }

        fn play_card(ref self: ContractState, game_id: u32, position: u8) {
            let caller = get_caller_address();
            let mut world = self.world_default();

            let mut game: Game = world.read_model(game_id);
            let mut p0: PlayerState = world.read_model((game_id, 0_u8));
            let mut p1: PlayerState = world.read_model((game_id, 1_u8));
            let mut pyramid: Pyramid = world.read_model(game_id);
            let mut pending: PendingChoice = world.read_model(game_id);
            let hero_pool: HeroPool = world.read_model(game_id);

            assert(game.phase == GamePhase::Drafting, 'not drafting');
            assert(!pending.active, 'pending choice');
            assert(is_current_player(caller, @game, @p0, @p1), 'not your turn');
            validate_position(position, pyramid.taken_mask);

            let card_id = get_slot(@pyramid, position);
            let card = get_card(card_id);

            if game.current_player == 0 {
                let chain_active = chain_is_active(@p0, card.chain_from);
                let energy_cost = if chain_active { 0 } else { card.energy_cost };
                let materials_cost = if chain_active { 0 } else { card.materials_cost };
                let compute_cost = if chain_active { 0 } else { card.compute_cost };

                assert(can_afford(@p0, energy_cost, materials_cost, compute_cost, 0), 'cannot afford');
                pay_cost(ref p0, energy_cost, materials_cost, compute_cost, 0);
                apply_common_effects(
                    ref game,
                    ref p0,
                    0,
                    card.agi,
                    card.escalation,
                    card.capital,
                    card.energy_per_turn,
                    card.materials_per_turn,
                    card.compute_per_turn,
                    card.capital_per_turn,
                );
                p0.played_cards = p0.played_cards | bit_for_card(card.id);
                if card.symbol != SystemType::None {
                    grant_symbol(ref p0, card.symbol);
                    resolve_system_progress(ref game, ref p0, ref pending, 0);
                }
            } else {
                let chain_active = chain_is_active(@p1, card.chain_from);
                let energy_cost = if chain_active { 0 } else { card.energy_cost };
                let materials_cost = if chain_active { 0 } else { card.materials_cost };
                let compute_cost = if chain_active { 0 } else { card.compute_cost };

                assert(can_afford(@p1, energy_cost, materials_cost, compute_cost, 0), 'cannot afford');
                pay_cost(ref p1, energy_cost, materials_cost, compute_cost, 0);
                apply_common_effects(
                    ref game,
                    ref p1,
                    1,
                    card.agi,
                    card.escalation,
                    card.capital,
                    card.energy_per_turn,
                    card.materials_per_turn,
                    card.compute_per_turn,
                    card.capital_per_turn,
                );
                p1.played_cards = p1.played_cards | bit_for_card(card.id);
                if card.symbol != SystemType::None {
                    grant_symbol(ref p1, card.symbol);
                    resolve_system_progress(ref game, ref p1, ref pending, 1);
                }
            }

            pyramid.taken_mask = pyramid_logic::mark_taken(pyramid.taken_mask, position);

            if game.phase != GamePhase::GameOver && !pending.active {
                next_turn(ref game, ref p0, ref p1, ref pyramid);
            }

            world.write_model(@game);
            world.write_model(@p0);
            world.write_model(@p1);
            world.write_model(@pyramid);
            world.write_model(@hero_pool);
            world.write_model(@pending);
        }

        fn discard_card(ref self: ContractState, game_id: u32, position: u8) {
            let caller = get_caller_address();
            let mut world = self.world_default();

            let mut game: Game = world.read_model(game_id);
            let mut p0: PlayerState = world.read_model((game_id, 0_u8));
            let mut p1: PlayerState = world.read_model((game_id, 1_u8));
            let mut pyramid: Pyramid = world.read_model(game_id);
            let pending: PendingChoice = world.read_model(game_id);
            let hero_pool: HeroPool = world.read_model(game_id);

            assert(game.phase == GamePhase::Drafting, 'not drafting');
            assert(!pending.active, 'pending choice');
            assert(is_current_player(caller, @game, @p0, @p1), 'not your turn');
            validate_position(position, pyramid.taken_mask);

            if game.current_player == 0 {
                p0.capital += game.age.into();
            } else {
                p1.capital += game.age.into();
            }

            pyramid.taken_mask = pyramid_logic::mark_taken(pyramid.taken_mask, position);
            next_turn(ref game, ref p0, ref p1, ref pyramid);

            world.write_model(@game);
            world.write_model(@p0);
            world.write_model(@p1);
            world.write_model(@pyramid);
            world.write_model(@hero_pool);
            world.write_model(@pending);
        }

        fn invoke_hero(ref self: ContractState, game_id: u32, hero_slot: u8) {
            let caller = get_caller_address();
            let mut world = self.world_default();

            let mut game: Game = world.read_model(game_id);
            let mut p0: PlayerState = world.read_model((game_id, 0_u8));
            let mut p1: PlayerState = world.read_model((game_id, 1_u8));
            let pyramid: Pyramid = world.read_model(game_id);
            let mut hero_pool: HeroPool = world.read_model(game_id);
            let mut pending: PendingChoice = world.read_model(game_id);

            assert(game.phase == GamePhase::Drafting, 'not drafting');
            assert(!pending.active, 'pending choice');
            assert(is_current_player(caller, @game, @p0, @p1), 'not your turn');
            assert(hero_slot <= 2, 'invalid hero');

            let hero_id = get_hero_slot(@hero_pool, hero_slot);
            assert(!is_hero_slot_taken(@hero_pool, hero_slot), 'hero taken');

            let hero = get_hero(hero_id);
            if game.current_player == 0 {
                let surcharge: u16 = (p0.hero_count * 2).into();
                assert(
                    can_afford(@p0, hero.energy_cost, hero.materials_cost, hero.compute_cost, surcharge),
                    'cannot afford',
                );

                pay_cost(ref p0, hero.energy_cost, hero.materials_cost, hero.compute_cost, surcharge);
                apply_common_effects(
                    ref game,
                    ref p0,
                    0,
                    hero.agi,
                    hero.escalation,
                    hero.capital,
                    hero.energy_per_turn,
                    hero.materials_per_turn,
                    hero.compute_per_turn,
                    0,
                );
                p0.hero_count += 1;
                if hero.symbol != SystemType::None {
                    grant_symbol(ref p0, hero.symbol);
                    resolve_system_progress(ref game, ref p0, ref pending, 0);
                }
            } else {
                let surcharge: u16 = (p1.hero_count * 2).into();
                assert(
                    can_afford(@p1, hero.energy_cost, hero.materials_cost, hero.compute_cost, surcharge),
                    'cannot afford',
                );

                pay_cost(ref p1, hero.energy_cost, hero.materials_cost, hero.compute_cost, surcharge);
                apply_common_effects(
                    ref game,
                    ref p1,
                    1,
                    hero.agi,
                    hero.escalation,
                    hero.capital,
                    hero.energy_per_turn,
                    hero.materials_per_turn,
                    hero.compute_per_turn,
                    0,
                );
                p1.hero_count += 1;
                if hero.symbol != SystemType::None {
                    grant_symbol(ref p1, hero.symbol);
                    resolve_system_progress(ref game, ref p1, ref pending, 1);
                }
            }

            set_hero_slot_taken(ref hero_pool, hero_slot);

            if game.phase != GamePhase::GameOver && !pending.active {
                let mut pyramid_mut = pyramid;
                next_turn(ref game, ref p0, ref p1, ref pyramid_mut);
                world.write_model(@pyramid_mut);
            } else {
                world.write_model(@pyramid);
            }

            world.write_model(@game);
            world.write_model(@p0);
            world.write_model(@p1);
            world.write_model(@hero_pool);
            world.write_model(@pending);
        }

        fn choose_system_bonus(ref self: ContractState, game_id: u32, symbol: SystemType) {
            let caller = get_caller_address();
            let mut world = self.world_default();

            let mut game: Game = world.read_model(game_id);
            let mut p0: PlayerState = world.read_model((game_id, 0_u8));
            let mut p1: PlayerState = world.read_model((game_id, 1_u8));
            let mut pyramid: Pyramid = world.read_model(game_id);
            let hero_pool: HeroPool = world.read_model(game_id);
            let mut pending: PendingChoice = world.read_model(game_id);

            assert(game.phase == GamePhase::Drafting, 'not drafting');
            assert(pending.active, 'no pending');
            assert(is_current_player(caller, @game, @p0, @p1), 'not your turn');
            assert(pending.player_index == game.current_player, 'wrong player');
            assert(option_contains(@pending, symbol), 'invalid option');

            if game.current_player == 0 {
                apply_system_bonus(ref p0, symbol);
                p0.made_system_choice = true;
            } else {
                apply_system_bonus(ref p1, symbol);
                p1.made_system_choice = true;
            }

            pending.active = false;
            pending.option_count = 0;
            pending.option_0 = SystemType::None;
            pending.option_1 = SystemType::None;
            pending.option_2 = SystemType::None;
            pending.option_3 = SystemType::None;

            if game.phase != GamePhase::GameOver {
                next_turn(ref game, ref p0, ref p1, ref pyramid);
            }

            world.write_model(@game);
            world.write_model(@p0);
            world.write_model(@p1);
            world.write_model(@pyramid);
            world.write_model(@hero_pool);
            world.write_model(@pending);
        }

        fn next_age(ref self: ContractState, game_id: u32) {
            let mut world = self.world_default();

            let mut game: Game = world.read_model(game_id);
            let mut hero_pool: HeroPool = world.read_model(game_id);
            let pending: PendingChoice = world.read_model(game_id);
            let p0: PlayerState = world.read_model((game_id, 0_u8));
            let p1: PlayerState = world.read_model((game_id, 1_u8));

            assert(game.phase == GamePhase::AgeTransition, 'not transition');
            assert(game.age < 3, 'final age');
            assert(!pending.active, 'pending choice');

            game.age += 1;
            game.current_player = if game.current_player == 0 { 1 } else { 0 };
            game.phase = GamePhase::Drafting;
            game.seed = poseidon_hash_span(array![game.seed, game.age.into(), game_id.into()].span());

            let shuffled = deal_age_cards(game.seed, game.age);
            let pyramid = pyramid_from_cards(game_id, shuffled);

            let (hero_ids, new_mask) = select_n(
                poseidon_hash_span(array![game.seed, 777].span()),
                hero_count(),
                3,
                hero_pool.used_mask,
            );
            hero_pool.hero_0 = *hero_ids.at(0);
            hero_pool.hero_1 = *hero_ids.at(1);
            hero_pool.hero_2 = *hero_ids.at(2);
            hero_pool.hero_0_taken = false;
            hero_pool.hero_1_taken = false;
            hero_pool.hero_2_taken = false;
            hero_pool.used_mask = new_mask;

            world.write_model(@game);
            world.write_model(@pyramid);
            world.write_model(@hero_pool);
            world.write_model(@pending);
            world.write_model(@p0);
            world.write_model(@p1);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"bloc_duel")
        }
    }

    fn zero_address() -> ContractAddress {
        0.try_into().unwrap()
    }

    fn felt_to_u32(value: felt252) -> u32 {
        let value_u256: u256 = value.into();
        let modulo: u256 = 4294967296_u64.into();
        let reduced = value_u256 % modulo;
        reduced.try_into().unwrap()
    }

    fn bit_for_card(card_id: u8) -> u32 {
        let mut bit = 1_u32;
        let mut i: u8 = 0;
        loop {
            if i == card_id {
                break;
            }
            bit *= 2;
            i += 1;
        }
        bit
    }

    fn bit_for_position(position: u8) -> u16 {
        match position {
            0 => 0x001,
            1 => 0x002,
            2 => 0x004,
            3 => 0x008,
            4 => 0x010,
            5 => 0x020,
            6 => 0x040,
            7 => 0x080,
            8 => 0x100,
            9 => 0x200,
            _ => 0,
        }
    }

    fn validate_position(position: u8, taken_mask: u16) {
        assert(position < 10, 'invalid pos');
        assert((taken_mask & bit_for_position(position)) == 0, 'already taken');
        assert(pyramid_logic::is_available(position, taken_mask), 'card blocked');
    }

    fn get_slot(pyramid: @Pyramid, position: u8) -> u8 {
        match position {
            0 => *pyramid.slot_0,
            1 => *pyramid.slot_1,
            2 => *pyramid.slot_2,
            3 => *pyramid.slot_3,
            4 => *pyramid.slot_4,
            5 => *pyramid.slot_5,
            6 => *pyramid.slot_6,
            7 => *pyramid.slot_7,
            8 => *pyramid.slot_8,
            9 => *pyramid.slot_9,
            _ => panic!("invalid pos"),
        }
    }

    fn is_current_player(caller: ContractAddress, game: @Game, p0: @PlayerState, p1: @PlayerState) -> bool {
        if *game.current_player == 0 {
            caller == *p0.address
        } else {
            caller == *p1.address
        }
    }

    fn chain_is_active(player: @PlayerState, chain_from: u8) -> bool {
        if chain_from == 255 {
            return false;
        }

        (*player.played_cards & bit_for_card(chain_from)) != 0
    }

    fn can_afford(
        player: @PlayerState,
        energy_cost: u8,
        materials_cost: u8,
        compute_cost: u8,
        extra_capital: u16,
    ) -> bool {
        let e_need: u16 = if energy_cost > *player.energy_prod {
            (energy_cost - *player.energy_prod).into()
        } else {
            0
        };
        let m_need: u16 = if materials_cost > *player.materials_prod {
            (materials_cost - *player.materials_prod).into()
        } else {
            0
        };
        let c_need: u16 = if compute_cost > *player.compute_prod {
            (compute_cost - *player.compute_prod).into()
        } else {
            0
        };

        *player.capital >= e_need + m_need + c_need + extra_capital
    }

    fn pay_cost(
        ref player: PlayerState,
        energy_cost: u8,
        materials_cost: u8,
        compute_cost: u8,
        extra_capital: u16,
    ) {
        let e_need: u16 = if energy_cost > player.energy_prod {
            (energy_cost - player.energy_prod).into()
        } else {
            0
        };
        let m_need: u16 = if materials_cost > player.materials_prod {
            (materials_cost - player.materials_prod).into()
        } else {
            0
        };
        let c_need: u16 = if compute_cost > player.compute_prod {
            (compute_cost - player.compute_prod).into()
        } else {
            0
        };

        player.capital -= e_need + m_need + c_need + extra_capital;
    }

    fn clamp(value: u8, min: u8, max: u8) -> u8 {
        if value < min {
            min
        } else if value > max {
            max
        } else {
            value
        }
    }

    fn apply_common_effects(
        ref game: Game,
        ref player: PlayerState,
        current_player: u8,
        agi_delta: u8,
        escalation_delta: u8,
        capital_delta: u8,
        energy_delta: u8,
        materials_delta: u8,
        compute_delta: u8,
        capital_per_turn_delta: u8,
    ) {
        player.capital += capital_delta.into();
        player.capital += capital_per_turn_delta.into();
        player.energy_prod += energy_delta;
        player.materials_prod += materials_delta;
        player.compute_prod += compute_delta;

        if agi_delta > 0 {
            if current_player == 0 {
                game.agi_one = clamp(game.agi_one + agi_delta, 0, 6);
                if game.agi_one == 6 {
                    end_game(ref game, 1, WinCondition::AgiBreakthrough);
                }
            } else {
                game.agi_two = clamp(game.agi_two + agi_delta, 0, 6);
                if game.agi_two == 6 {
                    end_game(ref game, 2, WinCondition::AgiBreakthrough);
                }
            }
        }

        if game.phase != GamePhase::GameOver && escalation_delta > 0 {
            if current_player == 0 {
                game.escalation = clamp(game.escalation + escalation_delta, 0, 12);
                if game.escalation == 12 {
                    end_game(ref game, 1, WinCondition::EscalationDominance);
                }
            } else {
                let stepped = if escalation_delta > game.escalation {
                    0
                } else {
                    game.escalation - escalation_delta
                };
                game.escalation = clamp(stepped, 0, 12);
                if game.escalation == 0 {
                    end_game(ref game, 2, WinCondition::EscalationDominance);
                }
            }
        }
    }

    fn end_game(ref game: Game, winner: u8, condition: WinCondition) {
        game.phase = GamePhase::GameOver;
        game.winner = winner;
        game.win_condition = condition;
    }

    fn grant_symbol(ref player: PlayerState, symbol: SystemType) {
        match symbol {
            SystemType::Compute => player.compute_count += 1,
            SystemType::Finance => player.finance_count += 1,
            SystemType::Cyber => player.cyber_count += 1,
            SystemType::Diplomacy => player.diplomacy_count += 1,
            SystemType::None => {},
        }
    }

    fn apply_system_bonus(ref player: PlayerState, symbol: SystemType) {
        match symbol {
            SystemType::Compute => {
                if !player.compute_bonus {
                    player.compute_prod += 2;
                    player.compute_bonus = true;
                }
            },
            SystemType::Finance => {
                player.finance_bonus = true;
            },
            SystemType::Cyber => {
                if !player.cyber_bonus {
                    player.energy_prod += 2;
                    player.cyber_bonus = true;
                }
            },
            SystemType::Diplomacy => {
                if !player.diplomacy_bonus {
                    player.materials_prod += 2;
                    player.diplomacy_bonus = true;
                }
            },
            SystemType::None => {},
        }
    }

    fn resolve_system_progress(
        ref game: Game,
        ref player: PlayerState,
        ref pending: PendingChoice,
        player_index: u8,
    ) {
        if player.compute_count >= 2 {
            apply_system_bonus(ref player, SystemType::Compute);
        }
        if player.finance_count >= 2 {
            apply_system_bonus(ref player, SystemType::Finance);
        }
        if player.cyber_count >= 2 {
            apply_system_bonus(ref player, SystemType::Cyber);
        }
        if player.diplomacy_count >= 2 {
            apply_system_bonus(ref player, SystemType::Diplomacy);
        }

        let mut unique: u8 = 0;
        if player.compute_count > 0 {
            unique += 1;
        }
        if player.finance_count > 0 {
            unique += 1;
        }
        if player.cyber_count > 0 {
            unique += 1;
        }
        if player.diplomacy_count > 0 {
            unique += 1;
        }

        if unique == 4 {
            let winner = if player_index == 0 { 1 } else { 2 };
            end_game(ref game, winner, WinCondition::SystemsDominance);
            pending.active = false;
            return;
        }

        if unique == 3 && !player.made_system_choice {
            pending.active = true;
            pending.player_index = player_index;
            pending.option_count = 0;
            pending.option_0 = SystemType::None;
            pending.option_1 = SystemType::None;
            pending.option_2 = SystemType::None;
            pending.option_3 = SystemType::None;

            if player.compute_count > 0 {
                set_option(ref pending, SystemType::Compute);
            }
            if player.finance_count > 0 {
                set_option(ref pending, SystemType::Finance);
            }
            if player.cyber_count > 0 {
                set_option(ref pending, SystemType::Cyber);
            }
            if player.diplomacy_count > 0 {
                set_option(ref pending, SystemType::Diplomacy);
            }
        }
    }

    fn set_option(ref pending: PendingChoice, symbol: SystemType) {
        match pending.option_count {
            0 => pending.option_0 = symbol,
            1 => pending.option_1 = symbol,
            2 => pending.option_2 = symbol,
            3 => pending.option_3 = symbol,
            _ => {},
        }
        pending.option_count += 1;
    }

    fn option_contains(pending: @PendingChoice, symbol: SystemType) -> bool {
        if symbol == SystemType::None {
            return false;
        }

        let count = *pending.option_count;
        if count > 0 && *pending.option_0 == symbol {
            return true;
        }
        if count > 1 && *pending.option_1 == symbol {
            return true;
        }
        if count > 2 && *pending.option_2 == symbol {
            return true;
        }
        if count > 3 && *pending.option_3 == symbol {
            return true;
        }
        false
    }

    fn next_turn(ref game: Game, ref p0: PlayerState, ref p1: PlayerState, ref pyramid: Pyramid) {
        if pyramid_logic::all_taken(pyramid.taken_mask) {
            if game.age == 3 {
                resolve_points_end(ref game, @p0, @p1);
            } else {
                game.phase = GamePhase::AgeTransition;
            }
            return;
        }

        game.current_player = if game.current_player == 0 { 1 } else { 0 };

        if game.current_player == 0 {
            let income: u16 = p0.energy_prod.into() + p0.materials_prod.into() + p0.compute_prod.into();
            p0.capital += income;
            if p0.finance_bonus {
                p0.capital += 3;
            }
        } else {
            let income: u16 = p1.energy_prod.into() + p1.materials_prod.into() + p1.compute_prod.into();
            p1.capital += income;
            if p1.finance_bonus {
                p1.capital += 3;
            }
        }
    }

    fn resolve_points_end(ref game: Game, p0: @PlayerState, p1: @PlayerState) {
        let p0_score: u16 = score_player(p0, game.agi_one);
        let p1_score: u16 = score_player(p1, game.agi_two);
        if p0_score > p1_score {
            end_game(ref game, 1, WinCondition::Points);
        } else if p1_score > p0_score {
            end_game(ref game, 2, WinCondition::Points);
        } else {
            end_game(ref game, 3, WinCondition::Points);
        }
    }

    fn score_player(player: @PlayerState, agi: u8) -> u16 {
        let mut systems: u16 = 0;
        if *player.compute_count > 0 {
            systems += 1;
        }
        if *player.finance_count > 0 {
            systems += 1;
        }
        if *player.cyber_count > 0 {
            systems += 1;
        }
        if *player.diplomacy_count > 0 {
            systems += 1;
        }

        agi.into() + systems + (*player.hero_count).into()
    }

    fn deal_age_cards(seed: felt252, age: u8) -> Array<u8> {
        let cards_span = get_cards_for_age(age);
        let mut cards = array![];
        let mut i: u32 = 0;
        loop {
            if i == cards_span.len() {
                break;
            }
            cards.append(*cards_span.at(i));
            i += 1;
        }

        shuffle_with_seed(seed, cards)
    }

    fn pyramid_from_cards(game_id: u32, cards: Array<u8>) -> Pyramid {
        Pyramid {
            game_id,
            slot_0: *cards.at(0),
            slot_1: *cards.at(1),
            slot_2: *cards.at(2),
            slot_3: *cards.at(3),
            slot_4: *cards.at(4),
            slot_5: *cards.at(5),
            slot_6: *cards.at(6),
            slot_7: *cards.at(7),
            slot_8: *cards.at(8),
            slot_9: *cards.at(9),
            taken_mask: 0,
        }
    }

    fn get_hero_slot(pool: @HeroPool, hero_slot: u8) -> u8 {
        match hero_slot {
            0 => *pool.hero_0,
            1 => *pool.hero_1,
            2 => *pool.hero_2,
            _ => panic!("invalid hero"),
        }
    }

    fn is_hero_slot_taken(pool: @HeroPool, hero_slot: u8) -> bool {
        match hero_slot {
            0 => *pool.hero_0_taken,
            1 => *pool.hero_1_taken,
            2 => *pool.hero_2_taken,
            _ => true,
        }
    }

    fn set_hero_slot_taken(ref pool: HeroPool, hero_slot: u8) {
        match hero_slot {
            0 => pool.hero_0_taken = true,
            1 => pool.hero_1_taken = true,
            2 => pool.hero_2_taken = true,
            _ => panic!("invalid hero"),
        }
    }
}
