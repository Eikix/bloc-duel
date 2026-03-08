#[cfg(test)]
mod tests {
    use bloc_duel::models::game::{Game, m_Game};
    use bloc_duel::models::hero_pool::{HeroPool, m_HeroPool};
    use bloc_duel::models::pending_choice::{PendingChoice, m_PendingChoice};
    use bloc_duel::models::player_state::{PlayerState, PlayerStateTrait, m_PlayerState};
    use bloc_duel::models::pyramid::{Pyramid, m_Pyramid};
    use bloc_duel::systems::actions::{IActionsDispatcher, IActionsDispatcherTrait, actions};
    use bloc_duel::types::{GamePhase, SystemType, WinCondition};
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorageTrait, world};
    use dojo_cairo_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait,
        spawn_test_world,
    };
    use starknet::ContractAddress;
    use starknet::testing::set_contract_address;

    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: "bloc_duel",
            resources: [
                TestResource::Model(m_Game::TEST_CLASS_HASH),
                TestResource::Model(m_PlayerState::TEST_CLASS_HASH),
                TestResource::Model(m_Pyramid::TEST_CLASS_HASH),
                TestResource::Model(m_HeroPool::TEST_CLASS_HASH),
                TestResource::Model(m_PendingChoice::TEST_CLASS_HASH),
                TestResource::Contract(actions::TEST_CLASS_HASH),
            ]
                .span(),
        }
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(@"bloc_duel", @"actions")
                .with_writer_of([dojo::utils::bytearray_hash(@"bloc_duel")].span()),
        ]
            .span()
    }

    fn setup_game() -> (
        dojo::world::WorldStorage, IActionsDispatcher, u32, ContractAddress, ContractAddress,
    ) {
        let ndef = namespace_def();
        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        let (contract_address, _) = world.dns(@"actions").unwrap();
        let dispatcher = IActionsDispatcher { contract_address };

        let player1: ContractAddress = starknet::contract_address_const::<0x1>();
        let player2: ContractAddress = starknet::contract_address_const::<0x2>();

        set_contract_address(player1);
        let game_id = dispatcher.create_game();

        set_contract_address(player2);
        dispatcher.join_game(game_id);

        (world, dispatcher, game_id, player1, player2)
    }

    #[test]
    fn test_create_and_join_game() {
        let (world, _, game_id, player1, player2) = setup_game();

        let game: Game = world.read_model(game_id);
        assert(game.player_one == player1, 'p1 set');
        assert(game.player_two == player2, 'p2 set');
        assert(game.phase == GamePhase::Drafting, 'draft phase');
        assert(game.age == 1, 'age one');

        let p0: PlayerState = world.read_model((game_id, 0_u8));
        let p1: PlayerState = world.read_model((game_id, 1_u8));
        assert(p0.address == player1, 'p0 addr');
        assert(p1.address == player2, 'p1 addr');
        assert(p0.capital == 3, 'p0 cap');
        assert(p1.capital == 3, 'p1 cap');

        let pyramid: Pyramid = world.read_model(game_id);
        assert(pyramid.taken_mask == 0, 'pyramid dealt');

        let heroes: HeroPool = world.read_model(game_id);
        assert(heroes.hero_0_taken == false, 'h0 open');
        assert(heroes.hero_1_taken == false, 'h1 open');
        assert(heroes.hero_2_taken == false, 'h2 open');
    }

    #[test]
    fn test_play_card_basic() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        world.write_model_test(@game);

        let mut pyramid: Pyramid = world.read_model(game_id);
        pyramid.slot_6 = 8;
        pyramid.taken_mask = 0;
        world.write_model_test(@pyramid);

        set_contract_address(player1);
        dispatcher.play_card(game_id, 6);

        let p0: PlayerState = world.read_model((game_id, 0_u8));
        let pyramid_after: Pyramid = world.read_model(game_id);
        assert(p0.capital >= 5, 'capital gain');
        assert((pyramid_after.taken_mask & 0x040) != 0, 'taken updated');
    }

    #[test]
    fn test_discard_card() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        game.age = 1;
        world.write_model_test(@game);

        set_contract_address(player1);
        dispatcher.discard_card(game_id, 6);

        let p0: PlayerState = world.read_model((game_id, 0_u8));
        assert(p0.capital == 4, 'discard gain');
    }

    #[test]
    fn test_chain_discount() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        world.write_model_test(@game);

        let mut pyramid: Pyramid = world.read_model(game_id);
        pyramid.slot_6 = 0;
        pyramid.taken_mask = 0;
        world.write_model_test(@pyramid);

        let mut p0: PlayerState = world.read_model((game_id, 0_u8));
        p0.compute_prod = 1;
        world.write_model_test(@p0);

        set_contract_address(player1);
        dispatcher.play_card(game_id, 6);

        let mut game2: Game = world.read_model(game_id);
        game2.phase = GamePhase::AgeTransition;
        world.write_model_test(@game2);
        dispatcher.next_age(game_id);

        let mut game3: Game = world.read_model(game_id);
        game3.current_player = 0;
        game3.phase = GamePhase::Drafting;
        world.write_model_test(@game3);

        let mut pyramid2: Pyramid = world.read_model(game_id);
        pyramid2.slot_6 = 10;
        pyramid2.taken_mask = 0;
        world.write_model_test(@pyramid2);

        let mut p0_after: PlayerState = world.read_model((game_id, 0_u8));
        p0_after.capital = 0;
        p0_after.energy_prod = 0;
        p0_after.compute_prod = 0;
        world.write_model_test(@p0_after);

        set_contract_address(player1);
        dispatcher.play_card(game_id, 6);

        let p0_final: PlayerState = world.read_model((game_id, 0_u8));
        assert(p0_final.capital == 0, 'free chain');
    }

    #[test]
    fn test_agi_victory() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        game.agi_one = 6;
        world.write_model_test(@game);

        let mut pyramid: Pyramid = world.read_model(game_id);
        pyramid.slot_6 = 0;
        pyramid.taken_mask = 0;
        world.write_model_test(@pyramid);

        let mut p0: PlayerState = world.read_model((game_id, 0_u8));
        p0.compute_prod = 1;
        world.write_model_test(@p0);

        set_contract_address(player1);
        dispatcher.play_card(game_id, 6);

        let game_after: Game = world.read_model(game_id);
        assert(game_after.phase == GamePhase::GameOver, 'game over');
        assert(game_after.winner == 1, 'p1 wins');
        assert(game_after.win_condition == WinCondition::AgiBreakthrough, 'agi win');
    }

    #[test]
    fn test_escalation_victory() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        game.escalation = 11;
        world.write_model_test(@game);

        let mut pyramid: Pyramid = world.read_model(game_id);
        pyramid.slot_6 = 3;
        pyramid.taken_mask = 0;
        world.write_model_test(@pyramid);

        let mut p0: PlayerState = world.read_model((game_id, 0_u8));
        p0.energy_prod = 1;
        world.write_model_test(@p0);

        set_contract_address(player1);
        dispatcher.play_card(game_id, 6);

        let game_after: Game = world.read_model(game_id);
        assert(game_after.phase == GamePhase::GameOver, 'game over');
        assert(game_after.winner == 1, 'p1 wins');
        assert(game_after.win_condition == WinCondition::EscalationDominance, 'esc win');
    }

    #[test]
    fn test_systems_victory() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        game.age = 3;
        world.write_model_test(@game);

        let mut pyramid: Pyramid = world.read_model(game_id);
        pyramid.slot_6 = 5;
        pyramid.taken_mask = 0;
        world.write_model_test(@pyramid);

        let mut p0: PlayerState = world.read_model((game_id, 0_u8));
        p0.compute_count = 1;
        p0.finance_count = 1;
        p0.cyber_count = 1;
        p0.diplomacy_count = 0;
        world.write_model_test(@p0);

        set_contract_address(player1);
        dispatcher.play_card(game_id, 6);

        let game_after: Game = world.read_model(game_id);
        assert(game_after.phase == GamePhase::GameOver, 'game over');
        assert(game_after.winner == 1, 'p1 wins');
        assert(game_after.win_condition == WinCondition::SystemsDominance, 'sys win');
    }

    #[test]
    fn test_systems_win_immediately_before_age_three() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        game.age = 2;
        world.write_model_test(@game);

        let mut pyramid: Pyramid = world.read_model(game_id);
        pyramid.slot_6 = 5;
        pyramid.taken_mask = 0;
        world.write_model_test(@pyramid);

        let mut p0: PlayerState = world.read_model((game_id, 0_u8));
        p0.compute_count = 1;
        p0.finance_count = 1;
        p0.cyber_count = 1;
        p0.diplomacy_count = 0;
        world.write_model_test(@p0);

        set_contract_address(player1);
        dispatcher.play_card(game_id, 6);

        let game_after: Game = world.read_model(game_id);
        assert(game_after.phase == GamePhase::GameOver, 'game over');
        assert(game_after.winner == 1, 'p1 wins');
        assert(game_after.win_condition == WinCondition::SystemsDominance, 'sys win');
    }

    #[test]
    fn test_invoke_hero() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        world.write_model_test(@game);

        let mut heroes: HeroPool = world.read_model(game_id);
        heroes.hero_0 = 8;
        heroes.hero_0_taken = false;
        world.write_model_test(@heroes);

        let mut p0: PlayerState = world.read_model((game_id, 0_u8));
        p0.materials_prod = 1;
        p0.compute_prod = 1;
        p0.capital = 3;
        world.write_model_test(@p0);

        set_contract_address(player1);
        dispatcher.invoke_hero(game_id, 0);

        let p0_after: PlayerState = world.read_model((game_id, 0_u8));
        let heroes_after: HeroPool = world.read_model(game_id);
        assert(p0_after.hero_count == 1, 'hero count');
        assert(p0_after.capital >= 8, 'hero capital');
        assert(heroes_after.hero_0_taken == true, 'hero taken');
    }

    #[test]
    fn test_age_transition() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        game.phase = GamePhase::Drafting;
        game.age = 1;
        world.write_model_test(@game);

        let mut pyramid: Pyramid = world.read_model(game_id);
        pyramid.taken_mask = 0x3BF;
        world.write_model_test(@pyramid);

        set_contract_address(player1);
        dispatcher.discard_card(game_id, 6);

        let game_mid: Game = world.read_model(game_id);
        assert(game_mid.phase == GamePhase::AgeTransition, 'to transition');

        dispatcher.next_age(game_id);
        let game_after: Game = world.read_model(game_id);
        let pyramid_after: Pyramid = world.read_model(game_id);
        assert(game_after.age == 2, 'age two');
        assert(game_after.phase == GamePhase::Drafting, 'back drafting');
        assert(pyramid_after.taken_mask == 0, 'new pyramid');
    }

    #[test]
    fn test_age_transition_with_partial_hero_refresh() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        game.phase = GamePhase::AgeTransition;
        game.age = 2;
        world.write_model_test(@game);

        let mut heroes: HeroPool = world.read_model(game_id);
        heroes.used_mask = 0x1FF;
        world.write_model_test(@heroes);

        set_contract_address(player1);
        dispatcher.next_age(game_id);

        let game_after: Game = world.read_model(game_id);
        let heroes_after: HeroPool = world.read_model(game_id);
        assert(game_after.age == 3, 'age three');
        assert(game_after.phase == GamePhase::Drafting, 'back drafting');
        assert(heroes_after.hero_0_taken == false, 'remaining hero open');
        assert(heroes_after.hero_1_taken == true, 'empty slot one hidden');
        assert(heroes_after.hero_2_taken == true, 'empty slot two hidden');
        assert(heroes_after.hero_0 == 9, 'last hero selected');
    }

    #[test]
    #[should_panic]
    fn test_cannot_play_covered_card() {
        let (_, dispatcher, game_id, player1, _) = setup_game();
        set_contract_address(player1);
        dispatcher.play_card(game_id, 0);
    }

    #[test]
    fn test_full_three_age_game_points_victory() {
        let (mut world, dispatcher, game_id, player1, player2) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        game.phase = GamePhase::Drafting;
        game.age = 1;
        world.write_model_test(@game);

        let mut pyramid_age1: Pyramid = world.read_model(game_id);
        pyramid_age1.slot_0 = 8;
        pyramid_age1.slot_1 = 8;
        pyramid_age1.slot_2 = 8;
        pyramid_age1.slot_3 = 8;
        pyramid_age1.slot_4 = 8;
        pyramid_age1.slot_5 = 8;
        pyramid_age1.slot_6 = 8;
        pyramid_age1.slot_7 = 8;
        pyramid_age1.slot_8 = 8;
        pyramid_age1.slot_9 = 8;
        pyramid_age1.taken_mask = 0;
        world.write_model_test(@pyramid_age1);

        set_contract_address(player1);
        dispatcher.play_card(game_id, 6);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 7);
        set_contract_address(player1);
        dispatcher.play_card(game_id, 3);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 8);
        set_contract_address(player1);
        dispatcher.play_card(game_id, 4);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 1);
        set_contract_address(player1);
        dispatcher.play_card(game_id, 9);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 5);
        set_contract_address(player1);
        dispatcher.play_card(game_id, 2);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 0);

        let game_age1_end: Game = world.read_model(game_id);
        assert(game_age1_end.phase == GamePhase::AgeTransition, 'age1 transition');

        let mut game_age2_start: Game = world.read_model(game_id);
        game_age2_start.age = 2;
        game_age2_start.phase = GamePhase::Drafting;
        game_age2_start.current_player = 0;
        world.write_model_test(@game_age2_start);

        let mut pyramid_age2: Pyramid = world.read_model(game_id);
        pyramid_age2.slot_0 = 8;
        pyramid_age2.slot_1 = 8;
        pyramid_age2.slot_2 = 8;
        pyramid_age2.slot_3 = 8;
        pyramid_age2.slot_4 = 8;
        pyramid_age2.slot_5 = 8;
        pyramid_age2.slot_6 = 8;
        pyramid_age2.slot_7 = 8;
        pyramid_age2.slot_8 = 8;
        pyramid_age2.slot_9 = 8;
        pyramid_age2.taken_mask = 0;
        world.write_model_test(@pyramid_age2);

        set_contract_address(player1);
        dispatcher.play_card(game_id, 6);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 7);
        set_contract_address(player1);
        dispatcher.play_card(game_id, 3);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 8);
        set_contract_address(player1);
        dispatcher.play_card(game_id, 4);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 1);
        set_contract_address(player1);
        dispatcher.play_card(game_id, 9);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 5);
        set_contract_address(player1);
        dispatcher.play_card(game_id, 2);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 0);

        let game_age2_end: Game = world.read_model(game_id);
        assert(game_age2_end.phase == GamePhase::AgeTransition, 'age2 transition');

        let mut game_age3: Game = world.read_model(game_id);
        game_age3.age = 3;
        game_age3.current_player = 0;
        game_age3.phase = GamePhase::Drafting;
        game_age3.agi_one = 2;
        game_age3.agi_two = 3;
        world.write_model_test(@game_age3);

        let mut p0_setup: PlayerState = world.read_model((game_id, 0_u8));
        p0_setup.compute_count = 1;
        p0_setup.finance_count = 0;
        p0_setup.cyber_count = 0;
        p0_setup.diplomacy_count = 0;
        p0_setup.hero_count = 0;
        world.write_model_test(@p0_setup);

        let mut p1_setup: PlayerState = world.read_model((game_id, 1_u8));
        p1_setup.compute_count = 1;
        p1_setup.finance_count = 1;
        p1_setup.cyber_count = 0;
        p1_setup.diplomacy_count = 0;
        p1_setup.hero_count = 1;
        world.write_model_test(@p1_setup);

        let mut pyramid_age3: Pyramid = world.read_model(game_id);
        pyramid_age3.slot_0 = 8;
        pyramid_age3.slot_1 = 8;
        pyramid_age3.slot_2 = 8;
        pyramid_age3.slot_3 = 8;
        pyramid_age3.slot_4 = 8;
        pyramid_age3.slot_5 = 8;
        pyramid_age3.slot_6 = 8;
        pyramid_age3.slot_7 = 8;
        pyramid_age3.slot_8 = 8;
        pyramid_age3.slot_9 = 8;
        pyramid_age3.taken_mask = 0;
        world.write_model_test(@pyramid_age3);

        set_contract_address(player1);
        dispatcher.play_card(game_id, 6);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 7);
        set_contract_address(player1);
        dispatcher.play_card(game_id, 3);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 8);
        set_contract_address(player1);
        dispatcher.play_card(game_id, 4);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 1);
        set_contract_address(player1);
        dispatcher.play_card(game_id, 9);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 5);
        set_contract_address(player1);
        dispatcher.play_card(game_id, 2);
        set_contract_address(player2);
        dispatcher.discard_card(game_id, 0);

        let game_after: Game = world.read_model(game_id);
        let p0_after: PlayerState = world.read_model((game_id, 0_u8));
        let p1_after: PlayerState = world.read_model((game_id, 1_u8));

        let p0_score: u16 = p0_after.score(game_after.agi_one);
        let p1_score: u16 = p1_after.score(game_after.agi_two);

        assert(game_after.phase == GamePhase::GameOver, 'game over');
        assert(game_after.win_condition == WinCondition::Points, 'points win');
        assert(p1_score > p0_score, 'p1 score high');
        assert(game_after.winner == 2, 'p2 wins points');
    }

    #[test]
    fn test_player_two_escalation_victory() {
        let (mut world, dispatcher, game_id, _, player2) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 1;
        game.escalation = 1;
        world.write_model_test(@game);

        let mut pyramid: Pyramid = world.read_model(game_id);
        pyramid.slot_6 = 3;
        pyramid.taken_mask = 0;
        world.write_model_test(@pyramid);

        let mut p1: PlayerState = world.read_model((game_id, 1_u8));
        p1.energy_prod = 1;
        world.write_model_test(@p1);

        set_contract_address(player2);
        dispatcher.play_card(game_id, 6);

        let game_after: Game = world.read_model(game_id);
        assert(game_after.escalation == 0, 'esc to zero');
        assert(game_after.phase == GamePhase::GameOver, 'game over');
        assert(game_after.winner == 2, 'p2 wins');
        assert(game_after.win_condition == WinCondition::EscalationDominance, 'esc win');
    }

    #[test]
    fn test_player_two_agi_victory() {
        let (mut world, dispatcher, game_id, _, player2) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 1;
        game.agi_two = 6;
        world.write_model_test(@game);

        let mut pyramid: Pyramid = world.read_model(game_id);
        pyramid.slot_6 = 0;
        pyramid.taken_mask = 0;
        world.write_model_test(@pyramid);

        let mut p1: PlayerState = world.read_model((game_id, 1_u8));
        p1.compute_prod = 1;
        world.write_model_test(@p1);

        set_contract_address(player2);
        dispatcher.play_card(game_id, 6);

        let game_after: Game = world.read_model(game_id);
        assert(game_after.phase == GamePhase::GameOver, 'game over');
        assert(game_after.winner == 2, 'p2 wins');
        assert(game_after.win_condition == WinCondition::AgiBreakthrough, 'agi win');
    }

    #[test]
    fn test_system_bonus_choice_flow() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        game.phase = GamePhase::Drafting;
        world.write_model_test(@game);

        let mut p0: PlayerState = world.read_model((game_id, 0_u8));
        p0.compute_count = 1;
        p0.finance_count = 1;
        p0.cyber_count = 0;
        p0.diplomacy_count = 0;
        p0.compute_bonus = false;
        p0.compute_prod = 0;
        p0.made_system_choice = false;
        world.write_model_test(@p0);

        let mut pyramid: Pyramid = world.read_model(game_id);
        pyramid.slot_6 = 5;
        pyramid.taken_mask = 0;
        world.write_model_test(@pyramid);

        set_contract_address(player1);
        dispatcher.play_card(game_id, 6);

        let pending_before: PendingChoice = world.read_model(game_id);
        assert(pending_before.active == true, 'pending active');
        assert(pending_before.option_count == 3, 'three options');

        set_contract_address(player1);
        dispatcher.choose_system_bonus(game_id, SystemType::Compute);

        let pending_after: PendingChoice = world.read_model(game_id);
        let p0_after: PlayerState = world.read_model((game_id, 0_u8));
        assert(pending_after.active == false, 'pending cleared');
        assert(p0_after.compute_bonus == true, 'compute bonus');
        assert(p0_after.compute_prod == 2, 'compute plus two');
    }

    #[test]
    fn test_discard_value_scales_with_age() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        game.phase = GamePhase::Drafting;
        game.age = 1;
        world.write_model_test(@game);

        let mut pyramid: Pyramid = world.read_model(game_id);
        pyramid.taken_mask = 0;
        world.write_model_test(@pyramid);

        let mut p0: PlayerState = world.read_model((game_id, 0_u8));
        p0.capital = 10;
        world.write_model_test(@p0);

        set_contract_address(player1);
        dispatcher.discard_card(game_id, 6);

        let p0_after_age1: PlayerState = world.read_model((game_id, 0_u8));
        assert(p0_after_age1.capital == 11, 'age1 discard');

        let mut game_age2: Game = world.read_model(game_id);
        game_age2.current_player = 0;
        game_age2.phase = GamePhase::Drafting;
        game_age2.age = 2;
        world.write_model_test(@game_age2);

        let mut pyramid_age2: Pyramid = world.read_model(game_id);
        pyramid_age2.taken_mask = 0;
        world.write_model_test(@pyramid_age2);

        let mut p0_age2: PlayerState = world.read_model((game_id, 0_u8));
        p0_age2.capital = 10;
        world.write_model_test(@p0_age2);

        set_contract_address(player1);
        dispatcher.discard_card(game_id, 6);

        let p0_after_age2: PlayerState = world.read_model((game_id, 0_u8));
        assert(p0_after_age2.capital == 12, 'age2 discard');

        let mut game_age3: Game = world.read_model(game_id);
        game_age3.current_player = 0;
        game_age3.phase = GamePhase::Drafting;
        game_age3.age = 3;
        world.write_model_test(@game_age3);

        let mut pyramid_age3: Pyramid = world.read_model(game_id);
        pyramid_age3.taken_mask = 0;
        world.write_model_test(@pyramid_age3);

        let mut p0_age3: PlayerState = world.read_model((game_id, 0_u8));
        p0_age3.capital = 10;
        world.write_model_test(@p0_age3);

        set_contract_address(player1);
        dispatcher.discard_card(game_id, 6);

        let p0_after_age3: PlayerState = world.read_model((game_id, 0_u8));
        assert(p0_after_age3.capital == 13, 'age3 discard');
    }

    #[test]
    fn test_hero_surcharge_stacking() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        game.phase = GamePhase::Drafting;
        world.write_model_test(@game);

        let mut heroes: HeroPool = world.read_model(game_id);
        heroes.hero_0 = 8;
        heroes.hero_0_taken = false;
        world.write_model_test(@heroes);

        let mut p0: PlayerState = world.read_model((game_id, 0_u8));
        p0.hero_count = 2;
        p0.materials_prod = 1;
        p0.compute_prod = 1;
        p0.capital = 10;
        world.write_model_test(@p0);

        set_contract_address(player1);
        dispatcher.invoke_hero(game_id, 0);

        let p0_after: PlayerState = world.read_model((game_id, 0_u8));
        assert(p0_after.hero_count == 3, 'hero count');
        assert(p0_after.capital == 9, 'surcharge net');
    }

    #[test]
    fn test_points_tie() {
        let (mut world, dispatcher, game_id, player1, _) = setup_game();

        let mut game: Game = world.read_model(game_id);
        game.current_player = 0;
        game.phase = GamePhase::Drafting;
        game.age = 3;
        game.agi_one = 2;
        game.agi_two = 2;
        world.write_model_test(@game);

        let mut pyramid: Pyramid = world.read_model(game_id);
        pyramid.taken_mask = 0x3BF;
        world.write_model_test(@pyramid);

        let mut p0: PlayerState = world.read_model((game_id, 0_u8));
        p0.compute_count = 1;
        p0.finance_count = 0;
        p0.cyber_count = 0;
        p0.diplomacy_count = 0;
        p0.hero_count = 1;
        world.write_model_test(@p0);

        let mut p1: PlayerState = world.read_model((game_id, 1_u8));
        p1.compute_count = 1;
        p1.finance_count = 0;
        p1.cyber_count = 0;
        p1.diplomacy_count = 0;
        p1.hero_count = 1;
        world.write_model_test(@p1);

        set_contract_address(player1);
        dispatcher.discard_card(game_id, 6);

        let game_after: Game = world.read_model(game_id);
        assert(game_after.phase == GamePhase::GameOver, 'game over');
        assert(game_after.win_condition == WinCondition::Points, 'points win');
        assert(game_after.winner == 3, 'draw winner');
    }
}
