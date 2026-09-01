import { useEffect, useState } from 'react'
import KindleSheet from './KindleSheet'
import StageSelector from './StageSelector'
import { targetLabel, shortHabitLabel } from '../lib/quantity'
import type { Habit } from '../lib/types'

interface EditReasonSheetProps {
  open: boolean
  habit: Habit
  dateLabel: string
  currentStage: number
  onSave: (stage: number, reason: string) => Promise<void>
  onCancel: () => void
}

/**
 * Past-day edit, unlocked only after usePinGate's PIN check succeeds. Picks a value
 * with the same <StageSelector> the today-logging modal uses, so the two flows differ
 * only in what they demand of you — this one will not save without a written reason,
 * and that reason surfaces in the monthly PDF's edit notes.
 */
export default function EditReasonSheet({ open, habit, dateLabel, currentStage, onSave, onCancel }: EditReasonSheetProps) {
  const [stage, setStage] = useState(currentStage)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setStage(currentStage)
      setReason('')
    }
  }, [open, currentStage])

  async function handleSave() {
    if (!reason.trim()) return
    setSaving(true)
    try {
      await onSave(stage, reason.trim())
    } finally {
      setSaving(false)
    }
  }

  const target = targetLabel(habit)

  return (
    <KindleSheet open={open} onClose={onCancel} title="Edit past day">
      <p className="mb-4 text-sm text-muted">
        {shortHabitLabel(habit.label)} · {dateLabel}
        {target ? ` · ${target}` : ''}
      </p>

      <div className="mb-4">
        <StageSelector habit={habit} value={stage} onSelect={setStage} />
      </div>

      {habit.type === 'multi_stage' && (
        <button
          type="button"
          onClick={() => setStage(0)}
          disabled={stage <= 0}
          className="mb-4 min-h-[40px] w-full rounded-card text-xs text-muted disabled:opacity-40"
        >
          Clear this day
        </button>
      )}

      <label className="mb-1.5 block text-sm text-muted" htmlFor="edit-reason">
        Reason for this change
      </label>
      <textarea
        id="edit-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="e.g. Forgot to log it that night"
        className="kindle-neu-pressed mb-4 w-full rounded-card border-none bg-transparent px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
      />

      <button
        onClick={handleSave}
        disabled={saving || !reason.trim()}
        className="kindle-neu-raised min-h-[44px] w-full rounded-card bg-accent py-3 font-medium text-ink disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save change'}
      </button>
    </KindleSheet>
  )
}
