import { useEffect, useState } from 'react'
import LoomSheet from './LoomSheet'
import { DAY_FULL, SATURDAY, type DayIndex } from '../lib/types'
import type { ClassPreset, ScheduleBlock, TimeSlot } from '../lib/types'

interface CopyToSaturdaySheetProps {
  open: boolean
  block: ScheduleBlock
  slots: TimeSlot[]
  presets: Map<string, ClassPreset>
  onCopy: (fromDay: DayIndex) => Promise<void>
  onClose: () => void
}

/**
 * Copies one weekday's assignments into Saturday. Two deliberate properties:
 *
 *   * It is an explicit, separately-confirmed action, because it OVERWRITES
 *     whatever Saturday currently holds — the confirm step names how many slots
 *     will be replaced rather than asking a generic "are you sure".
 *   * The copy is a one-time snapshot. Saturday keeps no link to the day it came
 *     from, so editing either afterwards leaves the other alone.
 */
export default function CopyToSaturdaySheet({ open, block, slots, presets, onCopy, onClose }: CopyToSaturdaySheetProps) {
  const [chosen, setChosen] = useState<DayIndex | null>(null)
  const [copying, setCopying] = useState(false)

  useEffect(() => {
    if (open) setChosen(null)
  }, [open])

  const saturdayCount = Object.keys(block.assignments[String(SATURDAY)] ?? {}).length

  function countFor(day: DayIndex): number {
    return Object.keys(block.assignments[String(day)] ?? {}).length
  }

  function previewFor(day: DayIndex): string {
    const map = block.assignments[String(day)] ?? {}
    const titles = slots
      .map((s) => map[s.id])
      .filter(Boolean)
      .map((id) => presets.get(id)?.title)
      .filter(Boolean) as string[]
    return titles.slice(0, 3).join(', ') + (titles.length > 3 ? `, +${titles.length - 3} more` : '')
  }

  return (
    <LoomSheet open={open} onClose={onClose} title="Copy a weekday into Saturday">
      <p className="mb-4 text-xs leading-relaxed text-loomMuted">
        This makes a one-time copy. Saturday will not stay linked to the day you pick — editing either
        one afterwards leaves the other unchanged.
      </p>

      <div className="mb-4 space-y-2">
        {([0, 1, 2, 3, 4] as DayIndex[]).map((day) => {
          const count = countFor(day)
          const selected = chosen === day
          return (
            <button
              key={day}
              type="button"
              onClick={() => setChosen(day)}
              aria-pressed={selected}
              disabled={count === 0}
              className={`flex w-full items-center justify-between rounded-card px-4 py-3 text-left disabled:opacity-40 ${
                selected ? 'loom-neu-pressed' : 'loom-neu-raised'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${selected ? 'text-loomGold' : 'text-loomInk'}`}>
                  {DAY_FULL[day]}
                </span>
                <span className="block truncate text-[11px] text-loomMuted">
                  {count === 0 ? 'Nothing scheduled' : previewFor(day)}
                </span>
              </span>
              <span className="ml-3 flex-shrink-0 text-[11px] tabular-nums text-loomMuted">{count} classes</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={async () => {
          if (chosen === null || copying) return
          setCopying(true)
          try {
            await onCopy(chosen)
            onClose()
          } finally {
            setCopying(false)
          }
        }}
        disabled={chosen === null || copying}
        className="loom-neu-raised min-h-[46px] w-full rounded-card text-sm font-semibold text-loomGold disabled:opacity-40"
      >
        {chosen === null
          ? 'Pick a day to copy'
          : copying
            ? 'Copying…'
            : saturdayCount > 0
              ? `Replace Saturday's ${saturdayCount} classes with ${DAY_FULL[chosen]}'s`
              : `Copy ${DAY_FULL[chosen]} into Saturday`}
      </button>
    </LoomSheet>
  )
}
