// Turning one UTC instant into "what time is it where this user is".
//
// Every trigger in Meridian's notification system is stated in LOCAL time, and
// the dispatcher runs in UTC. Rather than storing a numeric offset (which goes
// wrong twice a year, and silently), each user's row carries an IANA zone and
// this file resolves it with Intl — which is the only thing that knows about
// that zone's DST rules on that particular day.

export interface LocalClock {
  /** "2026-09-03" in the user's zone. Every dedupe key is built on this. */
  date: string
  /** 0..23, local. */
  hour: number
  /** 0..59, local. */
  minute: number
  /** Minutes since local midnight — the form Loom's "30 minutes before" math wants. */
  minutesOfDay: number
  /** Mon = 0 .. Sun = 6, matching the Mon-first week the whole app uses. */
  weekdayMon0: number
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
}

/**
 * Throws on an unknown zone rather than silently falling back to UTC — a user
 * whose reminders all fire five and a half hours early would have no way to tell
 * that a typo'd timezone string was the cause.
 */
export function localClock(instant: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
    weekdayMon0: WEEKDAY_INDEX[get('weekday')] ?? 0,
  }
}

/** "09:00" -> 540. Returns null for anything that is not a wall-clock time. */
export function hhmmToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/** "09:00" -> "9:00 AM", matching how Loom prints a slot inside the app. */
export function formatClockTime(hhmm: string): string {
  const total = hhmmToMinutes(hhmm)
  if (total === null) return hhmm
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const period = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`
}
