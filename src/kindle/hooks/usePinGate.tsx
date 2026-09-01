import { useRef, useState } from 'react'
import { useKindlePin } from './useKindlePin'
import PinPad from '../components/PinPad'
import PinSetupSheet from '../components/PinSetupSheet'

/**
 * One reusable gate for all three PIN-protected actions (past-day edit, reorder,
 * add/delete habit). Call requestGate(onSuccess) at the point the user tries the
 * gated action; render {gate} once per screen. Nothing about "PIN verified" is
 * persisted anywhere — each call re-prompts from scratch, by design.
 */
export function usePinGate() {
  const { loading, hasPin, setPin, verifyPin } = useKindlePin()
  const [mode, setMode] = useState<'closed' | 'setup' | 'verify'>('closed')
  const pendingSuccess = useRef<(() => void) | null>(null)

  function requestGate(onSuccess: () => void) {
    if (loading) return
    pendingSuccess.current = onSuccess
    setMode(hasPin ? 'verify' : 'setup')
  }

  function close() {
    setMode('closed')
    pendingSuccess.current = null
  }

  async function handleSetupComplete(pin: string) {
    await setPin(pin)
    const fn = pendingSuccess.current
    close()
    fn?.()
  }

  async function handleVerify(pin: string): Promise<boolean> {
    const ok = await verifyPin(pin)
    if (ok) {
      const fn = pendingSuccess.current
      close()
      fn?.()
    }
    return ok
  }

  const gate = (
    <>
      <PinSetupSheet open={mode === 'setup'} onComplete={handleSetupComplete} onCancel={close} />
      <PinPad open={mode === 'verify'} onSubmit={handleVerify} onCancel={close} />
    </>
  )

  return { requestGate, gate }
}
