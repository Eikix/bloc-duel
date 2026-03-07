#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct HeroPool {
    #[key]
    pub game_id: u32,
    pub hero_0: u8,
    pub hero_1: u8,
    pub hero_2: u8,
    pub hero_0_taken: bool,
    pub hero_1_taken: bool,
    pub hero_2_taken: bool,
    pub used_mask: u16,
}

#[generate_trait]
pub impl HeroPoolImpl of HeroPoolTrait {
    fn get_slot(self: @HeroPool, hero_slot: u8) -> u8 {
        match hero_slot {
            0 => *self.hero_0,
            1 => *self.hero_1,
            2 => *self.hero_2,
            _ => panic!("invalid hero"),
        }
    }

    fn is_slot_taken(self: @HeroPool, hero_slot: u8) -> bool {
        match hero_slot {
            0 => *self.hero_0_taken,
            1 => *self.hero_1_taken,
            2 => *self.hero_2_taken,
            _ => true,
        }
    }

    fn take_slot(ref self: HeroPool, hero_slot: u8) {
        match hero_slot {
            0 => self.hero_0_taken = true,
            1 => self.hero_1_taken = true,
            2 => self.hero_2_taken = true,
            _ => panic!("invalid hero"),
        }
    }
}
