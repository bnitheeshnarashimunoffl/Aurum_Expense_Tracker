import { resolveStageColor, stageBoxShadow } from '../lib/gradient'
import type { Habit } from '../lib/types'

interface HabitGridCellProps {
  habit: Habit
  stage: number
  editMode: 'today' | 'past' | 'future'
  /** Purely a render-time tint (the previous day's stage color, faded) — never written, never read back from storage. */
  reflectionColor: string | null
  /**
   * Only past-day cells get a handler, and only on screens that offer the PIN-gated
   * edit flow. Today's cell is deliberately inert here — today is logged from the
   * pills below the grid, never by tapping the grid itself.
   */
  onEdit?: () => void
  ariaLabel: string
}

export default function HabitGridCell({ habit, stage, editMode, reflectionColor, onEdit, ariaLabel }: HabitGridCellProps) {
  const color = resolveStageColor(habit, stage)
  const tint = reflectionColor
    ? `color-mix(in srgb, var(--kindle-bg-surface) 78%, ${reflectionColor} 22%)`
    : 'var(--kindle-bg-surface)'

  const style: React.CSSProperties = {
    background: color ?? tint,
    boxShadow: stageBoxShadow(habit.max_stage > 0 ? stage / habit.max_stage : 0),
    // Future days hold nothing to log yet, so they sit back visually while still
    // occupying their column — the row stays a full, aligned 7 across.
    opacity: editMode === 'future' ? 0.32 : 1,
    ...(editMode === 'today' ? { outline: '1px solid color-mix(in srgb, var(--accent) 55%, transparent)', outlineOffset: '1px' } : {}),
  }

  const label = `${ariaLabel} — stage ${stage} of ${habit.max_stage}`

  if (!onEdit) {
    return <div role="img" aria-label={label} className="aspect-square w-full rounded-lg" style={style} />
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`${label} — edit this past day`}
      className="aspect-square w-full rounded-lg transition-transform active:scale-95"
      style={style}
    />
  )
}
