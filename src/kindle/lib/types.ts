export type HabitType = 'binary' | 'multi_stage'

export interface Habit {
  id: string
  user_id: string
  label: string
  position: number
  active: boolean
  created_at: string
  type: HabitType
  /** Highest real tap-stage. Binary habits are always 1 (single tap = done). */
  max_stage: number
  target_value: number | null
  target_unit: string | null
  /** Pins an exact non-generated palette (currently only 'baths'); null = live-generated gradient. */
  palette_key: string | null
}

export interface HabitLog {
  id: string
  user_id: string
  habit_id: string
  date: string
  /** 0 = not started. "Completed" is always derived as stage === habit.max_stage — never stored separately. */
  stage: number
  edited_after_the_fact: boolean
  edit_reason: string | null
  created_at: string
  updated_at: string
}

export const MAX_STAGE_LIMIT = 10

export interface DefaultHabitConfig {
  label: string
  type: HabitType
  max_stage: number
  target_value: number | null
  target_unit: string | null
  palette_key: string | null
}

/**
 * The three habits a brand-new Kindle starts with.
 *
 * Kindle is the ONE module that ships with anything in it, and the reason is that
 * an empty 8×7 grid does not read as "add a habit" — it reads as broken. A grid
 * is a shape made of its contents; with none, there is nothing on screen to
 * explain what the shape is for.
 *
 * The spread is the point, not the habits. One binary (Gym: tapped or not) and
 * two multi-stage on different ranges (Sleep 1–8, Study 1–5) demonstrate the
 * whole habit model in one glance — that a day can be partly done, and that
 * "partly" means different amounts for different things. A walkthrough would need
 * three paragraphs to say what three rows of the grid say by themselves.
 *
 * Everything ELSE this list used to carry — water, baths, protein, skincare,
 * processed foods — was one person's routine, and was removed for the public
 * release. These three are examples, the Kindle walkthrough says so out loud, and
 * all of them can be renamed, retargeted or deleted in Settings.
 *
 * Existing accounts are untouched: ensureDefaultHabitsSeeded() only ever runs
 * against a habits table with zero rows in it.
 */
export const DEFAULT_HABITS: DefaultHabitConfig[] = [
  { label: 'Gym', type: 'binary', max_stage: 1, target_value: null, target_unit: null, palette_key: null },
  // The "(N hours)" suffix is the module's convention, not decoration:
  // shortHabitLabel() strips it for the pill, so the name stays short there while
  // the log sheet still shows "Target: 8 hours".
  { label: 'Sleep (8 hours)', type: 'multi_stage', max_stage: 8, target_value: 8, target_unit: 'hours', palette_key: null },
  { label: 'Study (5 hours)', type: 'multi_stage', max_stage: 5, target_value: 5, target_unit: 'hours', palette_key: null },
]

/**
 * A habit's target is "1:1 editable" (Settings shows it as "Target: N unit" rather
 * than a bare stage count) when target_value and max_stage are numerically equal —
 * true for water/sleep/study today, and for any future habit created the same way.
 * Avoids hardcoding a label list that would break if a habit were ever renamed.
 */
export function isOneToOneTarget(habit: Pick<Habit, 'target_value' | 'max_stage'>): boolean {
  return habit.target_value !== null && habit.target_value === habit.max_stage
}
