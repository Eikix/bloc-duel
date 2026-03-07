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
  COMPUTE: '🖥️ +2 compute production',
  CYBER: '⚔️ +2 energy production',
  DIPLOMACY: '🕊️ +2 materials production',
  FINANCE: '💰 +3 capital on income',
}
