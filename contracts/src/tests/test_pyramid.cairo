#[cfg(test)]
mod tests {
    use bloc_duel::models::pyramid::{all_taken, is_available, mark_taken};

    #[test]
    fn test_bottom_row_is_always_available() {
        let taken_mask = 0_u16;
        assert(is_available(6, taken_mask), 'position 6 available');
        assert(is_available(7, taken_mask), 'position 7 available');
        assert(is_available(8, taken_mask), 'position 8 available');
        assert(is_available(9, taken_mask), 'position 9 available');
    }

    #[test]
    fn test_position_zero_requires_positions_one_and_two_taken() {
        let empty = 0_u16;
        assert(!is_available(0, empty), 'position 0 blocked');

        let one_taken = mark_taken(empty, 1);
        assert(!is_available(0, one_taken), 'still blocked');

        let one_and_two_taken = mark_taken(one_taken, 2);
        assert(is_available(0, one_and_two_taken), 'position 0 open');
    }

    #[test]
    fn test_mark_taken_and_all_taken() {
        let mut taken_mask = 0_u16;
        assert(!all_taken(taken_mask), 'not all taken');

        let mut position: u8 = 0;
        loop {
            if position == 10 {
                break;
            }

            taken_mask = mark_taken(taken_mask, position);
            position += 1;
        }

        assert(taken_mask == 0x3FF, 'full mask');
        assert(all_taken(taken_mask), 'all taken');
    }
}
