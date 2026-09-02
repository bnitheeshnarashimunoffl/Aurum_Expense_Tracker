import type { LoggedSet, SessionWithSets } from './types'

/**
 * Total work done in a session: Σ(weight × reps) across every logged set. The
 * standard strength-training convention — it rewards heavier weight, more reps and
 * more sets on one axis, so no separate tracking is needed for each.
 *
 * Always derived, never stored: a stored total would be a second source of truth
 * that could silently disagree with the sets after any edit.
 */
export function sessionVolume(sets: LoggedSet[]): number {
  return sets.reduce((total, set) => total + set.weight_kg * set.reps, 0)
}

/** How many past sessions of the same split day form the baseline. */
export const BASELINE_WINDOW = 6

/**
 * The rolling average this day is judged against: the trailing sessions of the
 * SAME split day, before this date.
 *
 * Comparing against an all-time or cross-split-day average would be meaningless —
 * a leg day and a shoulder day are not on the same volume scale, so a heavy
 * shoulder session would always look like a bad leg session. Judging a split day
 * only against its own past is the only comparison that says anything.
 *
 * Returns null when there is nothing to compare against yet, which the grid renders
 * as "logged, no baseline" rather than inventing a rank for it.
 */
export function rollingBaseline(
  sessions: SessionWithSets[],
  splitDayId: string,
  beforeDate: string,
  window = BASELINE_WINDOW
): number | null {
  const past = sessions
    .filter((s) => !s.is_rest_day && s.split_day_id === splitDayId && s.date < beforeDate && s.sets.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, window)

  if (past.length === 0) return null
  return past.reduce((total, s) => total + sessionVolume(s.sets), 0) / past.length
}

/**
 * The five ramp steps, mirroring --virtus-vol-1..5 in index.css. Magnitude is
 * carried by lightness (light = light day, dark = heavy day); the red -> bronze ->
 * green hue shift is a redundant second channel, not the encoding. See the token
 * block for why a plain red->green ramp was rejected.
 */
export const VOLUME_RAMP = ['#d98e7f', '#c17755', '#9d6725', '#516720', '#1b5528'] as const
export type VolumeStep = 0 | 1 | 2 | 3 | 4

/** Upper bounds of steps 0..3; anything above the last one is step 4. */
const RATIO_BREAKS = [0.8, 0.93, 1.07, 1.2] as const

export const STEP_LABEL: Record<VolumeStep, string> = {
  0: 'Well below your average',
  1: 'Below your average',
  2: 'On par with your average',
  3: 'Above your average',
  4: 'Well above your average',
}

export function volumeStep(volume: number, baseline: number): VolumeStep {
  if (baseline <= 0) return 2
  const ratio = volume / baseline
  for (let i = 0; i < RATIO_BREAKS.length; i++) {
    if (ratio < RATIO_BREAKS[i]) return i as VolumeStep
  }
  return 4
}

/**
 * Ink that stays readable on a given ramp step. The ramp deliberately spans a wide
 * lightness range, so the two light steps need charcoal and the three dark ones
 * need marble — a single fixed ink would be unreadable at one end.
 */
export function onStep(step: VolumeStep): string {
  return step <= 1 ? 'var(--ink-charcoal)' : 'var(--marble-base)'
}

/** What a single cell in the weekly / monthly grid should draw. */
export type CellState =
  | { kind: 'empty' }
  | { kind: 'rest' }
  | { kind: 'logged-no-baseline'; volume: number }
  | { kind: 'ranked'; volume: number; baseline: number; ratio: number; step: VolumeStep }

export function cellStateFor(session: SessionWithSets | undefined, allSessions: SessionWithSets[]): CellState {
  if (!session) return { kind: 'empty' }
  if (session.is_rest_day) return { kind: 'rest' }

  const volume = sessionVolume(session.sets)
  // A training session with nothing logged in it yet is still just an empty day as
  // far as the grid is concerned — there is no work to rank.
  if (session.sets.length === 0) return { kind: 'empty' }

  const baseline = session.split_day_id ? rollingBaseline(allSessions, session.split_day_id, session.date) : null
  if (baseline === null) return { kind: 'logged-no-baseline', volume }

  return { kind: 'ranked', volume, baseline, ratio: volume / baseline, step: volumeStep(volume, baseline) }
}

const volumeFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

/** Volume runs to five and six figures fast, so it is always grouped, never raw. */
export function formatVolume(volume: number): string {
  return volumeFormatter.format(Math.round(volume))
}

/** Trailing zeros on a weight read as noise mid-workout: 45 not 45.00, 2.5 stays 2.5. */
export function formatWeight(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : String(Number(kg.toFixed(2)))
}

/** "45kg × 10" — the one canonical way a set is written across the module. */
export function formatSet(set: Pick<LoggedSet, 'weight_kg' | 'reps'>): string {
  return `${formatWeight(set.weight_kg)}kg × ${set.reps}`
}

/** Sets belonging to one exercise, in the order they were logged. */
export function setsForExercise(sets: LoggedSet[], exerciseId: string): LoggedSet[] {
  return sets.filter((s) => s.exercise_id === exerciseId).sort((a, b) => a.set_number - b.set_number)
}

/**
 * The most recent earlier session that has any set of this exercise — the
 * progressive-overload reference. Deliberately not restricted to the same split
 * day: if an exercise moved between split days, the last time you actually lifted
 * it is still the number to beat.
 */
export function lastSessionWith(
  sessions: SessionWithSets[],
  exerciseId: string,
  beforeDate: string
): { date: string; sets: LoggedSet[] } | null {
  const candidates = sessions
    .filter((s) => s.date < beforeDate && s.sets.some((set) => set.exercise_id === exerciseId))
    .sort((a, b) => b.date.localeCompare(a.date))

  const found = candidates[0]
  if (!found) return null
  return { date: found.date, sets: setsForExercise(found.sets, exerciseId) }
}

/** Heaviest single set of an exercise across all history — used for the PR badge. */
export function personalBest(sessions: SessionWithSets[], exerciseId: string): number {
  let best = 0
  for (const session of sessions) {
    for (const set of session.sets) {
      if (set.exercise_id === exerciseId && set.weight_kg > best) best = set.weight_kg
    }
  }
  return best
}
