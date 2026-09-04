/**
 * Android's install prompt, caught and held.
 *
 * The two platforms are opposites here and the app has to know it.
 *
 * On iOS there is no prompt at all: installing is a Share-sheet gesture Safari
 * offers and the page cannot trigger, which is why IosInstallBanner exists and
 * why it is three drawn steps rather than a button.
 *
 * On Android, Chrome (and Edge, and Samsung Internet) fire `beforeinstallprompt`
 * and let the page install itself with one tap — but ONLY if the page cancels the
 * event and keeps it. Let it through and the browser shows its own mini-infobar,
 * once, on its own schedule, and the chance is gone. So it is captured here at
 * module scope, before React has mounted: the event can arrive during the first
 * paint, and a listener added inside a component effect is routinely too late.
 *
 * The stored event is single-use. Once prompt() has been called, Chrome will not
 * hand it back, so it is cleared and the affordance disappears rather than
 * offering a button that does nothing the second time.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferred = event as BeforeInstallPromptEvent
    emit()
  })

  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
}

export function installPromptAvailable(): boolean {
  return deferred !== null && !installed
}

export function subscribeToInstallPrompt(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Shows the browser's own install sheet. Resolves to whether it was accepted. */
export async function showInstallPrompt(): Promise<boolean> {
  const event = deferred
  if (!event) return false
  // Cleared first, and unconditionally: Chrome refuses a second prompt() on the
  // same event, so keeping it around would leave a dead button on screen.
  deferred = null
  emit()
  try {
    await event.prompt()
    const { outcome } = await event.userChoice
    return outcome === 'accepted'
  } catch {
    return false
  }
}
