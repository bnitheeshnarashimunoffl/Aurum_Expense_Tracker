import { useEffect, useState } from 'react'
import KindleSheet from './KindleSheet'
import { MAX_STAGE_LIMIT, isOneToOneTarget, type Habit } from '../lib/types'

interface EditStagesSheetProps {
  open: boolean
  habit: Habit | null
  onSave: (patch: { maxStage: number; targetValue?: number | null; targetUnit?: string | null }) => Promise<void>
  onCancel: () => void
}

/**
 * Edits a multi-stage habit's stage count — for the 1:1 habits (water/sleep/study,
 * or any future habit created the same way) this doubles as editing the real-world
 * target, since target_value === max_stage for those. Always clears palette_key
 * (in useHabits.updateHabitStages) so the color gradient regenerates live.
 */
export default function EditStagesSheet({ open, habit, onSave, onCancel }: EditStagesSheetProps) {
  const [value, setValue] = useState(1)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && habit) setValue(habit.max_stage)
  }, [open, habit])

  if (!habit) return null
  const oneToOne = isOneToOneTarget(habit)

  async function handleSave() {
    setSaving(true)
    try {
      if (oneToOne) {
        await onSave({ maxStage: value, targetValue: value, targetUnit: habit!.target_unit })
      } else {
        await onSave({ maxStage: value })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <KindleSheet open={open} onClose={onCancel} title={`Edit ${habit.label}`}>
      <label className="mb-1.5 block text-sm text-muted" htmlFor="stage-edit">
        {oneToOne ? `Target (${habit.target_unit ?? 'units'})` : `Number of stages (max ${MAX_STAGE_LIMIT})`}
      </label>
      <input
        id="stage-edit"
        type="number"
        min={1}
        max={MAX_STAGE_LIMIT}
        value={value}
        onChange={(e) => setValue(Math.min(MAX_STAGE_LIMIT, Math.max(1, Number(e.target.value) || 1)))}
        className="kindle-neu-pressed mb-4 w-full rounded-card border-none bg-transparent px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
      />
      <p className="mb-4 text-xs text-muted">
        Already-logged days keep their raw stage number — their color may reinterpret slightly under the new scale, but nothing is rewritten.
      </p>
      <button
        onClick={handleSave}
        disabled={saving}
        className="kindle-neu-raised min-h-[44px] w-full rounded-card bg-accent py-3 font-medium text-ink disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </KindleSheet>
  )
}
