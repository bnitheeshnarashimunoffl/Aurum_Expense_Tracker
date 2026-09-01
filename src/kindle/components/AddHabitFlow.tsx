import { useState } from 'react'
import KindleSheet from './KindleSheet'
import { MAX_STAGE_LIMIT, type HabitType } from '../lib/types'

interface AddHabitFlowProps {
  open: boolean
  onCreate: (input: { label: string; type: HabitType; maxStage: number; targetValue: number | null; targetUnit: string | null }) => Promise<void>
  onCancel: () => void
}

type Step = 'label' | 'type' | 'stages'

/** Guided 3-step add-habit flow, already behind Settings' PIN gate by the time it opens. */
export default function AddHabitFlow({ open, onCreate, onCancel }: AddHabitFlowProps) {
  const [step, setStep] = useState<Step>('label')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<HabitType | null>(null)
  const [stageCount, setStageCount] = useState(4)
  const [targetValue, setTargetValue] = useState('')
  const [targetUnit, setTargetUnit] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setStep('label')
    setLabel('')
    setType(null)
    setStageCount(4)
    setTargetValue('')
    setTargetUnit('')
  }

  function handleCancel() {
    reset()
    onCancel()
  }

  function chooseType(chosen: HabitType) {
    setType(chosen)
    if (chosen === 'binary') {
      void finish(chosen, 1, null, null)
    } else {
      setStep('stages')
    }
  }

  async function finish(finalType: HabitType, maxStage: number, value: number | null, unit: string | null) {
    setSaving(true)
    try {
      await onCreate({ label: label.trim(), type: finalType, maxStage, targetValue: value, targetUnit: unit })
      reset()
    } finally {
      setSaving(false)
    }
  }

  return (
    <KindleSheet open={open} onClose={handleCancel} title="New habit">
      {step === 'label' && (
        <>
          <label className="mb-1.5 block text-sm text-muted" htmlFor="habit-label">
            Habit name
          </label>
          <input
            id="habit-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Meditation"
            className="kindle-neu-pressed mb-4 w-full rounded-card border-none bg-transparent px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={() => label.trim() && setStep('type')}
            disabled={!label.trim()}
            className="kindle-neu-raised min-h-[44px] w-full rounded-card bg-accent py-3 font-medium text-ink disabled:opacity-60"
          >
            Continue
          </button>
        </>
      )}

      {step === 'type' && (
        <>
          <p className="mb-4 text-sm text-muted">Is "{label.trim()}" done in one tap, or tracked in steps toward a target?</p>
          <div className="space-y-2">
            <button onClick={() => chooseType('binary')} className="kindle-neu-raised block w-full rounded-card px-4 py-3 text-left text-sm text-primary">
              <span className="font-medium">Binary</span>
              <span className="block text-xs text-muted">One tap = done. e.g. Gym, Skincare.</span>
            </button>
            <button onClick={() => chooseType('multi_stage')} className="kindle-neu-raised block w-full rounded-card px-4 py-3 text-left text-sm text-primary">
              <span className="font-medium">Multi-stage</span>
              <span className="block text-xs text-muted">Tap repeatedly toward a target. e.g. Water, Sleep.</span>
            </button>
          </div>
        </>
      )}

      {step === 'stages' && type === 'multi_stage' && (
        <>
          <label className="mb-1.5 block text-sm text-muted" htmlFor="stage-count">
            Number of stages (max {MAX_STAGE_LIMIT})
          </label>
          <input
            id="stage-count"
            type="number"
            min={1}
            max={MAX_STAGE_LIMIT}
            value={stageCount}
            onChange={(e) => setStageCount(Math.min(MAX_STAGE_LIMIT, Math.max(1, Number(e.target.value) || 1)))}
            className="kindle-neu-pressed mb-4 w-full rounded-card border-none bg-transparent px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
          />

          <div className="mb-4 flex gap-2">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm text-muted" htmlFor="target-value">
                Target value
              </label>
              <input
                id="target-value"
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="e.g. 4"
                className="kindle-neu-pressed w-full rounded-card border-none bg-transparent px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-sm text-muted" htmlFor="target-unit">
                Unit
              </label>
              <input
                id="target-unit"
                type="text"
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
                placeholder="e.g. litres"
                className="kindle-neu-pressed w-full rounded-card border-none bg-transparent px-4 py-3 text-primary outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <button
            onClick={() => finish('multi_stage', stageCount, targetValue.trim() ? Number(targetValue) : null, targetUnit.trim() || null)}
            disabled={saving}
            className="kindle-neu-raised min-h-[44px] w-full rounded-card bg-accent py-3 font-medium text-ink disabled:opacity-60"
          >
            {saving ? 'Adding…' : 'Add habit'}
          </button>
        </>
      )}
    </KindleSheet>
  )
}
