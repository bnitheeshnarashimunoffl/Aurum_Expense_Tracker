import { todayISO } from '@/lib/format'
import type { DayIndex, ScheduleBlock, TimeSlot } from './types'

/** Ascending by effective date — the order the term actually runs in. */
export function sortBlocks(blocks: ScheduleBlock[]): ScheduleBlock[] {
  return [...blocks].sort((a, b) => a.effective_from.localeCompare(b.effective_from))
}

/**
 * Which schedule block is in effect on a given date: the latest block whose
 * effective_from is on or before that date. Before the first block starts, the
 * first block is shown rather than nothing — a term always has a schedule, and
 * an empty screen during the week before term starts would just look broken.
 */
export function blockInEffect(blocks: ScheduleBlock[], onDate: string = todayISO()): ScheduleBlock | undefined {
  const ordered = sortBlocks(blocks)
  if (ordered.length === 0) return undefined
  let current = ordered[0]
  for (const block of ordered) {
    if (block.effective_from <= onDate) current = block
    else break
  }
  return current
}

/** The date a block stops applying: the day before the next block starts, else the term end. */
export function blockRunsUntil(blocks: ScheduleBlock[], block: ScheduleBlock, termEnd: string): string {
  const ordered = sortBlocks(blocks)
  const index = ordered.findIndex((b) => b.id === block.id)
  const next = ordered[index + 1]
  if (!next) return termEnd
  const d = new Date(`${next.effective_from}T00:00:00`)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Mon=0 .. Sat=5. Sunday has no column, so it falls back to Monday. */
export function todayDayIndex(): DayIndex {
  const jsDay = new Date().getDay() // 0=Sun
  if (jsDay === 0) return 0
  return (jsDay - 1) as DayIndex
}

export function isTodayColumn(day: DayIndex): boolean {
  return new Date().getDay() !== 0 && todayDayIndex() === day
}

export function sortSlots(slots: TimeSlot[]): TimeSlot[] {
  return [...slots].sort((a, b) => a.position - b.position || a.start_time.localeCompare(b.start_time))
}

/** "09:00" -> "9:00 AM", matching the app's en-IN formatting elsewhere. */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return hhmm
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m ?? 0).padStart(2, '0')} ${period}`
}

export function formatSlotRange(slot: TimeSlot): string {
  return `${formatTime(slot.start_time)} – ${formatTime(slot.end_time)}`
}

/** True while today falls inside the term's date range. */
export function termIsCurrent(start: string, end: string): boolean {
  const today = todayISO()
  return start <= today && today <= end
}
