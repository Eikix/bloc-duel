use bloc_duel::models::{Direction, Position};

// define the interface
#[starknet::interface]
pub trait IActions<T> {
    fn spawn(ref self: T);
    fn move(ref self: T, direction: Direction);
}

// dojo decorator
#[dojo::contract]
pub mod actions {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use bloc_duel::models::{Moves, Vec2};
    use starknet::{ContractAddress, get_caller_address};
    use super::{Direction, IActions, Position, next_position};

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct Moved {
        #[key]
        pub player: ContractAddress,
        pub direction: Direction,
    }

    #[abi(embed_v0)]
    impl ActionsImpl of IActions<ContractState> {
        fn spawn(ref self: ContractState) {
            let mut world = self.world_default();
            let player = get_caller_address();
            let position: Position = world.read_model(player);

            let new_position = Position {
                player, vec: Vec2 { x: position.vec.x + 10, y: position.vec.y + 10 },
            };
            world.write_model(@new_position);

            let moves = Moves {
                player, remaining: 100, last_direction: Option::None, can_move: true,
            };
            world.write_model(@moves);
        }

        fn move(ref self: ContractState, direction: Direction) {
            let mut world = self.world_default();
            let player = get_caller_address();

            let position: Position = world.read_model(player);
            let mut moves: Moves = world.read_model(player);

            if !moves.can_move {
                return;
            }

            moves.remaining -= 1;
            moves.last_direction = Option::Some(direction);

            let next = next_position(position, moves.last_direction);

            world.write_model(@next);
            world.write_model(@moves);
            world.emit_event(@Moved { player, direction });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"bloc_duel")
        }
    }
}

fn next_position(mut position: Position, direction: Option<Direction>) -> Position {
    match direction {
        Option::None => { return position; },
        Option::Some(d) => match d {
            Direction::Left => { position.vec.x -= 1; },
            Direction::Right => { position.vec.x += 1; },
            Direction::Up => { position.vec.y -= 1; },
            Direction::Down => { position.vec.y += 1; },
        },
    }
    position
}
