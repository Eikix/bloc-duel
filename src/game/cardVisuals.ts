import type { Card, CardEffect, CardType } from './cards'
import { RESOURCE_ICONS } from './format'
import type { SystemSymbol } from './systems'

export const TYPE_STYLES: Record<CardType, {
  accent: string
  frame: string
  chip: string
  text: string
  fallback: string
  glow: string
  surface: string
}> = {
  AI: {
    accent: 'bg-sky-500',
    frame: 'border-sky-300/65',
    chip: 'bg-sky-500/92 text-white',
    text: 'text-sky-100',
    fallback: 'bg-[radial-gradient(circle_at_top,rgba(110,193,255,0.28),transparent_42%),linear-gradient(180deg,rgba(8,21,40,0.98),rgba(12,34,64,0.92))]',
    glow: 'shadow-[0_20px_34px_rgba(42,112,173,0.26)]',
    surface: 'bg-[linear-gradient(180deg,rgba(232,243,255,0.98),rgba(207,226,250,0.96))]',
  },
  ECONOMY: {
    accent: 'bg-amber-500',
    frame: 'border-amber-300/65',
    chip: 'bg-amber-500/92 text-white',
    text: 'text-amber-50',
    fallback: 'bg-[radial-gradient(circle_at_top,rgba(255,208,118,0.28),transparent_42%),linear-gradient(180deg,rgba(38,24,8,0.98),rgba(74,47,14,0.92))]',
    glow: 'shadow-[0_20px_34px_rgba(174,117,27,0.24)]',
    surface: 'bg-[linear-gradient(180deg,rgba(255,247,228,0.98),rgba(246,227,184,0.96))]',
  },
  MILITARY: {
    accent: 'bg-rose-500',
    frame: 'border-rose-300/62',
    chip: 'bg-rose-500/92 text-white',
    text: 'text-rose-50',
    fallback: 'bg-[radial-gradient(circle_at_top,rgba(255,123,123,0.26),transparent_42%),linear-gradient(180deg,rgba(42,8,11,0.98),rgba(82,17,23,0.92))]',
    glow: 'shadow-[0_20px_34px_rgba(166,48,48,0.24)]',
    surface: 'bg-[linear-gradient(180deg,rgba(255,236,236,0.98),rgba(248,215,215,0.96))]',
  },
  SYSTEM: {
    accent: 'bg-emerald-500',
    frame: 'border-emerald-300/62',
    chip: 'bg-emerald-500/92 text-white',
    text: 'text-emerald-50',
    fallback: 'bg-[radial-gradient(circle_at_top,rgba(104,231,184,0.26),transparent_42%),linear-gradient(180deg,rgba(6,37,31,0.98),rgba(12,76,59,0.92))]',
    glow: 'shadow-[0_20px_34px_rgba(27,132,96,0.22)]',
    surface: 'bg-[linear-gradient(180deg,rgba(232,255,246,0.98),rgba(203,241,224,0.96))]',
  },
}

export function formatCardEffects(effect: CardEffect, symbol?: SystemSymbol): string[] {
  const parts: string[] = []
  if (effect.agi) parts.push(`AGI +${effect.agi}`)
  if (effect.escalation) {
    const sign = effect.escalation > 0 ? '+' : ''
    parts.push(`ESC ${sign}${effect.escalation}`)
  }
  if (effect.capital) parts.push(`${RESOURCE_ICONS.capital}${effect.capital}`)
  if (effect.energyPerTurn) parts.push(`${RESOURCE_ICONS.energy}+${effect.energyPerTurn}/t`)
  if (effect.materialsPerTurn) parts.push(`${RESOURCE_ICONS.materials}+${effect.materialsPerTurn}/t`)
  if (effect.computePerTurn) parts.push(`${RESOURCE_ICONS.compute}+${effect.computePerTurn}/t`)
  if (effect.symbol) parts.push(effect.symbol)
  if (symbol) parts.push(symbol)
  return parts
}

export function buildCardEffectEntries(card: Pick<Card, 'effect' | 'symbol'>): Array<{ label: string; value: string }> {
  const entries: Array<{ label: string; value: string }> = []
  const { effect } = card

  if (effect.agi) entries.push({ label: 'AGI gain', value: `+${effect.agi}` })
  if (effect.escalation) entries.push({ label: 'Escalation shift', value: `${effect.escalation > 0 ? '+' : ''}${effect.escalation}` })
  if (effect.capital) entries.push({ label: 'Immediate capital', value: `+${effect.capital}` })
  if (effect.energyPerTurn) entries.push({ label: `${RESOURCE_ICONS.energy} Energy income`, value: `+${effect.energyPerTurn}` })
  if (effect.materialsPerTurn) entries.push({ label: `${RESOURCE_ICONS.materials} Materials income`, value: `+${effect.materialsPerTurn}` })
  if (effect.computePerTurn) entries.push({ label: `${RESOURCE_ICONS.compute} Compute income`, value: `+${effect.computePerTurn}` })
  if (card.symbol) entries.push({ label: 'System unlocked', value: card.symbol })

  return entries
}
