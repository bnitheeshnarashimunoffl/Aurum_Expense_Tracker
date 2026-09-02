import { todayISO } from '@/lib/format'

// Local-time date math only — the same UTC-shift trap Aurum's lib/format.ts avoids
// (toISOString() would slide local midnight back a day for IST). Keep every
// conversion here going through local Date getters, never toISOString().
function toISODate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Monday of the week containing the given ISO date (defaults to today). */
export function mondayOf(iso: string = todayISO()): string {
  const d = parseISODate(iso)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return toISODate(d)
}

/** The 7 ISO dates (Mon–Sun) for the week starting on the given Monday. */
export function weekDates(mondayISO: string): string[] {
  const start = parseISODate(mondayISO)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return toISODate(d)
  })
}

export function shiftWeeks(mondayISO: string, delta: number): string {
  const d = parseISODate(mondayISO)
  d.setDate(d.getDate() + delta * 7)
  return toISODate(d)
}

export interface YearMonth {
  year: number
  month: number // 0-indexed, matches Date
}

export function currentYearMonth(): YearMonth {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() }
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(year, month + 1, 0).getDate()
}

/** Every ISO date in the given month, in order. */
export function monthDates(ym: YearMonth): string[] {
  const count = daysInMonth(ym)
  return Array.from({ length: count }, (_, i) => toISODate(new Date(ym.year, ym.month, i + 1)))
}

export function monthRange(ym: YearMonth): { from: string; to: string } {
  const dates = monthDates(ym)
  return { from: dates[0], to: dates[dates.length - 1] }
}

export function formatMonthLabel(ym: YearMonth): string {
  return new Date(ym.year, ym.month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function formatWeekdayShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-IN', { weekday: 'short' })
}

export function formatDayNum(iso: string): string {
  return String(parseISODate(iso).getDate())
}

export function isFutureDate(iso: string): boolean {
  return iso > todayISO()
}

export function isPastDate(iso: string): boolean {
  return iso < todayISO()
}

export function isTodayDate(iso: string): boolean {
  return iso === todayISO()
}

/** Shared by every grid (weekly, weekly-history, monthly) so "what can this cell do" never diverges by screen. */
export function cellEditMode(iso: string): 'today' | 'past' | 'future' {
  if (isFutureDate(iso)) return 'future'
  if (isTodayDate(iso)) return 'today'
  return 'past'
}

/** Single-letter weekday, for tight chart axes where "Mon" would collide. */
export function formatWeekdayInitial(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-IN', { weekday: 'narrow' })
}

/**
 * Local midnight at the START of the given ISO date, as a Date. Vigil uses this to
 * close out a session that was left running across a day boundary: the seconds up
 * to midnight belong to the old day, everything after to the new one.
 */
export function startOfDay(iso: string): Date {
  return parseISODate(iso)
}

/** Local midnight that ENDS the given ISO date (i.e. the start of the next day). */
export function endOfDay(iso: string): Date {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + 1)
  return d
}

/** The ISO date immediately after the given one. */
export function nextDay(iso: string): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + 1)
  return toISODate(d)
}
