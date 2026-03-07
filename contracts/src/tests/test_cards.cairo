#[cfg(test)]
mod tests {
    use bloc_duel::cards::{card_count, get_card, get_cards_for_age};
    use bloc_duel::models::{CardType, SystemType};

    #[test]
    fn test_get_card_0_neural_relay() {
        let card = get_card(0);
        assert(card.id == 0, 'id 0');
        assert(card.card_type == CardType::AI, 'type ai');
        assert(card.age == 1, 'age 1');
        assert(card.energy_cost == 0, 'energy cost');
        assert(card.materials_cost == 0, 'materials cost');
        assert(card.compute_cost == 1, 'compute cost');
        assert(card.agi == 1, 'agi 1');
        assert(card.escalation == 0, 'no escalation');
        assert(card.capital == 0, 'no capital');
        assert(card.energy_per_turn == 0, 'no energy prod');
        assert(card.materials_per_turn == 0, 'no mats prod');
        assert(card.compute_per_turn == 0, 'no compute prod');
        assert(card.capital_per_turn == 0, 'no capital prod');
        assert(card.symbol == SystemType::None, 'no symbol');
        assert(card.chain_from == 255, 'no chain');
    }

    #[test]
    fn test_get_card_29_space_command() {
        let card = get_card(29);
        assert(card.id == 29, 'id 29');
        assert(card.card_type == CardType::System, 'type sys');
        assert(card.age == 3, 'age 3');
        assert(card.energy_cost == 3, 'energy cost');
        assert(card.materials_cost == 1, 'materials cost');
        assert(card.compute_cost == 2, 'compute cost');
        assert(card.agi == 0, 'no agi');
        assert(card.escalation == 0, 'no escalation');
        assert(card.capital == 0, 'no capital');
        assert(card.energy_per_turn == 2, 'energy prod 2');
        assert(card.materials_per_turn == 0, 'no mats prod');
        assert(card.compute_per_turn == 0, 'no compute prod');
        assert(card.capital_per_turn == 0, 'no capital prod');
        assert(card.symbol == SystemType::Compute, 'compute symbol');
        assert(card.chain_from == 255, 'no chain');
    }

    #[test]
    fn test_card_ages_by_id_range() {
        let mut id: u8 = 0;
        loop {
            if id == card_count() {
                break;
            }

            let card = get_card(id);
            if id < 10 {
                assert(card.age == 1, 'age one range');
            } else if id < 20 {
                assert(card.age == 2, 'age two range');
            } else {
                assert(card.age == 3, 'age three range');
            }

            id += 1;
        }
    }

    #[test]
    fn test_get_cards_for_age_one_ids() {
        let cards = get_cards_for_age(1);
        assert(cards.len() == 10, 'ten age one cards');
        assert(*cards.at(0) == 0_u8, 'age1 id0');
        assert(*cards.at(1) == 1_u8, 'age1 id1');
        assert(*cards.at(2) == 2_u8, 'age1 id2');
        assert(*cards.at(3) == 3_u8, 'age1 id3');
        assert(*cards.at(4) == 4_u8, 'age1 id4');
        assert(*cards.at(5) == 5_u8, 'age1 id5');
        assert(*cards.at(6) == 6_u8, 'age1 id6');
        assert(*cards.at(7) == 7_u8, 'age1 id7');
        assert(*cards.at(8) == 8_u8, 'age1 id8');
        assert(*cards.at(9) == 9_u8, 'age1 id9');
    }

    #[test]
    fn test_chain_from_links_are_valid() {
        let mut id: u8 = 0;
        loop {
            if id == card_count() {
                break;
            }

            let card = get_card(id);
            assert(card.chain_from == 255 || card.chain_from < card_count(), 'valid chain from');
            id += 1;
        }
    }
}
