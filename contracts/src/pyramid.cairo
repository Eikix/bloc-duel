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
