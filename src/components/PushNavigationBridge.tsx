import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Completes the deep link from a tapped notification.
 *
 * The service worker prefers to focus an already-open Meridian rather than
 * opening a second window (see public/push-sw.js). Some browsers — iOS in
 * particular — then refuse `client.navigate()` on that focused window, so the
 * worker falls back to posting a message. This is what receives it, and it routes
 * through React Router so the jump lands on the right screen without a full
 * reload throwing away the session and the module state.
 */
export default function PushNavigationBridge() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; url?: string } | null
      if (data?.type !== 'meridian:navigate' || typeof data.url !== 'string') return
      // Only ever an in-app path — never trust a message into an origin change.
      //
      // A single leading slash is not enough on its own: "//evil.example" and
      // "/\evil.example" are protocol-relative URLs that leave the origin while
      // still passing a naive startsWith('/'). That is the exact shape of the
      // open redirect React Router itself was patched for. The payload here is
      // written by Meridian's own dispatcher, so this is defence in depth rather
      // than a live hole — but it costs one line.
      if (!/^\/(?![/\\])/.test(data.url)) return
      navigate(data.url)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  return null
}
