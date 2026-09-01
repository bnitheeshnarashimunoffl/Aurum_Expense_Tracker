import { useEffect, useState } from 'react'
import KindleSheet from './KindleSheet'
import StageSelector from './StageSelector'
import { stageQuantityLabel, targetLabel, shortHabitLabel } from '../lib/quantity'
import type { Habit } from '../lib/types'

interface LogHabitSheetProps {
  /** null closes the sheet; the last habit is retained so the slide-out animation still has content. */
  habit: Habit | null
  currentStage: number
  dateLabel: string
  onSelect: (stage: number) => void
  onClose: () => void
}

/**
 * The primary logging surface for the module: tap a pill, pick the amount you
 * actually did, done. Selecting an option saves and closes in one tap — the write
 * is fired in the background because useHabitLogs applies it optimistically first,
 * so waiting on the round-trip would only add a stall to an already-correct screen.
 */
export default function LogHabitSheet({ habit, currentStage, dateLabel, onSelect, onClose }: LogHabitSheetProps) {
  const [retained, setRetained] = useState<Habit | null>(habit)
  useEffect(() => {
    if (habit) setRetained(habit)
  }, [habit])

  const shown = habit ?? retained
  if (!shown) return null

  const target = targetLabel(shown)
  const currentLabel =
    currentStage <= 0
      ? 'Nothing logged yet'
      : shown.type === 'binary'
        ? 'Done'
        : stageQuantityLabel(shown, currentStage)

  function choose(stage: number) {
    // Fire the save before closing so the handler still sees this habit as the open
    // target; the write is not awaited, so the sheet still dismisses immediately.
    onSelect(stage)
    onClose()
  }

  return (
    <KindleSheet open={habit !== null} onClose={onClose}>
      <div className="mb-5">
        <h2 className="font-display text-xl font-bold text-primary">{shortHabitLabel(shown.label)}</h2>
        <p className="mt-1 text-xs text-muted">
          {dateLabel}
          {target ? ` · ${target}` : ''}
        </p>
        <p className="mt-3 text-sm text-primary">{currentLabel}</p>
      </div>

      <StageSelector habit={shown} value={currentStage} onSelect={choose} />

      {shown.type === 'multi_stage' && (
        <button
          type="button"
          onClick={() => choose(0)}
          disabled={currentStage <= 0}
          className="mt-4 min-h-[44px] w-full rounded-card text-sm text-muted disabled:opacity-40"
        >
          Clear today's entry
        </button>
      )}
    </KindleSheet>
  )
}
