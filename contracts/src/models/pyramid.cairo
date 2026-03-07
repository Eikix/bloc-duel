#[derive(Copy, Drop, Serde, Debug)]
#[dojo::model]
pub struct Pyramid {
    #[key]
    pub game_id: u32,
    pub slot_0: u8,
    pub slot_1: u8,
    pub slot_2: u8,
    pub slot_3: u8,
    pub slot_4: u8,
    pub slot_5: u8,
    pub slot_6: u8,
    pub slot_7: u8,
    pub slot_8: u8,
    pub slot_9: u8,
    pub taken_mask: u16,
}

#[generate_trait]
pub impl PyramidImpl of PyramidTrait {
    fn from_cards(game_id: u32, cards: Array<u8>) -> Pyramid {
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

    fn get_slot(self: @Pyramid, position: u8) -> u8 {
        match position {
            0 => *self.slot_0,
            1 => *self.slot_1,
            2 => *self.slot_2,
            3 => *self.slot_3,
            4 => *self.slot_4,
            5 => *self.slot_5,
            6 => *self.slot_6,
            7 => *self.slot_7,
            8 => *self.slot_8,
            9 => *self.slot_9,
            _ => panic!("invalid pos"),
        }
    }

    fn validate_and_take(ref self: Pyramid, position: u8) {
        assert(position < 10, 'invalid pos');
        assert((self.taken_mask & bit_for_position(position)) == 0, 'already taken');
        assert(is_available(position, self.taken_mask), 'card blocked');
        self.taken_mask = self.taken_mask | bit_for_position(position);
    }

    fn all_taken(self: @Pyramid) -> bool {
        *self.taken_mask == 0x3FF
    }
}

// Standalone bitmap functions (public for tests)

pub fn is_available(position: u8, taken_mask: u16) -> bool {
    match position {
        0 => is_taken(taken_mask, 1) && is_taken(taken_mask, 2),
        1 => is_taken(taken_mask, 3) && is_taken(taken_mask, 4),
        2 => is_taken(taken_mask, 4) && is_taken(taken_mask, 5),
        3 => is_taken(taken_mask, 6) && is_taken(taken_mask, 7),
        4 => is_taken(taken_mask, 7) && is_taken(taken_mask, 8),
        5 => is_taken(taken_mask, 8) && is_taken(taken_mask, 9),
        6 => true,
        7 => true,
        8 => true,
        9 => true,
        _ => false,
    }
}

pub fn all_taken(taken_mask: u16) -> bool {
    taken_mask == 0x3FF
}

pub fn mark_taken(taken_mask: u16, position: u8) -> u16 {
    taken_mask | bit_for_position(position)
}

fn is_taken(taken_mask: u16, position: u8) -> bool {
    let bit = bit_for_position(position);
    bit != 0 && (taken_mask & bit) != 0
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
