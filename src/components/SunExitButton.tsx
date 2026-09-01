import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

const HORIZON_Y = 24
const SUN_UP_Y = 15
const SUN_DOWN_Y = 34

/**
 * Fixed top-right exit gesture for every screen inside a module. Replaces a plain
 * back button entirely — tapping it sets the sun behind the horizon, then returns
 * to the Meridian launcher. Kept well under 500ms so it stays comfortable as the
 * primary, constantly-used way out of a module.
 */
export default function SunExitButton() {
  const navigate = useNavigate()
  const prefersReducedMotion = useReducedMotion()
  const [exiting, setExiting] = useState(false)

  function handleExit() {
    if (exiting) return
    setExiting(true)
    if (prefersReducedMotion) {
      navigate('/')
    }
  }

  return (
    <button
      type="button"
      onClick={handleExit}
      disabled={exiting}
      aria-label="Exit to Meridian"
      className="neu-raised fixed right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-80"
      style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
    >
      <svg width="26" height="26" viewBox="0 0 40 40" aria-hidden>
        <clipPath id="sun-exit-sky">
          <rect x="0" y="0" width="40" height={HORIZON_Y} />
        </clipPath>
        <line x1="6" y1={HORIZON_Y} x2="34" y2={HORIZON_Y} stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
        <g clipPath="url(#sun-exit-sky)">
          <motion.circle
            cx="20"
            r="6.5"
            fill="var(--accent)"
            initial={false}
            animate={{ cy: exiting ? SUN_DOWN_Y : SUN_UP_Y, opacity: exiting ? 0 : 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.36, ease: [0.4, 0, 0.2, 1] }}
            onAnimationComplete={() => {
              if (exiting) navigate('/')
            }}
          />
        </g>
      </svg>
    </button>
  )
}
