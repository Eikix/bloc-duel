#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorageTrait, world};
    use dojo_cairo_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait,
        spawn_test_world,
    };
    use starknet::ContractAddress;
    use starknet::testing::set_contract_address;

    use bloc_duel::models::{
        Game, GamePhase, HeroPool, PendingChoice, PlayerState, Pyramid, SystemType, WinCondition,
        m_Game, m_HeroPool, m_PendingChoice, m_PlayerState, m_Pyramid,
    };
    use bloc_duel::systems::actions::{IActionsDispatcher, IActionsDispatcherTrait, actions};

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

    fn setup_game() -> (dojo::world::WorldStorage, IActionsDispatcher, u32, ContractAddress, ContractAddress) {
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
        game.agi_one = 5;
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
    #[should_panic]
    fn test_cannot_play_covered_card() {
        let (_, dispatcher, game_id, player1, _) = setup_game();
        set_contract_address(player1);
        dispatcher.play_card(game_id, 0);
    }
}
