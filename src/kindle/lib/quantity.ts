import type { Habit } from './types'

// Short symbols for the units this module actually uses today, plus the obvious
// neighbours. Anything not listed falls back to "<value> <unit>", which is why a
// user-typed unit like "baths" still reads correctly without being in this map.
const UNIT_SYMBOLS: Record<string, string> = {
  litre: 'L',
  litres: 'L',
  liter: 'L',
  liters: 'L',
  l: 'L',
  hour: 'h',
  hours: 'h',
  hr: 'h',
  hrs: 'h',
  h: 'h',
  gram: 'g',
  grams: 'g',
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  km: 'km',
  minute: 'm',
  minutes: 'm',
  min: 'm',
  mins: 'm',
}

function formatNumber(n: number): string {
  return Number(n.toFixed(2)).toString()
}

/** "baths" -> "bath" at exactly 1. Deliberately crude — units here are short words the user typed themselves. */
function pluralize(unit: string, value: number): string {
  if (value === 1 && unit.length > 1 && unit.endsWith('s')) return unit.slice(0, -1)
  return unit
}

/**
 * The real-world quantity a stage stands for — stage 3 of water (target 4 litres)
 * is "3L", stage 2 of protein (target 100 grams over 4 stages) is "50g". The log
 * modal labels its options with this, never with a raw stage number, so the user
 * picks the amount they actually did.
 */
export function stageQuantityLabel(
  habit: Pick<Habit, 'max_stage' | 'target_value' | 'target_unit'>,
  stage: number
): string {
  if (habit.target_value == null || habit.max_stage <= 0) return `Stage ${stage}`
  const value = (habit.target_value * stage) / habit.max_stage
  const unit = habit.target_unit?.trim().toLowerCase()
  if (!unit) return formatNumber(value)
  const symbol = UNIT_SYMBOLS[unit]
  if (symbol) return `${formatNumber(value)}${symbol}`
  return `${formatNumber(value)} ${pluralize(unit, value)}`
}

/** The "Target: 5 hours" context line in the log modal. Binary habits have no quantity target. */
export function targetLabel(habit: Habit): string | null {
  if (habit.type === 'binary') return null
  if (habit.target_value == null) return `${habit.max_stage} stages`
  return `Target: ${formatNumber(habit.target_value)} ${habit.target_unit ?? ''}`.trim()
}

/**
 * Drops a habit label's trailing "(...)" target note — "Water intake (4 litres/day)"
 * becomes "Water intake". The pill carries the name; the modal carries the target,
 * so repeating it on the pill is noise.
 */
export function shortHabitLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim() || label
}
