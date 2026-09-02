import VirtusSheet from './VirtusSheet'
import type { Exercise, SplitDay } from '../lib/types'

interface SplitDayPickerProps {
  open: boolean
  splitDays: SplitDay[]
  exercisesOf: (splitDayId: string) => Exercise[]
  currentId: string | null
  onPick: (splitDayId: string) => void
  onClose: () => void
}

/**
 * Overriding what the schedule suggested. Each option shows the exercises it holds,
 * because "Back Width" only means something if you can see what is in it — and a
 * split day with nothing assigned says so rather than looking like a valid choice
 * that then opens an empty logging screen.
 */
export default function SplitDayPicker({
  open,
  splitDays,
  exercisesOf,
  currentId,
  onPick,
  onClose,
}: SplitDayPickerProps) {
  return (
    <VirtusSheet open={open} onClose={onClose} title="What are you training?">
      <div className="space-y-2">
        {splitDays.map((splitDay) => {
          const exercises = exercisesOf(splitDay.id)
          const selected = splitDay.id === currentId
          return (
            <button
              key={splitDay.id}
              onClick={() => onPick(splitDay.id)}
              className="virtus-neu-raised-sm flex w-full items-center gap-3 rounded-card px-3.5 py-3 text-left transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-inkCharcoal">{splitDay.name}</span>
                <span className="block truncate text-[11px] text-inkSoft">
                  {exercises.length === 0
                    ? 'No exercises assigned yet'
                    : exercises.map((e) => e.name).join(', ')}
                </span>
              </span>
              {selected && (
                <span className="flex-shrink-0 text-[11px] font-medium text-bronzeDeep">Current</span>
              )}
            </button>
          )
        })}
        {splitDays.length === 0 && (
          <p className="virtus-neu-pressed rounded-card px-4 py-6 text-center text-sm text-inkSoft">
            No split days yet — build one in Settings.
          </p>
        )}
      </div>
    </VirtusSheet>
  )
}
