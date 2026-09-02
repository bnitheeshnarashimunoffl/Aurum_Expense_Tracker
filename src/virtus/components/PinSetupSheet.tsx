import { useState } from 'react'
import VirtusSheet from './VirtusSheet'
import VirtusKeypad from './VirtusKeypad'

interface PinSetupSheetProps {
  open: boolean
  onComplete: (pin: string) => Promise<void>
  onCancel: () => void
}

/** First-time PIN creation: enter 4 digits, then confirm them, before saving. */
export default function PinSetupSheet({ open, onComplete, onCancel }: PinSetupSheetProps) {
  const [stage, setStage] = useState<'create' | 'confirm'>('create')
  const [firstPin, setFirstPin] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)

  function reset() {
    setStage('create')
    setFirstPin('')
    setValue('')
    setError(false)
  }

  async function handleChange(next: string) {
    setError(false)
    setValue(next)
    if (next.length !== 4) return

    if (stage === 'create') {
      setFirstPin(next)
      setValue('')
      setStage('confirm')
      return
    }

    if (next === firstPin) {
      setSaving(true)
      await onComplete(next)
      setSaving(false)
      reset()
      return
    }
    setError(true)
    setValue('')
    setStage('create')
    setFirstPin('')
  }

  return (
    <VirtusSheet
      open={open}
      onClose={() => {
        reset()
        onCancel()
      }}
      title="Set your Virtus PIN"
    >
      <p className="mb-5 text-sm text-inkSoft">
        {error
          ? "Those didn't match — set a 4-digit PIN again."
          : stage === 'create'
            ? 'Choose a 4-digit PIN. It gates edits to workouts before today.'
            : 'Enter it once more to confirm.'}
      </p>
      <VirtusKeypad value={value} onChange={handleChange} error={error} />
      {saving && <p className="mt-4 text-center text-xs text-inkSoft">Saving…</p>}
    </VirtusSheet>
  )
}
