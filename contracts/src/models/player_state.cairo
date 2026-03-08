use bloc_duel::types::SystemType;
use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct PlayerState {
    #[key]
    pub game_id: u32,
    #[key]
    pub player_index: u8,
    pub address: ContractAddress,
    pub capital: u16,
    pub energy_prod: u8,
    pub materials_prod: u8,
    pub compute_prod: u8,
    pub compute_count: u8,
    pub finance_count: u8,
    pub cyber_count: u8,
    pub diplomacy_count: u8,
    pub compute_bonus: bool,
    pub finance_bonus: bool,
    pub cyber_bonus: bool,
    pub diplomacy_bonus: bool,
    pub made_system_choice: bool,
    pub hero_count: u8,
    pub played_cards: u32,
}

#[generate_trait]
pub impl PlayerStateImpl of PlayerStateTrait {
    fn new(game_id: u32, player_index: u8, address: ContractAddress) -> PlayerState {
        PlayerState {
            game_id,
            player_index,
            address,
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
        }
    }

    fn can_afford(
        self: @PlayerState,
        energy_cost: u8,
        materials_cost: u8,
        compute_cost: u8,
        extra_capital: u16,
    ) -> bool {
        let e_need: u16 = if energy_cost > *self.energy_prod {
            (energy_cost - *self.energy_prod).into()
        } else {
            0
        };
        let m_need: u16 = if materials_cost > *self.materials_prod {
            (materials_cost - *self.materials_prod).into()
        } else {
            0
        };
        let c_need: u16 = if compute_cost > *self.compute_prod {
            (compute_cost - *self.compute_prod).into()
        } else {
            0
        };
        *self.capital >= e_need + m_need + c_need + extra_capital
    }

    fn pay_cost(
        ref self: PlayerState,
        energy_cost: u8,
        materials_cost: u8,
        compute_cost: u8,
        extra_capital: u16,
    ) {
        let e_need: u16 = if energy_cost > self.energy_prod {
            (energy_cost - self.energy_prod).into()
        } else {
            0
        };
        let m_need: u16 = if materials_cost > self.materials_prod {
            (materials_cost - self.materials_prod).into()
        } else {
            0
        };
        let c_need: u16 = if compute_cost > self.compute_prod {
            (compute_cost - self.compute_prod).into()
        } else {
            0
        };
        self.capital -= e_need + m_need + c_need + extra_capital;
    }

    fn chain_is_active(self: @PlayerState, chain_from: u8) -> bool {
        if chain_from == 255 {
            return false;
        }
        (*self.played_cards & bit_for_card(chain_from)) != 0
    }

    fn mark_card_played(ref self: PlayerState, card_id: u8) {
        self.played_cards = self.played_cards | bit_for_card(card_id);
    }

    fn apply_economy(
        ref self: PlayerState,
        capital: u8,
        energy: u8,
        materials: u8,
        compute: u8,
        capital_per_turn: u8,
    ) {
        self.capital += capital.into();
        self.capital += capital_per_turn.into();
        self.energy_prod += energy;
        self.materials_prod += materials;
        self.compute_prod += compute;
    }

    fn grant_symbol(ref self: PlayerState, symbol: SystemType) {
        match symbol {
            SystemType::Compute => self.compute_count += 1,
            SystemType::Finance => self.finance_count += 1,
            SystemType::Cyber => self.cyber_count += 1,
            SystemType::Diplomacy => self.diplomacy_count += 1,
            SystemType::None => {},
        }
    }

    fn apply_system_bonus(ref self: PlayerState, symbol: SystemType) {
        match symbol {
            SystemType::Compute => {
                if !self.compute_bonus {
                    self.compute_prod += 2;
                    self.compute_bonus = true;
                }
            },
            SystemType::Finance => { self.finance_bonus = true; },
            SystemType::Cyber => {
                if !self.cyber_bonus {
                    self.energy_prod += 2;
                    self.cyber_bonus = true;
                }
            },
            SystemType::Diplomacy => {
                if !self.diplomacy_bonus {
                    self.materials_prod += 2;
                    self.diplomacy_bonus = true;
                }
            },
            SystemType::None => {},
        }
    }

    fn resolve_pair_bonuses(ref self: PlayerState) {
        if self.compute_count >= 2 {
            self.apply_system_bonus(SystemType::Compute);
        }
        if self.finance_count >= 2 {
            self.apply_system_bonus(SystemType::Finance);
        }
        if self.cyber_count >= 2 {
            self.apply_system_bonus(SystemType::Cyber);
        }
        if self.diplomacy_count >= 2 {
            self.apply_system_bonus(SystemType::Diplomacy);
        }
    }

    fn unique_systems(self: @PlayerState) -> u8 {
        let mut count: u8 = 0;
        if *self.compute_count > 0 {
            count += 1;
        }
        if *self.finance_count > 0 {
            count += 1;
        }
        if *self.cyber_count > 0 {
            count += 1;
        }
        if *self.diplomacy_count > 0 {
            count += 1;
        }
        count
    }

    fn collect_income(ref self: PlayerState) {
        let income: u16 = self.energy_prod.into()
            + self.materials_prod.into()
            + self.compute_prod.into();
        self.capital += income;
        if self.finance_bonus {
            self.capital += 3;
        }
    }

    fn score(self: @PlayerState, agi: u8) -> u16 {
        let systems: u16 = self.unique_systems().into();
        agi.into() + systems + systems + (*self.hero_count).into()
    }
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
