#[cfg(test)]
mod tests {
    use bloc_duel::data::heroes::get_hero;
    use bloc_duel::types::SystemType;

    #[test]
    fn test_get_hero_0_alan_arden() {
        let hero = get_hero(0);
        assert(hero.id == 0, 'id 0');
        assert(hero.energy_cost == 1, 'energy cost');
        assert(hero.materials_cost == 0, 'materials cost');
        assert(hero.compute_cost == 3, 'compute cost');
        assert(hero.agi == 2, 'agi 2');
        assert(hero.escalation == 0, 'no escalation');
        assert(hero.capital == 0, 'no capital');
        assert(hero.energy_per_turn == 0, 'no energy prod');
        assert(hero.materials_per_turn == 0, 'no mats prod');
        assert(hero.compute_per_turn == 0, 'no compute prod');
        assert(hero.symbol == SystemType::None, 'no symbol');
    }

    #[test]
    fn test_get_hero_9_grace_halper() {
        let hero = get_hero(9);
        assert(hero.id == 9, 'id 9');
        assert(hero.energy_cost == 2, 'energy cost');
        assert(hero.materials_cost == 0, 'materials cost');
        assert(hero.compute_cost == 0, 'compute cost');
        assert(hero.agi == 0, 'no agi');
        assert(hero.escalation == 2, 'escalation 2');
        assert(hero.capital == 0, 'no capital');
        assert(hero.energy_per_turn == 1, 'energy prod 1');
        assert(hero.materials_per_turn == 0, 'no mats prod');
        assert(hero.compute_per_turn == 0, 'no compute prod');
        assert(hero.symbol == SystemType::None, 'no symbol');
    }
}
