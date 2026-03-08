use bloc_duel::types::SystemType;

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
    use bloc_duel::data::cards::{get_card, get_cards_for_age};
    use bloc_duel::data::heroes::{get_hero, hero_count};
    use bloc_duel::helpers::shuffle::{select_n, shuffle_with_seed};
    use bloc_duel::models::game::{Game, GameTrait};
    use bloc_duel::models::hero_pool::{HeroPool, HeroPoolTrait};
    use bloc_duel::models::pending_choice::{PendingChoice, PendingChoiceTrait};
    use bloc_duel::models::player_state::{PlayerState, PlayerStateTrait};
    use bloc_duel::models::pyramid::{Pyramid, PyramidTrait};
    use bloc_duel::types::{CardData, GamePhase, HeroData, SystemType, WinCondition};
    use core::poseidon::poseidon_hash_span;
    #[allow(unused_imports)]
    use dojo::model::ModelStorage;
    #[allow(unused_imports)]
    use starknet::{ContractAddress, get_caller_address, get_tx_info};
    use super::IActions;

    #[abi(embed_v0)]
    impl ActionsImpl of IActions<ContractState> {
        fn create_game(ref self: ContractState) -> u32 {
            let caller = get_caller_address();
            let tx_info = get_tx_info().unbox();
            let game_seed = poseidon_hash_span(
                array![caller.into(), tx_info.transaction_hash].span(),
            );
            let raw_id = felt_to_u32(game_seed);
            let game_id = if raw_id == 0 {
                1
            } else {
                raw_id
            };

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

            let p0 = PlayerStateTrait::new(game_id, 0, caller);
            let p1 = PlayerStateTrait::new(game_id, 1, empty_address);

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

            let pending = PendingChoiceTrait::new(game_id);

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
            let pyramid = PyramidTrait::from_cards(game_id, shuffled);

            let (hero_ids, used_mask) = select_n(
                poseidon_hash_span(array![game.seed, 999].span()), hero_count(), 3, 0,
            );
            let hero_pool = hero_pool_from_selection(game_id, @hero_ids, used_mask);

            let pending = PendingChoiceTrait::new(game_id);

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
            pyramid.validate_and_take(position);

            let card_id = pyramid.get_slot(position);
            let card = get_card(card_id);

            if game.current_player == 0 {
                play_card_for_player(ref game, ref p0, ref pending, 0, @card);
            } else {
                play_card_for_player(ref game, ref p1, ref pending, 1, @card);
            }

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
            pyramid.validate_and_take(position);

            if game.current_player == 0 {
                p0.capital += game.age.into();
            } else {
                p1.capital += game.age.into();
            }

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
            assert(!hero_pool.is_slot_taken(hero_slot), 'hero taken');

            let hero_id = hero_pool.get_slot(hero_slot);
            let hero = get_hero(hero_id);

            if game.current_player == 0 {
                invoke_hero_for_player(ref game, ref p0, ref pending, 0, @hero);
            } else {
                invoke_hero_for_player(ref game, ref p1, ref pending, 1, @hero);
            }

            hero_pool.take_slot(hero_slot);

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
            assert(pending.contains_option(symbol), 'invalid option');

            if game.current_player == 0 {
                p0.apply_system_bonus(symbol);
                p0.made_system_choice = true;
            } else {
                p1.apply_system_bonus(symbol);
                p1.made_system_choice = true;
            }

            pending.clear();

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
            game.swap_player();
            game.phase = GamePhase::Drafting;
            game
                .seed =
                    poseidon_hash_span(array![game.seed, game.age.into(), game_id.into()].span());

            let shuffled = deal_age_cards(game.seed, game.age);
            let pyramid = PyramidTrait::from_cards(game_id, shuffled);

            let (hero_ids, new_mask) = select_n(
                poseidon_hash_span(array![game.seed, 777].span()),
                hero_count(),
                3,
                hero_pool.used_mask,
            );
            hero_pool = hero_pool_from_selection(game_id, @hero_ids, new_mask);

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

    fn is_current_player(
        caller: ContractAddress, game: @Game, p0: @PlayerState, p1: @PlayerState,
    ) -> bool {
        if *game.current_player == 0 {
            caller == *p0.address
        } else {
            caller == *p1.address
        }
    }

    fn play_card_for_player(
        ref game: Game,
        ref player: PlayerState,
        ref pending: PendingChoice,
        player_index: u8,
        card: @CardData,
    ) {
        let chain_active = player.chain_is_active(*card.chain_from);
        let (e, m, c) = if chain_active {
            (0_u8, 0_u8, 0_u8)
        } else {
            (*card.energy_cost, *card.materials_cost, *card.compute_cost)
        };

        assert(player.can_afford(e, m, c, 0), 'cannot afford');
        player.pay_cost(e, m, c, 0);
        player
            .apply_economy(
                *card.capital,
                *card.energy_per_turn,
                *card.materials_per_turn,
                *card.compute_per_turn,
                *card.capital_per_turn,
            );
        game.apply_agi(player_index, *card.agi);
        game.apply_escalation(player_index, *card.escalation);
        player.mark_card_played(*card.id);

        if *card.symbol != SystemType::None {
            player.grant_symbol(*card.symbol);
            resolve_system_progress(ref game, ref player, ref pending, player_index);
        }
    }

    fn invoke_hero_for_player(
        ref game: Game,
        ref player: PlayerState,
        ref pending: PendingChoice,
        player_index: u8,
        hero: @HeroData,
    ) {
        let surcharge: u16 = (player.hero_count * 3).into();
        assert(
            player
                .can_afford(*hero.energy_cost, *hero.materials_cost, *hero.compute_cost, surcharge),
            'cannot afford',
        );
        player.pay_cost(*hero.energy_cost, *hero.materials_cost, *hero.compute_cost, surcharge);
        player
            .apply_economy(
                *hero.capital,
                *hero.energy_per_turn,
                *hero.materials_per_turn,
                *hero.compute_per_turn,
                0,
            );
        game.apply_agi(player_index, *hero.agi);
        game.apply_escalation(player_index, *hero.escalation);
        player.hero_count += 1;

        if *hero.symbol != SystemType::None {
            player.grant_symbol(*hero.symbol);
            resolve_system_progress(ref game, ref player, ref pending, player_index);
        }
    }

    fn resolve_system_progress(
        ref game: Game, ref player: PlayerState, ref pending: PendingChoice, player_index: u8,
    ) {
        player.resolve_pair_bonuses();

        let unique = player.unique_systems();

        if unique == 4 && game.age == 3 {
            let winner = if player_index == 0 {
                1
            } else {
                2
            };
            game.end_game(winner, WinCondition::SystemsDominance);
            pending.active = false;
            return;
        }

        if unique == 3 && !player.made_system_choice {
            pending.activate(player_index);
            if player.compute_count > 0 {
                pending.add_option(SystemType::Compute);
            }
            if player.finance_count > 0 {
                pending.add_option(SystemType::Finance);
            }
            if player.cyber_count > 0 {
                pending.add_option(SystemType::Cyber);
            }
            if player.diplomacy_count > 0 {
                pending.add_option(SystemType::Diplomacy);
            }
        }
    }

    fn next_turn(ref game: Game, ref p0: PlayerState, ref p1: PlayerState, ref pyramid: Pyramid) {
        if pyramid.all_taken() {
            if game.age == 3 {
                resolve_points_end(ref game, @p0, @p1);
            } else {
                game.phase = GamePhase::AgeTransition;
            }
            return;
        }

        game.swap_player();

        if game.current_player == 0 {
            p0.collect_income();
        } else {
            p1.collect_income();
        }
    }

    fn resolve_points_end(ref game: Game, p0: @PlayerState, p1: @PlayerState) {
        let p0_score = p0.score(game.agi_one);
        let p1_score = p1.score(game.agi_two);
        if p0_score > p1_score {
            game.end_game(1, WinCondition::Points);
        } else if p1_score > p0_score {
            game.end_game(2, WinCondition::Points);
        } else {
            game.end_game(3, WinCondition::Points);
        }
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

    fn hero_pool_from_selection(game_id: u32, hero_ids: @Array<u8>, used_mask: u16) -> HeroPool {
        let hero_count = hero_ids.len();
        HeroPool {
            game_id,
            hero_0: if hero_count > 0 { *hero_ids.at(0) } else { 0 },
            hero_1: if hero_count > 1 { *hero_ids.at(1) } else { 0 },
            hero_2: if hero_count > 2 { *hero_ids.at(2) } else { 0 },
            hero_0_taken: hero_count == 0,
            hero_1_taken: hero_count <= 1,
            hero_2_taken: hero_count <= 2,
            used_mask,
        }
    }
}
