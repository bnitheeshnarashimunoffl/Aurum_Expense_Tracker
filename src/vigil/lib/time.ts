import { DAILY_TARGET_SECONDS, type VigilDay } from './types'

/**
 * Live studied seconds for a day row. A running timer is stored as
 * `accumulated_seconds` + a `running_since` timestamp rather than a ticking
 * counter, so this stays correct across a reload, a backgrounded tab, or a
 * closed app — nothing has to be running for the number to be right.
 */
export function studiedSeconds(day: Pick<VigilDay, 'accumulated_seconds' | 'running_since'> | null, now: number): number {
  if (!day) return 0
  const live = day.running_since ? Math.max(0, (now - new Date(day.running_since).getTime()) / 1000) : 0
  return Math.max(0, day.accumulated_seconds + live)
}

/** Countdown remaining, floored at zero — the timer never shows a negative. */
export function remainingSeconds(studied: number): number {
  return Math.max(0, DAILY_TARGET_SECONDS - studied)
}

/** Seconds banked beyond the daily target. Zero until the countdown hits 0:00:00. */
export function overflowSeconds(studied: number): number {
  return Math.max(0, studied - DAILY_TARGET_SECONDS)
}

/** Derived, never stored — the same principle as Kindle deriving completion from `stage`. */
export function isOverflow(studied: number): boolean {
  return studied >= DAILY_TARGET_SECONDS
}

/** 0..1 progress toward the daily target, clamped. Drives the dial and the bars. */
export function targetFraction(studied: number): number {
  return Math.min(1, studied / DAILY_TARGET_SECONDS)
}

function pad(n: number): string {
  return String(Math.floor(n)).padStart(2, '0')
}

/** "4:12:07" — hours never zero-padded, so the leading digit doesn't jitter in width. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`
}

/** "5h 23m" / "48m" / "0m" — the compact form for chart labels and day totals. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

/** Splits a day's total into the part that counted toward the target and the bonus beyond it. */
export function splitAgainstTarget(studied: number): { onTarget: number; bonus: number } {
  return { onTarget: Math.min(studied, DAILY_TARGET_SECONDS), bonus: overflowSeconds(studied) }
}
