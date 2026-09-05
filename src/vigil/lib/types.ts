/**
 * The daily study target, in seconds, when a week has no target of its own.
 *
 * Five hours was Vigil's fixed target for its whole life before this, so it stays
 * the number a brand-new account starts from and the number every existing week
 * is still judged against. It is now a default, not a law: see `vigil_targets`
 * and `useVigilTarget`.
 */
export const DEFAULT_TARGET_SECONDS = 5 * 60 * 60

/**
 * The range a target can be set to. The floor is high enough that hitting it
 * still means something; the ceiling is past any honest day of study, and exists
 * so a mistyped number cannot lock somebody to an unreachable week.
 *
 * These two are mirrored by a CHECK constraint on the table, so the limit holds
 * whether or not it came through this UI.
 */
export const MIN_TARGET_SECONDS = 30 * 60
export const MAX_TARGET_SECONDS = 12 * 60 * 60

export interface VigilDay {
  id: string
  user_id: string
  date: string
  /** Study time banked by completed play/pause segments. */
  accumulated_seconds: number
  /** Non-null only while the timer is actively counting. */
  running_since: string | null
  edited_after_the_fact: boolean
  created_at: string
  updated_at: string
}

/**
 * One week's chosen daily target. Written once and never updated — the table has
 * no update policy, which is what makes the lock real rather than a UI promise.
 *
 * Keyed by the Monday of the week it governs, in the user's own local time, the
 * same way every other date in Vigil is computed.
 */
export interface VigilTarget {
  user_id: string
  week_start: string
  target_seconds: number
  created_at: string
}

export interface VigilCategory {
  id: string
  user_id: string
  label: string
  position: number
  created_at: string
}

export interface VigilSubject {
  id: string
  user_id: string
  category_id: string
  label: string
  position: number
  created_at: string
}

export interface VigilSubtopic {
  id: string
  user_id: string
  subject_id: string
  label: string
  position: number
  /** The ONLY stored completion in the tree — every parent state is derived from these. */
  completed: boolean
  created_at: string
}
