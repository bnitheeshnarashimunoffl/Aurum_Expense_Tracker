import { useEffect, useRef } from 'react'

/**
 * Makes the device back gesture close a full-screen overlay instead of leaving
 * the module.
 *
 * Chronicle's note editor and detail views are overlays rather than routes, which
 * is a deliberate choice: a route for a note would put its id in the URL, and a
 * secret note must not leave a trace in history for the back button — or the
 * address bar — to hand back after the section re-locks. The cost of that choice
 * is that the back gesture would otherwise skip straight out of Chronicle, so a
 * throwaway history entry is pushed while the overlay is open and popped when it
 * closes.
 */
/**
 * Number of popstate events this hook has caused itself and must therefore ignore.
 *
 * The cleanup below calls history.back() to take its own entry off the stack. That
 * fires a popstate a tick later — by which time this listener is gone, but a guard
 * mounted in the meantime is listening, and would read our tidying-up as the user
 * pressing back and close itself immediately. That is not hypothetical: React
 * double-invokes effects in development, so every overlay did exactly this and shut
 * within a frame of opening. Module-level, because the two guards involved are
 * different instances by definition.
 */
let selfInflictedPops = 0

export function useBackGuard(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack

  useEffect(() => {
    if (!active) return

    // Tagged so the popstate handler only answers for entries this hook pushed.
    window.history.pushState({ chronicleOverlay: true }, '')
    let closedByBack = false

    const handlePop = () => {
      if (selfInflictedPops > 0) {
        selfInflictedPops -= 1
        // Our own entry came back off; re-push so this overlay still has one.
        window.history.pushState({ chronicleOverlay: true }, '')
        return
      }
      closedByBack = true
      onBackRef.current()
    }
    window.addEventListener('popstate', handlePop)

    return () => {
      window.removeEventListener('popstate', handlePop)
      // Closed with the on-screen control rather than the back gesture, so the
      // entry this hook pushed is still on the stack and has to be taken back off —
      // otherwise every open-and-close leaves a dead entry behind and the back
      // gesture starts needing several taps to leave the module.
      if (!closedByBack && window.history.state?.chronicleOverlay) {
        selfInflictedPops += 1
        window.history.back()
      }
    }
  }, [active])
}
