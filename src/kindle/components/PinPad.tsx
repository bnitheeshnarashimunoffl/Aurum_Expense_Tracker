import { useState } from 'react'
import KindleSheet from './KindleSheet'
import NumericKeypad from './NumericKeypad'

interface PinPadProps {
  open: boolean
  onSubmit: (pin: string) => Promise<boolean>
  onCancel: () => void
}

/** Verifies the existing PIN. Auto-submits at 4 digits; wrong PIN shakes and resets. */
export default function PinPad({ open, onSubmit, onCancel }: PinPadProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  async function handleChange(next: string) {
    setError(false)
    setValue(next)
    if (next.length === 4) {
      setChecking(true)
      const ok = await onSubmit(next)
      setChecking(false)
      if (!ok) {
        setError(true)
        setValue('')
      }
    }
  }

  return (
    <KindleSheet
      open={open}
      onClose={() => {
        setValue('')
        setError(false)
        onCancel()
      }}
      title="Enter PIN"
    >
      <p className="mb-5 text-sm text-muted">{error ? 'Incorrect PIN — try again.' : 'This action needs your Kindle PIN.'}</p>
      <NumericKeypad value={value} onChange={handleChange} error={error} />
      {checking && <p className="mt-4 text-center text-xs text-muted">Checking…</p>}
    </KindleSheet>
  )
}
