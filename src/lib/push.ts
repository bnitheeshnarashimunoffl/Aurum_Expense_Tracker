import { supabase } from '@/lib/supabase'

/**
 * Everything the browser side of Web Push needs, and — just as importantly —
 * everything needed to explain to the user why it is not working.
 *
 * The hard constraint this file is shaped around is iOS. Safari has supported
 * Web Push since 16.4, but ONLY for a PWA that has been added to the Home Screen.
 * In a Safari tab, `Notification` and `PushManager` are undefined, so a naive
 * feature check reports "not supported" — which is true, but useless as an
 * explanation, because the fix is three taps away. Every state below is
 * distinguishable so the UI can say the right sentence instead of failing quietly.
 */

export type PushState =
  /** Web Push cannot work in this browser at all (e.g. a desktop browser without it). */
  | 'unsupported'
  /** iOS, in a Safari tab. Push works here only once the app is on the Home Screen. */
  | 'ios-needs-install'
  /** Supported, but the user has never been asked. */
  | 'prompt'
  /** The user said no. Only they can undo this, in browser/OS settings. */
  | 'denied'
  /** Permission granted, but this device has no push subscription stored yet. */
  | 'granted-unsubscribed'
  /** Fully working on this device. */
  | 'subscribed'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as a Mac; the touch-point count is what separates
  // an iPad from a desktop Safari, and it is the check Apple's own docs suggest.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** True when running as an installed PWA rather than inside a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

function browserSupportsPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** The VAPID public key is required to subscribe at all — say so rather than failing at the API call. */
export function vapidConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PUBLIC_KEY.length > 20)
}

/**
 * `navigator.serviceWorker.ready` never rejects and never times out — if no
 * worker is registered it simply pends forever. That is exactly the situation in
 * `npm run dev`, where vite-plugin-pwa generates no service worker at all, so
 * awaiting it bare would leave the settings screen stuck mid-toggle with no
 * explanation. Racing it turns "nothing here" into a sentence.
 */
async function readyRegistration(timeoutMs = 6000): Promise<ServiceWorkerRegistration> {
  let timer: number | undefined
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_resolve, reject) => {
        timer = window.setTimeout(
          () =>
            reject(
              new PushSetupError(
                'No service worker is running. Notifications need a built app — try `npm run build && npm run preview`, or the deployed site.'
              )
            ),
          timeoutMs
        )
      }),
    ])
  } finally {
    if (timer !== undefined) window.clearTimeout(timer)
  }
}

export async function resolvePushState(): Promise<PushState> {
  if (!browserSupportsPush()) {
    // On iOS the missing APIs are not a dead end, they are an install prompt.
    return isIOS() && !isStandalone() ? 'ios-needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'prompt'

  try {
    const registration = await readyRegistration()
    const existing = await registration.pushManager.getSubscription()
    return existing ? 'subscribed' : 'granted-unsubscribed'
  } catch {
    // Permission is granted but no worker ever appeared. "Not registered yet" is
    // the honest state, and its panel explains how to fix it.
    return 'granted-unsubscribed'
  }
}

/**
 * base64url VAPID key -> the Uint8Array PushManager.subscribe insists on.
 *
 * Backed by an explicit ArrayBuffer rather than the default allocation: lib.dom's
 * BufferSource excludes SharedArrayBuffer-backed views, and `new Uint8Array(n)`
 * widens to ArrayBufferLike, which does not satisfy it.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function keyToBase64url(key: ArrayBuffer | null): string {
  if (!key) return ''
  const bytes = new Uint8Array(key)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export class PushSetupError extends Error {}

/**
 * Asks for permission if needed, subscribes this browser, and stores the
 * subscription against the signed-in user.
 *
 * Throws with a sentence meant to be shown to a person — every failure here is
 * something the user either caused or can fix, and a silent false would leave the
 * settings screen showing a toggle that quietly did nothing.
 */
export async function enablePush(): Promise<void> {
  if (!vapidConfigured()) {
    throw new PushSetupError(
      'VITE_VAPID_PUBLIC_KEY is not set. Run `npm run vapid`, then add it to .env.local and to your deploy environment.'
    )
  }
  if (!browserSupportsPush()) {
    throw new PushSetupError(
      isIOS() && !isStandalone()
        ? 'On iPhone and iPad, notifications only work once Meridian is added to the Home Screen from Safari.'
        : 'This browser does not support push notifications.'
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new PushSetupError(
      permission === 'denied'
        ? 'Notifications are blocked for this site. You will need to allow them again in your browser settings.'
        : 'Notifications were not enabled.'
    )
  }

  const registration = await readyRegistration()
  // Re-subscribing an already-subscribed browser returns the SAME endpoint, which
  // is why the endpoint can be the primary key server-side without duplicates
  // piling up.
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      // Web Push requires this to be true — a silent push with no visible
      // notification is not allowed, and browsers revoke subscriptions that try.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    }))

  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new PushSetupError('Not signed in.')

  const { error } = await supabase.from('meridian_push_subscriptions').upsert(
    {
      endpoint: subscription.endpoint,
      user_id: userData.user.id,
      p256dh: keyToBase64url(subscription.getKey('p256dh')),
      auth: keyToBase64url(subscription.getKey('auth')),
      user_agent: navigator.userAgent.slice(0, 300),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw new PushSetupError(`Could not save this device: ${error.message}`)
}

/**
 * Removes this device's subscription, locally and server-side.
 *
 * Deliberately NOT what the per-module toggles do — those are respected on the
 * server, so turning Kindle off still leaves the device able to receive Loom.
 * This is only for the master switch going off, where the honest thing is to stop
 * holding a push subscription at all.
 */
export async function disablePush(): Promise<void> {
  if (!browserSupportsPush()) return
  // Best-effort teardown: the stored setting has already been turned off by the
  // caller, and that is what the server obeys. If there is no worker to talk to,
  // there is also no subscription to remove, so this is nothing to raise.
  let subscription: PushSubscription | null = null
  try {
    const registration = await readyRegistration()
    subscription = await registration.pushManager.getSubscription()
  } catch {
    return
  }
  if (!subscription) return
  await supabase.from('meridian_push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}

/**
 * Sends one notification to this account's devices, through the push-test Edge
 * Function. The single most useful thing on the settings screen: a notification
 * arriving is proof of the entire chain — subscription stored, VAPID keys valid,
 * service worker awake — and none of that is visible any other way.
 */
export async function sendTestNotification(): Promise<void> {
  // Force a fresh access token before invoking, rather than trusting whatever
  // supabase-js currently has cached. Its background auto-refresh timer only
  // fires while the JS runtime is actually alive — a PWA that spent time
  // backgrounded (screen locked, tab suspended by the OS) can come back with an
  // access token that quietly expired while nothing was running to renew it.
  // functions.invoke() does NOT notice that on its own: it attaches whatever
  // getSession() returns, live-but-expired token included, and that is exactly
  // what a 403 "BadJwtToken" here turned out to mean — not a deploy problem,
  // not a config problem, just a token that aged out while the app was asleep.
  // refreshSession() forces the network round-trip that mints a new one.
  const { error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError) {
    throw new PushSetupError('Your session has expired. Sign out and back in, then try again.')
  }

  const { data, error } = await supabase.functions.invoke('push-test', { body: {} })
  if (error) {
    // FunctionsHttpError carries the function's own JSON body (the sentence
    // push-test/index.ts wrote) on `.context`; anything else is a network- or
    // deploy-level failure.
    const context = (error as { context?: Response }).context
    const detail = context ? await context.json().catch(() => null) : null
    throw new PushSetupError(
      detail?.error ??
        error.message ??
        'Could not reach the push-test function. Deploy it with: supabase functions deploy push-test'
    )
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new PushSetupError(String((data as { error: unknown }).error))
  }
}
