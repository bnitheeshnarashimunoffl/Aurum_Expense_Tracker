import { todayISO } from '@/lib/format'
import type { Recurrence, Todo } from './types'

/**
 * Recurrence maths for to-dos. Pure and date-only — no rows, no Supabase — so the
 * one genuinely fiddly rule in Chronicle can be reasoned about (and driven in the
 * verification harness) on its own.
 *
 * Local-time throughout, like every other date file in Meridian: toISOString()
 * would slide local midnight back a day in IST and quietly shift every due date.
 */

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISO(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/**
 * One step of the cadence from the given date.
 *
 * MONTHLY clamps rather than overflowing: JavaScript would turn 31 Jan + 1 month
 * into 3 March, which is not what "monthly" means to anyone. The 31st of a short
 * month becomes its last day instead.
 */
export function advanceOnce(iso: string, recurrence: Recurrence, interval: number | null): string {
  const d = parseISO(iso)
  switch (recurrence) {
    case 'DAILY':
      d.setDate(d.getDate() + 1)
      return toISO(d)
    case 'WEEKLY':
      d.setDate(d.getDate() + 7)
      return toISO(d)
    case 'CUSTOM':
      d.setDate(d.getDate() + Math.max(1, interval ?? 1))
      return toISO(d)
    case 'MONTHLY': {
      const day = d.getDate()
      const target = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const lastDayOfTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      target.setDate(Math.min(day, lastDayOfTarget))
      return toISO(target)
    }
  }
}

/** Safety valve on the catch-up loop below — 500 daily steps is ~16 months. */
const MAX_STEPS = 500

/**
 * The due date of the occurrence that follows the one being completed.
 *
 * The subtlety is completing something LATE. If a daily to-do was due on the 1st
 * and you tick it off on the 20th, advancing once would hand you a next occurrence
 * due on the 2nd — already overdue on the day it was born, and the same again
 * tomorrow. So the cadence is stepped forward until it lands strictly after today:
 * the series keeps its rhythm (a monthly to-do due on the 15th stays on the 15th)
 * without ever generating an occurrence that is born in the past.
 *
 * A recurring to-do with no due date is anchored on today, since there is nothing
 * else to count from.
 */
export function nextOccurrenceDate(
  dueDate: string | null,
  recurrence: Recurrence,
  interval: number | null,
  today: string = todayISO()
): string {
  let next = advanceOnce(dueDate ?? today, recurrence, interval)
  let steps = 0
  while (next <= today && steps < MAX_STEPS) {
    next = advanceOnce(next, recurrence, interval)
    steps += 1
  }
  return next
}

/**
 * The fields of the successor occurrence, given the one being completed. Title,
 * detail, priority, tags and links all carry forward — a recurring to-do is the
 * same task each time, so re-attaching its reference material every week would be
 * busywork. The successor is a fresh, incomplete row sharing the series_id.
 */
export function successorFields(todo: Todo, today: string = todayISO()) {
  if (!todo.recurrence) return null
  return {
    title: todo.title,
    notes: todo.notes,
    priority: todo.priority,
    due_date: nextOccurrenceDate(todo.due_date, todo.recurrence, todo.recurrence_interval, today),
    recurrence: todo.recurrence,
    recurrence_interval: todo.recurrence_interval,
    series_id: todo.series_id,
    is_complete: false,
  }
}

export function recurrenceSummary(recurrence: Recurrence | null, interval: number | null): string | null {
  if (!recurrence) return null
  switch (recurrence) {
    case 'DAILY':
      return 'Daily'
    case 'WEEKLY':
      return 'Weekly'
    case 'MONTHLY':
      return 'Monthly'
    case 'CUSTOM':
      return interval === 1 ? 'Daily' : `Every ${interval ?? 2} days`
  }
}

/* ------------------------------------------------------------------------- */
/* Due-date presentation                                                      */
/* ------------------------------------------------------------------------- */

export type DueTone = 'overdue' | 'today' | 'soon' | 'later'

export interface DueInfo {
  label: string
  tone: DueTone
}

/**
 * How a due date reads in a list row. Relative wording near the present ("Today",
 * "Tomorrow", "In 3 days") and an absolute date beyond that — a bare "2026-09-14"
 * makes the reader do arithmetic on every row.
 */
export function describeDue(dueDate: string | null, today: string = todayISO()): DueInfo | null {
  if (!dueDate) return null
  const days = Math.round((parseISO(dueDate).getTime() - parseISO(today).getTime()) / 86_400_000)
  if (days < 0) {
    const overdueBy = Math.abs(days)
    return { label: overdueBy === 1 ? 'Yesterday' : `${overdueBy} days overdue`, tone: 'overdue' }
  }
  if (days === 0) return { label: 'Today', tone: 'today' }
  if (days === 1) return { label: 'Tomorrow', tone: 'soon' }
  if (days <= 6) return { label: `In ${days} days`, tone: 'soon' }
  const d = parseISO(dueDate)
  const sameYear = d.getFullYear() === parseISO(today).getFullYear()
  return {
    label: d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    }),
    tone: 'later',
  }
}
