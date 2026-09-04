import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { isIOS, isStandalone } from '@/lib/push'

const DISMISS_KEY = 'meridian.iosInstallDismissed'

/**
 * Whether this device is iOS running in a Safari tab rather than from the Home
 * Screen.
 *
 * WHAT THIS BANNER IS ABOUT NOW. It used to be a notifications banner: Safari has
 * supported Web Push since 16.4, but only for an installed PWA, so in a tab the
 * APIs are simply absent and permission can never be granted. Since notifications
 * are not available to shared instances at all, that is no longer the reason most
 * people are seeing it — and a banner that promises notifications to someone who
 * will not get them is worse than no banner.
 *
 * It stays, because installing is worth doing on its own merits: full screen with
 * no Safari chrome eating the top and bottom of every module, a real icon, proper
 * safe-area handling, and a tab iOS cannot quietly evict. The copy now says that
 * instead. The notifications sentence is still available behind `reason`, for the
 * one place it is still true — the owner's Settings screen, where this is the
 * explanation for a toggle that cannot be turned on.
 */
export function useIosInstallGate() {
  const needed = isIOS() && !isStandalone()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* private mode — the banner just comes back next launch, which is fine */
    }
  }, [])

  const resurface = useCallback(() => {
    setDismissed(false)
    try {
      localStorage.removeItem(DISMISS_KEY)
    } catch {
      /* nothing to clear */
    }
  }, [])

  return { needed, dismissed, visible: needed && !dismissed, dismiss, resurface }
}

/** The iOS Share glyph, drawn rather than described — it is the thing to look for. */
function ShareGlyph() {
  return (
    <svg width="17" height="20" viewBox="0 0 17 20" fill="none" aria-hidden>
      <path d="M8.5 1.5v10" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 5l3.5-3.5L12 5" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3.5 8.5h-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

interface IosInstallBannerProps {
  /**
   * `floating` pins it above the launcher's horizon; `inline` sits in the flow of
   * the settings screen, where it is the explanation for a toggle that cannot be
   * turned on rather than an interruption.
   */
  variant?: 'floating' | 'inline'
  /**
   * Why the user is being shown this.
   *
   * `experience` is the default and the honest one for almost everybody: an
   * installed Meridian is simply a better Meridian. `notifications` is only used
   * where push is genuinely available and genuinely blocked by not being
   * installed — which since the public release means the owner's account alone.
   */
  reason?: 'experience' | 'notifications'
  onDismiss?: () => void
}

/**
 * The instructions, as three short steps with the Share glyph inline so the eye
 * can match it against the real toolbar. Deliberately not an alert(): this is a
 * three-tap fix, and a system dialog would make it read like an error.
 */
export default function IosInstallBanner({ variant = 'inline', reason = 'experience', onDismiss }: IosInstallBannerProps) {
  const reduceMotion = useReducedMotion()
  const lede =
    reason === 'notifications'
      ? 'On iPhone and iPad, notifications only reach an installed app — never a Safari tab. Three taps:'
      : 'Meridian opens full screen with its own icon, instead of inside Safari. Three taps:'
  const closer =
    reason === 'notifications'
      ? 'Then open Meridian from the new icon and turn notifications on there.'
      : 'Everything stays exactly where it is — same account, same data, more screen.'

  const body = (
    <div
      className="neu-raised rounded-card px-4 py-3.5"
      // A gold hairline along the top edge, the same signal the launcher's horizon
      // uses — this is Meridian talking about itself, not an error state.
      style={{ boxShadow: '8px 8px 16px rgba(0,0,0,0.55), -6px -6px 14px rgba(255,255,255,0.03), inset 0 1px 0 rgba(201,164,106,0.35)' }}
    >
      <div className="flex items-start gap-3">
        <span className="neu-pressed mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl">
          <ShareGlyph />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold text-primary">Add Meridian to your Home Screen</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{lede}</p>
          <ol className="mt-2.5 space-y-1.5 text-[12.5px] text-primary">
            {[
              <>
                Open this page in <span className="text-accent">Safari</span>
              </>,
              <>
                Tap <span className="inline-flex translate-y-[3px] px-0.5"><ShareGlyph /></span> Share
              </>,
              <>
                Choose <span className="text-accent">Add to Home Screen</span>
              </>,
            ].map((step, i) => (
              <li key={i} className="flex items-baseline gap-2.5">
                <span className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums text-ink" style={{ background: 'var(--accent)' }}>
                  {i + 1}
                </span>
                <span className="leading-[18px]">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2.5 text-[11.5px] text-muted">{closer}</p>
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-3 min-h-[36px] w-full rounded-full text-[12px] font-medium text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          Not now — you can find this again in Settings
        </button>
      )}
    </div>
  )

  if (variant === 'inline') return body

  return (
    <AnimatePresence>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 16 }}
        transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 320, damping: 30 }}
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        {body}
      </motion.div>
    </AnimatePresence>
  )
}
