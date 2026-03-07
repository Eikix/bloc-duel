use core::dict::Felt252Dict;
use core::poseidon::poseidon_hash_span;

pub fn shuffle_with_seed(mut seed: felt252, items: Array<u8>) -> Array<u8> {
    let len = items.len();
    if len <= 1 {
        return items;
    }

    let mut dict: Felt252Dict<u8> = Default::default();
    let mut idx: u32 = 0;
    loop {
        if idx == len {
            break;
        }

        dict.insert(idx.into(), *items.at(idx));
        idx += 1;
    }

    let mut i: u32 = len - 1;
    loop {
        if i == 0 {
            break;
        }

        let hash_input = array![seed, i.into()];
        seed = poseidon_hash_span(hash_input.span());

        let seed_u256: u256 = seed.into();
        let upper: u256 = (i + 1).into();
        let j_u256 = seed_u256 % upper;
        let j: u32 = j_u256.try_into().unwrap();

        let i_key: felt252 = i.into();
        let j_key: felt252 = j.into();
        let i_val = dict.get(i_key);
        let j_val = dict.get(j_key);

        dict.insert(i_key, j_val);
        dict.insert(j_key, i_val);
        i -= 1;
    }

    let mut out = array![];
    idx = 0;
    loop {
        if idx == len {
            break;
        }

        let key: felt252 = idx.into();
        out.append(dict.get(key));
        idx += 1;
    }

    out
}

pub fn select_n(
    mut seed: felt252, pool_size: u8, n: u8, mut exclude_mask: u16,
) -> (Array<u8>, u16) {
    let mut selected = array![];

    if n == 0 || pool_size == 0 {
        return (selected, exclude_mask);
    }

    let mut selected_count: u8 = 0;
    let mut nonce: u32 = 0;
    loop {
        if selected_count == n {
            break;
        }

        let hash_input = array![seed, nonce.into()];
        seed = poseidon_hash_span(hash_input.span());
        nonce += 1;

        let seed_u256: u256 = seed.into();
        let pool_u256: u256 = pool_size.into();
        let candidate_u256 = seed_u256 % pool_u256;
        let mut candidate: u8 = candidate_u256.try_into().unwrap();

        if is_excluded(candidate, exclude_mask) {
            let mut step: u8 = 1;
            let mut found = false;
            loop {
                if step == pool_size {
                    break;
                }

                let stepped: u16 = candidate.into() + step.into();
                candidate = (stepped % pool_size.into()).try_into().unwrap();
                if !is_excluded(candidate, exclude_mask) {
                    found = true;
                    break;
                }

                step += 1;
            }

            if !found {
                break;
            }
        }

        selected.append(candidate);
        exclude_mask = exclude_mask | bit_for_id(candidate);
        selected_count += 1;
    }

    (selected, exclude_mask)
}

fn is_excluded(id: u8, mask: u16) -> bool {
    (mask & bit_for_id(id)) != 0
}

fn bit_for_id(id: u8) -> u16 {
    let mut bit = 1_u16;
    let mut i: u8 = 0;
    loop {
        if i == id {
            break;
        }

        bit *= 2;
        i += 1;
    }

    bit
}
