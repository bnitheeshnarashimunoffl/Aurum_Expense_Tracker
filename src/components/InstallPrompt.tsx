import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { installPromptAvailable, showInstallPrompt, subscribeToInstallPrompt } from '@/lib/installPrompt'
import { isStandalone } from '@/lib/push'

const DISMISS_KEY = 'meridian.installDismissed'

/**
 * Android's half of the install story — the counterpart to IosInstallBanner, and
 * deliberately nothing like it.
 *
 * iOS cannot be installed by the page, so that banner teaches a gesture. Android
 * can, so this is one button and no instructions. Neither is ever shown on the
 * other platform: the iOS banner gates on isIOS(), and this one only exists at
 * all once Chrome has fired beforeinstallprompt, which Safari never does.
 */
export function useInstallAffordance() {
  const [available, setAvailable] = useState(installPromptAvailable)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => subscribeToInstallPrompt(() => setAvailable(installPromptAvailable())), [])

  const dismiss = useCallback(() => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* private mode — it simply comes back next launch */
    }
  }, [])

  const install = useCallback(async () => {
    await showInstallPrompt()
    setAvailable(installPromptAvailable())
  }, [])

  return { available: available && !isStandalone(), dismissed, dismiss, install }
}

function DownloadGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
    </svg>
  )
}

/** The inline row used inside Settings, where it is an option rather than an offer. */
export function InstallRow() {
  const { available, install } = useInstallAffordance()
  if (!available) return null

  return (
    <button
      type="button"
      onClick={() => void install()}
      className="neu-raised flex w-full items-center gap-3 rounded-card px-4 py-3.5 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
    >
      <span className="neu-pressed flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl">
        <DownloadGlyph />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-primary">Install Meridian</span>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">
          Adds it to your home screen and opens it full screen, without the browser bar.
        </span>
      </span>
    </button>
  )
}

/** Routes where an install offer would be an interruption rather than a suggestion. */
const QUIET_ROUTES = ['/login', '/signup', '/forgot-password', '/setup']

export default function InstallPrompt() {
  const { available, dismissed, dismiss, install } = useInstallAffordance()
  const reduceMotion = useReducedMotion()
  const { pathname } = useLocation()

  const quiet = QUIET_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  const visible = available && !dismissed && !quiet

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 320, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        >
          <div
            className="neu-raised flex items-center gap-3 rounded-card px-4 py-3"
            // The same gold hairline the iOS banner and the dashboard cards carry:
            // this is Meridian talking about itself, not a browser nag.
            style={{ boxShadow: '8px 8px 16px rgba(0,0,0,0.55), -6px -6px 14px rgba(255,255,255,0.03), inset 0 1px 0 rgba(201,164,106,0.35)' }}
          >
            <span className="neu-pressed flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl">
              <DownloadGlyph />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-primary">Install Meridian</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-muted">Full screen, and on your home screen.</p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Not now"
              className="min-h-[40px] rounded-full px-2.5 text-[12px] text-muted focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => void install()}
              className="min-h-[40px] flex-shrink-0 rounded-full px-4 text-[12.5px] font-semibold text-ink transition-transform active:scale-[0.97] focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              style={{ background: 'var(--accent)' }}
            >
              Install
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
