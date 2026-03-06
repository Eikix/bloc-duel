export const SystemSymbol = {
  COMPUTE: 'COMPUTE',
  FINANCE: 'FINANCE',
  CYBER: 'CYBER',
  DIPLOMACY: 'DIPLOMACY',
  RESOURCES: 'RESOURCES',
  INDUSTRY: 'INDUSTRY',
} as const

export type SystemSymbol = (typeof SystemSymbol)[keyof typeof SystemSymbol]
