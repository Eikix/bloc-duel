// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug, DojoStore, Default)]
pub enum GamePhase {
    #[default]
    Lobby,
    Drafting,
    AgeTransition,
    GameOver,
}

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug, DojoStore, Default)]
pub enum CardType {
    #[default]
    AI,
    Economy,
    Military,
    System,
}

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug, DojoStore, Default)]
pub enum SystemType {
    #[default]
    None,
    Compute,
    Finance,
    Cyber,
    Diplomacy,
}

#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug, DojoStore, Default)]
pub enum WinCondition {
    #[default]
    None,
    AgiBreakthrough,
    EscalationDominance,
    SystemsDominance,
    Points,
}

// ---------------------------------------------------------------------------
// CardData — static card definition (NOT a dojo::model)
// ---------------------------------------------------------------------------

#[derive(Copy, Drop, Serde, Introspect, Debug)]
pub struct CardData {
    pub id: u8,
    pub card_type: CardType,
    pub age: u8,
    pub energy_cost: u8,
    pub materials_cost: u8,
    pub compute_cost: u8,
    pub agi: u8,
    pub escalation: u8,
    pub capital: u8,
    pub energy_per_turn: u8,
    pub materials_per_turn: u8,
    pub compute_per_turn: u8,
    pub capital_per_turn: u8,
    pub symbol: SystemType,
    pub chain_from: u8,
}

// ---------------------------------------------------------------------------
// HeroData — static hero definition (NOT a dojo::model)
// ---------------------------------------------------------------------------

#[derive(Copy, Drop, Serde, Introspect, Debug)]
pub struct HeroData {
    pub id: u8,
    pub energy_cost: u8,
    pub materials_cost: u8,
    pub compute_cost: u8,
    pub agi: u8,
    pub escalation: u8,
    pub capital: u8,
    pub energy_per_turn: u8,
    pub materials_per_turn: u8,
    pub compute_per_turn: u8,
    pub symbol: SystemType,
}
