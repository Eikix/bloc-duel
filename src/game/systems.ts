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
  COMPUTE: '🖥️ AI cards cost −1 each resource',
  CYBER: '⚔️ +2 escalation now',
  DIPLOMACY: '🕊️ Reset escalation to 0',
  FINANCE: '💰 Sell value ×2',
}
