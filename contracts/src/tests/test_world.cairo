#[cfg(test)]
mod tests {
    use bloc_duel::models::{
        Game, HeroPool, PendingChoice, PlayerState, Pyramid, m_Game, m_HeroPool, m_PendingChoice,
        m_PlayerState, m_Pyramid,
    };
    use bloc_duel::systems::actions::{IActionsDispatcher, IActionsDispatcherTrait, actions};
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorageTrait, world};
    use dojo_cairo_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait,
        spawn_test_world,
    };
    use starknet::ContractAddress;

    fn namespace_def() -> NamespaceDef {
        let ndef = NamespaceDef {
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
        };

        ndef
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(@"bloc_duel", @"actions")
                .with_writer_of([dojo::utils::bytearray_hash(@"bloc_duel")].span())
        ]
            .span()
    }

    #[test]
    fn test_game_model_read_write() {
        let caller: ContractAddress = 0.try_into().unwrap();
        let ndef = namespace_def();

        let mut world = spawn_test_world(world::TEST_CLASS_HASH, [ndef].span());
        world.sync_perms_and_inits(contract_defs());

        // Verify default game state
        let game: Game = world.read_model(1_u32);
        assert(game.age == 0, 'default age should be 0');
        assert(game.winner == 0, 'default winner should be 0');
    }
}
