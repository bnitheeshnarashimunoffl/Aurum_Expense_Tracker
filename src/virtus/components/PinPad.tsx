import { useState } from 'react'
import VirtusSheet from './VirtusSheet'
import VirtusKeypad from './VirtusKeypad'

interface PinPadProps {
  open: boolean
  onSubmit: (pin: string) => Promise<boolean>
  onCancel: () => void
}

/** Verifies the existing PIN. Auto-submits at 4 digits; a wrong PIN clears and re-prompts. */
export default function PinPad({ open, onSubmit, onCancel }: PinPadProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  async function handleChange(next: string) {
    setError(false)
    setValue(next)
    if (next.length !== 4) return
    setChecking(true)
    const ok = await onSubmit(next)
    setChecking(false)
    if (!ok) {
      setError(true)
      setValue('')
    }
  }

  return (
    <VirtusSheet
      open={open}
      onClose={() => {
        setValue('')
        setError(false)
        onCancel()
      }}
      title="Enter PIN"
    >
      <p className="mb-5 text-sm text-inkSoft">
        {error ? 'Incorrect PIN — try again.' : 'Editing a past workout needs your Virtus PIN.'}
      </p>
      <VirtusKeypad value={value} onChange={handleChange} error={error} />
      {checking && <p className="mt-4 text-center text-xs text-inkSoft">Checking…</p>}
    </VirtusSheet>
  )
}
