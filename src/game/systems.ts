export const SystemSymbol = {
  COMPUTE: 'COMPUTE',
  FINANCE: 'FINANCE',
  CYBER: 'CYBER',
  DIPLOMACY: 'DIPLOMACY',
} as const

export type SystemSymbol = (typeof SystemSymbol)[keyof typeof SystemSymbol]

export const ALL_SYSTEM_TYPES: SystemSymbol[] = [
  SystemSymbol.COMPUTE,
  SystemSymbol.FINANCE,
  SystemSymbol.CYBER,
  SystemSymbol.DIPLOMACY,
]

export const SYSTEM_BONUS_LABELS: Record<SystemSymbol, string> = {
  COMPUTE: '🖥️ +2 compute/turn',
  FINANCE: '💰 +3 capital/turn',
  CYBER: '⚔️ +2 energy/turn',
  DIPLOMACY: '🕊️ +2 materials/turn',
}
