import LoomSheet from './LoomSheet'
import { onColor } from '../lib/colors'
import { formatSlotRange } from '../lib/schedule'
import { DAY_FULL, type DayIndex } from '../lib/types'
import type { ClassPreset, TimeSlot } from '../lib/types'

interface AssignSheetProps {
  open: boolean
  target: { day: DayIndex; slot: TimeSlot } | null
  presets: ClassPreset[]
  currentPresetId: string | undefined
  onAssign: (presetId: string | null) => void
  onCreateNew: () => void
  onClose: () => void
}

/**
 * Picks which class occupies one day+slot. Selecting saves and closes in a single
 * tap — the same immediate-commit pattern the other modules use for their quick
 * pickers — because this is an edit the user makes dozens of times while building
 * a term and a confirm step would double every one of them.
 */
export default function AssignSheet({ open, target, presets, currentPresetId, onAssign, onCreateNew, onClose }: AssignSheetProps) {
  return (
    <LoomSheet open={open} onClose={onClose}>
      {target && (
        <>
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold text-loomInk">{DAY_FULL[target.day]}</h2>
            <p className="mt-0.5 text-xs tabular-nums text-loomMuted">{formatSlotRange(target.slot)}</p>
          </div>

          {presets.length === 0 ? (
            <p className="mb-4 text-sm text-loomMuted">No classes in this term's library yet.</p>
          ) : (
            <div className="mb-3 space-y-2">
              {presets.map((preset) => {
                const selected = preset.id === currentPresetId
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onAssign(preset.id)}
                    aria-pressed={selected}
                    className={`flex w-full items-center gap-3 rounded-card px-3 py-2.5 text-left transition-transform active:scale-[0.99] ${
                      selected ? 'loom-neu-pressed' : 'loom-neu-raised'
                    }`}
                  >
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                      style={{ background: preset.color, color: onColor(preset.color) }}
                    >
                      {preset.title.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-loomInk">{preset.title}</span>
                      {preset.location && <span className="block truncate text-[11px] text-loomMuted">{preset.location}</span>}
                    </span>
                    {selected && <span className="flex-shrink-0 text-[11px] text-loomGold">Current</span>}
                  </button>
                )
              })}
            </div>
          )}

          <button
            onClick={onCreateNew}
            className="loom-neu-raised mb-2 min-h-[44px] w-full rounded-card text-sm font-medium text-loomGold"
          >
            + New class
          </button>

          {currentPresetId && (
            <button
              onClick={() => onAssign(null)}
              className="min-h-[42px] w-full rounded-card text-xs text-loomMuted"
            >
              Clear this slot
            </button>
          )}
        </>
      )}
    </LoomSheet>
  )
}
