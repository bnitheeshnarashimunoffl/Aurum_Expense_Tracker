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

// Study's target was revised from 6 to 5 hours in the multi-stage revision (Part 2's
// stage table is authoritative for this pass) — the seeded label reflects the new target.
export const DEFAULT_HABITS: DefaultHabitConfig[] = [
  { label: 'Water intake (4 litres/day)', type: 'multi_stage', max_stage: 4, target_value: 4, target_unit: 'litres', palette_key: null },
  { label: 'Gym', type: 'binary', max_stage: 1, target_value: null, target_unit: null, palette_key: null },
  { label: 'Sleep (8 hours)', type: 'multi_stage', max_stage: 8, target_value: 8, target_unit: 'hours', palette_key: null },
  { label: 'Study (5 hours)', type: 'multi_stage', max_stage: 5, target_value: 5, target_unit: 'hours', palette_key: null },
  { label: 'Skincare routine', type: 'binary', max_stage: 1, target_value: null, target_unit: null, palette_key: null },
  { label: 'Baths (two/day)', type: 'multi_stage', max_stage: 2, target_value: 2, target_unit: 'baths', palette_key: 'baths' },
  {
    label: 'Protein intake (100g/day, natural sources)',
    type: 'multi_stage',
    max_stage: 4,
    target_value: 100,
    target_unit: 'grams',
    palette_key: null,
  },
  { label: 'Avoiding processed foods', type: 'binary', max_stage: 1, target_value: null, target_unit: null, palette_key: null },
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
