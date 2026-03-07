use bloc_duel::types::SystemType;

#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct PendingChoice {
    #[key]
    pub game_id: u32,
    pub active: bool,
    pub player_index: u8,
    pub option_count: u8,
    pub option_0: SystemType,
    pub option_1: SystemType,
    pub option_2: SystemType,
    pub option_3: SystemType,
}

#[generate_trait]
pub impl PendingChoiceImpl of PendingChoiceTrait {
    fn new(game_id: u32) -> PendingChoice {
        PendingChoice {
            game_id,
            active: false,
            player_index: 0,
            option_count: 0,
            option_0: SystemType::None,
            option_1: SystemType::None,
            option_2: SystemType::None,
            option_3: SystemType::None,
        }
    }

    fn activate(ref self: PendingChoice, player_index: u8) {
        self.active = true;
        self.player_index = player_index;
        self.option_count = 0;
        self.option_0 = SystemType::None;
        self.option_1 = SystemType::None;
        self.option_2 = SystemType::None;
        self.option_3 = SystemType::None;
    }

    fn add_option(ref self: PendingChoice, symbol: SystemType) {
        match self.option_count {
            0 => self.option_0 = symbol,
            1 => self.option_1 = symbol,
            2 => self.option_2 = symbol,
            3 => self.option_3 = symbol,
            _ => {},
        }
        self.option_count += 1;
    }

    fn contains_option(self: @PendingChoice, symbol: SystemType) -> bool {
        if symbol == SystemType::None {
            return false;
        }
        let count = *self.option_count;
        if count > 0 && *self.option_0 == symbol {
            return true;
        }
        if count > 1 && *self.option_1 == symbol {
            return true;
        }
        if count > 2 && *self.option_2 == symbol {
            return true;
        }
        if count > 3 && *self.option_3 == symbol {
            return true;
        }
        false
    }

    fn clear(ref self: PendingChoice) {
        self.active = false;
        self.option_count = 0;
        self.option_0 = SystemType::None;
        self.option_1 = SystemType::None;
        self.option_2 = SystemType::None;
        self.option_3 = SystemType::None;
    }
}
