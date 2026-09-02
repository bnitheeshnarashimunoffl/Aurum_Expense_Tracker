import type { DayOfWeek, ScheduleEntry, SplitDay } from './types'

/**
 * Day-of-week index for an ISO date, Mon = 0 .. Sun = 6.
 *
 * Date.getDay() is Sun = 0, which would put Sunday at the START of the week and
 * silently misalign every schedule lookup against the Mon-first grid the rest of
 * Meridian draws. Parsed from the ISO parts rather than Date.parse so it stays in
 * local time — the same UTC-shift trap lib/date.ts documents.
 */
export function dayOfWeek(iso: string): DayOfWeek {
  const [y, m, d] = iso.split('-').map(Number)
  const js = new Date(y, m - 1, d).getDay()
  return ((js + 6) % 7) as DayOfWeek
}

export type Scheduled =
  | { kind: 'unset' }
  | { kind: 'rest' }
  | { kind: 'split'; splitDay: SplitDay }

/** What the weekly schedule says about a given date. */
export function scheduledFor(iso: string, schedule: ScheduleEntry[], splitDays: SplitDay[]): Scheduled {
  const entry = schedule.find((e) => e.day_of_week === dayOfWeek(iso))
  if (!entry) return { kind: 'unset' }
  if (entry.split_day_id === null) return { kind: 'rest' }
  const splitDay = splitDays.find((s) => s.id === entry.split_day_id)
  // The schedule pointed at a split day that has since been deleted; ON DELETE SET
  // NULL will have cleared it server-side, but don't crash on a stale local copy.
  return splitDay ? { kind: 'split', splitDay } : { kind: 'unset' }
}
