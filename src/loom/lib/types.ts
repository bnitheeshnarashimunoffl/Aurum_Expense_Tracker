/** Monday..Saturday. Sunday is deliberately absent — Loom is a class timetable. */
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5
export const SATURDAY: DayIndex = 5

/**
 * Flags are stored as 0/1 rather than booleans because IndexedDB cannot index a
 * boolean — and `dirty` in particular has to be indexable for the sync push to
 * find pending rows cheaply.
 */
export type Flag = 0 | 1

interface Synced {
  id: string
  user_id: string
  /** Client-set, and the comparison key for last-write-wins. */
  updated_at: string
  deleted: Flag
  /** 1 = written locally and not yet pushed. */
  dirty: Flag
}

export interface Term extends Synced {
  name: string
  start_date: string
  end_date: string
  is_active: Flag
  archived: Flag
}

export interface ClassPreset extends Synced {
  term_id: string
  title: string
  location: string
  faculty_name: string
  color: string
}

export interface TimeSlot extends Synced {
  term_id: string
  position: number
  /** Local wall-clock "HH:MM" — a timetable slot is 09:00 wherever you are. */
  start_time: string
  end_time: string
}

/** day index -> slot id -> class preset id. A missing key is an empty slot. */
export type Assignments = Record<string, Record<string, string>>

export interface ScheduleBlock extends Synced {
  term_id: string
  label: string
  effective_from: string
  assignments: Assignments
}

export function emptyAssignments(): Assignments {
  return { '0': {}, '1': {}, '2': {}, '3': {}, '4': {}, '5': {} }
}

/** Deep copy — used by the Saturday copy and by "duplicate this block", both of
 *  which must snapshot rather than share structure. */
export function cloneAssignments(a: Assignments): Assignments {
  const out = emptyAssignments()
  for (const day of Object.keys(out)) out[day] = { ...(a[day] ?? {}) }
  return out
}
