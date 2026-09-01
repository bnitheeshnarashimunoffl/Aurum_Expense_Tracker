import { Fragment } from 'react'
import HabitGridCell from './HabitGridCell'
import { cellEditMode } from '../lib/date'
import { resolveStageColor } from '../lib/gradient'
import { shortHabitLabel } from '../lib/quantity'
import type { Habit, HabitLog } from '../lib/types'

export interface DayColumn {
  date: string
  headerLabel: string
  subLabel?: string
}

interface HabitGridProps {
  habits: Habit[]
  days: DayColumn[]
  logs: HabitLog[]
  /**
   * Past-day cells become buttons that start the PIN-gated edit flow. Omit it and
   * the grid is entirely read-only — which is what the main weekly view uses, since
   * today is logged from the pills below it.
   */
  onEditPastDay?: (habit: Habit, date: string, currentStage: number) => void
}

/**
 * One CSS Grid for the whole table — never per-row flex rows — so column N is the
 * same calendar day in every habit row by construction. Up to 7 days the columns
 * are fluid (`1fr`) and the whole week always fits the viewport with no horizontal
 * scroll; a month's 30-odd columns fall back to fixed-width tracks in a scroller
 * with the label column pinned.
 */
export default function HabitGrid({ habits, days, logs, onEditPastDay }: HabitGridProps) {
  const logByKey = new Map(logs.map((l) => [`${l.habit_id}_${l.date}`, l]))
  const stageAt = (habitId: string, date: string) => logByKey.get(`${habitId}_${date}`)?.stage ?? 0

  const scrolls = days.length > 7
  const gap = scrolls ? 4 : 6
  const gridTemplateColumns = scrolls
    ? `140px repeat(${days.length}, 22px)`
    : `minmax(84px, 2.6fr) repeat(${days.length}, minmax(0, 1fr))`

  return (
    <div className={scrolls ? 'overflow-x-auto' : ''}>
      <div style={{ display: 'grid', gridTemplateColumns, columnGap: gap, rowGap: gap }}>
        <div />
        {days.map((day) => {
          const isToday = cellEditMode(day.date) === 'today'
          return (
            <div key={day.date} className="min-w-0 text-center">
              <div className={`text-[10px] uppercase tracking-wide ${isToday ? 'text-accent' : 'text-muted'}`}>{day.headerLabel}</div>
              {day.subLabel && <div className={`text-[9px] ${isToday ? 'text-accent' : 'text-muted'}`}>{day.subLabel}</div>}
            </div>
          )
        })}

        {habits.map((habit) => (
          <Fragment key={habit.id}>
            <div
              className="flex min-w-0 items-center pr-2 text-xs text-primary"
              style={scrolls ? { position: 'sticky', left: 0, background: 'var(--kindle-bg-base)' } : undefined}
              title={habit.label}
            >
              {/* The ellipsis needs a block box of its own — text-overflow does nothing
                  on the anonymous text child of a flex container. */}
              <span className="truncate">{shortHabitLabel(habit.label)}</span>
            </div>
            {days.map((day, i) => {
              const stage = stageAt(habit.id, day.date)
              const mode = cellEditMode(day.date)
              // Reflection: a cell with nothing of its own picks up a faint wash of the
              // previous day's real stage color. Derived at render time from live data,
              // never stored — and it applies to tomorrow's (future) cell too.
              const prevStage = i > 0 ? stageAt(habit.id, days[i - 1].date) : 0
              const reflectionColor = stage <= 0 && prevStage > 0 ? resolveStageColor(habit, prevStage) : null
              return (
                <HabitGridCell
                  key={day.date}
                  habit={habit}
                  stage={stage}
                  editMode={mode}
                  reflectionColor={reflectionColor}
                  ariaLabel={`${habit.label} — ${day.date}`}
                  onEdit={onEditPastDay && mode === 'past' ? () => onEditPastDay(habit, day.date, stage) : undefined}
                />
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
