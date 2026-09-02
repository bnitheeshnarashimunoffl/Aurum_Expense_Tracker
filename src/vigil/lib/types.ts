/** The daily study target, in seconds. The timer counts down from here. */
export const DAILY_TARGET_SECONDS = 5 * 60 * 60

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
