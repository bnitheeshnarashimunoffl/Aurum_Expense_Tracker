import { useState, type CSSProperties } from 'react'
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
/**
 * The tone picks the module's own neumorphic pair and accent, so the button sits
 * on that module's surface instead of borrowing Aurum's. `light` is for modules
 * on a light ground (Vigil), where Aurum's near-black button would read as a dark
 * blot on cream; `loom` is Loom's gunmetal, `virtus` its marble, and `chronicle`
 * its charcoal — which needs its own tone rather than reusing `dark`, because
 * Chronicle is the one dark module with a true neumorphic highlight.
 */
interface SunExitButtonProps {
  tone?: 'dark' | 'light' | 'loom' | 'virtus' | 'chronicle'
}

export default function SunExitButton({ tone = 'dark' }: SunExitButtonProps) {
  const navigate = useNavigate()
  const prefersReducedMotion = useReducedMotion()
  const [exiting, setExiting] = useState(false)
  const surfaceClass =
    tone === 'light'
      ? 'vigil-neu-raised-sm'
      : tone === 'loom'
        ? 'loom-neu-raised-sm'
        : tone === 'virtus'
          ? 'virtus-neu-raised-sm'
          : tone === 'chronicle'
            ? 'chr-neu-raised-sm'
            : 'neu-raised'
  const sunColor =
    tone === 'light'
      ? 'var(--vigil-gold)'
      : tone === 'loom'
        ? 'var(--loom-gold)'
        : tone === 'virtus'
          ? 'var(--bronze-primary)'
          : tone === 'chronicle'
            ? 'var(--gold-primary)'
            : 'var(--accent)'
  // The ring sits on the module's own page colour, so the gap between button and ring
  // reads as a gap rather than as a second stroke.
  const offsetColor =
    tone === 'light'
      ? 'var(--vigil-bg-base)'
      : tone === 'loom'
        ? 'var(--loom-bg-base)'
        : tone === 'virtus'
          ? 'var(--marble-base)'
          : tone === 'chronicle'
            ? 'var(--ink-charcoal-bg)'
            : 'var(--bg-base)'

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
      className={`${surfaceClass} fixed right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-80`}
      // The ring colour has to be set as --tw-ring-color, not `color`: Tailwind's ring
      // utilities read that variable, so setting the text colour instead silently
      // leaves the ring at its default blue — which is what it did here at first.
      style={
        {
          top: 'calc(env(safe-area-inset-top) + 1rem)',
          '--tw-ring-color': sunColor,
          '--tw-ring-offset-color': offsetColor,
        } as CSSProperties
      }
    >
      <svg width="26" height="26" viewBox="0 0 40 40" aria-hidden>
        <clipPath id="sun-exit-sky">
          <rect x="0" y="0" width="40" height={HORIZON_Y} />
        </clipPath>
        <line x1="6" y1={HORIZON_Y} x2="34" y2={HORIZON_Y} stroke={sunColor} strokeWidth="1.5" strokeLinecap="round" />
        <g clipPath="url(#sun-exit-sky)">
          <motion.circle
            cx="20"
            r="6.5"
            fill={sunColor}
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
