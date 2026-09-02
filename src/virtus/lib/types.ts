/** Mon..Sun, matching the Mon-first week the rest of Meridian uses. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const WEEKDAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface MuscleGroup {
  id: string
  user_id: string
  label: string
  position: number
  created_at: string
}

export interface Exercise {
  id: string
  user_id: string
  name: string
  muscle_group_id: string | null
  /** Soft delete. An archived exercise leaves the library and every split day, but
   *  stays resolvable so historical sets keep their name. */
  archived: boolean
  created_at: string
}

export interface SplitDay {
  id: string
  user_id: string
  name: string
  position: number
  created_at: string
}

export interface SplitDayExercise {
  id: string
  user_id: string
  split_day_id: string
  exercise_id: string
  position: number
}

/** A missing row means "not scheduled yet"; a row with a null split day means Rest. */
export interface ScheduleEntry {
  user_id: string
  day_of_week: DayOfWeek
  split_day_id: string | null
}

export interface Session {
  id: string
  user_id: string
  date: string
  split_day_id: string | null
  is_rest_day: boolean
  created_at: string
  updated_at: string
}

export interface LoggedSet {
  id: string
  user_id: string
  session_id: string
  exercise_id: string
  set_number: number
  weight_kg: number
  reps: number
  logged_at: string
}

/** A session plus the sets that belong to it — the shape every screen reads. */
export interface SessionWithSets extends Session {
  sets: LoggedSet[]
}
