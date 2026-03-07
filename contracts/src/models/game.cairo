use bloc_duel::types::{GamePhase, WinCondition};
use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Game {
    #[key]
    pub game_id: u32,
    pub player_one: ContractAddress,
    pub player_two: ContractAddress,
    pub current_player: u8,
    pub age: u8,
    pub phase: GamePhase,
    pub agi_one: u8,
    pub agi_two: u8,
    pub escalation: u8,
    pub winner: u8,
    pub win_condition: WinCondition,
    pub seed: felt252,
}

#[generate_trait]
pub impl GameImpl of GameTrait {
    fn end_game(ref self: Game, winner: u8, condition: WinCondition) {
        self.phase = GamePhase::GameOver;
        self.winner = winner;
        self.win_condition = condition;
    }

    fn apply_agi(ref self: Game, current_player: u8, delta: u8) {
        if delta == 0 {
            return;
        }
        if current_player == 0 {
            self.agi_one = clamp(self.agi_one + delta, 0, 6);
            if self.agi_one == 6 {
                self.end_game(1, WinCondition::AgiBreakthrough);
            }
        } else {
            self.agi_two = clamp(self.agi_two + delta, 0, 6);
            if self.agi_two == 6 {
                self.end_game(2, WinCondition::AgiBreakthrough);
            }
        }
    }

    fn apply_escalation(ref self: Game, current_player: u8, delta: u8) {
        if delta == 0 || self.phase == GamePhase::GameOver {
            return;
        }
        if current_player == 0 {
            self.escalation = clamp(self.escalation + delta, 0, 12);
            if self.escalation == 12 {
                self.end_game(1, WinCondition::EscalationDominance);
            }
        } else {
            let stepped = if delta > self.escalation {
                0
            } else {
                self.escalation - delta
            };
            self.escalation = clamp(stepped, 0, 12);
            if self.escalation == 0 {
                self.end_game(2, WinCondition::EscalationDominance);
            }
        }
    }

    fn swap_player(ref self: Game) {
        self.current_player = if self.current_player == 0 {
            1
        } else {
            0
        };
    }
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
