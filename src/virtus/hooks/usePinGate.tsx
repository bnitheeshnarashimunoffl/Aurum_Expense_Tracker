import { useRef, useState } from 'react'
import { useVirtusPin } from './useVirtusPin'
import PinPad from '../components/PinPad'
import PinSetupSheet from '../components/PinSetupSheet'

/**
 * One reusable gate for editing a session before today. Call requestGate(onSuccess)
 * at the point the user tries the gated action; render {gate} once per screen.
 *
 * Nothing about "PIN verified" is persisted — each call re-prompts from scratch, the
 * same as Kindle's. The PIN is friction against fixing history by accident, not an
 * authentication boundary; that is Supabase auth + RLS.
 */
export function usePinGate() {
  const { loading, hasPin, setPin, verifyPin } = useVirtusPin()
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
