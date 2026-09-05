import { useId, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * A password input with a reveal toggle, for the login and signup screens.
 *
 * Deliberately NOT used for the PIN pads — Kindle's history, Virtus, Chronicle's
 * Secret Notes. Those are entered in a room where somebody else may be looking,
 * which is the entire reason they exist; a reveal button on one of them would be
 * a hole in the only thing they do. This is for the sign-in screen, where the
 * failure mode is the opposite: a mistyped password nobody can see, on a phone
 * keyboard, with no way to check it.
 */

/**
 * Eye, and eye-with-a-slash, drawn in the same stroke language as every other
 * icon in the shell (1.7px, round caps) rather than dropped in from an icon set.
 *
 * The slash draws itself on and wipes itself off with `pathLength`, which is what
 * makes this feel like one icon changing state instead of two icons swapping.
 * The wider line underneath it is the surface colour: it cuts a channel through
 * the eye so the slash stays legible where the two cross.
 */
function EyeIcon({ off, tone }: { off: boolean; tone: string }) {
  const reduceMotion = useReducedMotion()
  const draw = {
    initial: false as const,
    animate: { pathLength: off ? 1 : 0, opacity: off ? 1 : 0 },
    transition: reduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 360, damping: 32 },
  }

  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke={tone}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: 'stroke 200ms ease' }}
      aria-hidden
      focusable="false"
    >
      <path d="M2.6 12S6.2 5.8 12 5.8 21.4 12 21.4 12 17.8 18.2 12 18.2 2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="3.1" />
      <motion.line x1="4.4" y1="19.6" x2="19.6" y2="4.4" stroke="var(--bg-surface)" strokeWidth="3.6" {...draw} />
      <motion.line x1="4.4" y1="19.6" x2="19.6" y2="4.4" {...draw} />
    </svg>
  )
}

interface PasswordFieldProps {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  /** `current-password` on sign-in, `new-password` on sign-up. Never dropped. */
  autoComplete: 'current-password' | 'new-password'
  required?: boolean
  minLength?: number
}

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  required = true,
  minLength,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const hintId = useId()

  return (
    <div>
      <label className="mb-1.5 block text-sm text-muted" htmlFor={id}>
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          // The only thing the toggle changes. `autoComplete` stays put across
          // both states, so password managers keep recognising the field.
          type={visible ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          // Revealing turns the field into ordinary text, and a phone will then
          // happily capitalise the first letter of a password and underline the
          // rest in red. These three are what stop it.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="neu-pressed w-full rounded-card border-none bg-surface py-3 pl-4 pr-14 text-primary outline-none focus:ring-1 focus:ring-accent"
        />

        <button
          type="button"
          onClick={() => setVisible((previous) => !previous)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          aria-describedby={hintId}
          // A raised control sitting in a pressed well — the same relationship
          // every other neumorphic pairing in the app uses.
          //
          // 40px keeps it inside the 48px field; the `after` pseudo-element is an
          // invisible 48px ring around it, so the tap target clears the guideline
          // without the button itself having to fill the input.
          className="neu-raised absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full after:absolute after:-inset-1 after:content-[''] focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <EyeIcon off={visible} tone={visible ? 'var(--accent)' : 'var(--text-muted)'} />
        </button>
      </div>

      {/* Announced on focus rather than drawn on screen: sighted users can see
          the state of their own password, and a permanent line of help text
          under every password field is clutter on the first screen of the app. */}
      <span id={hintId} className="sr-only">
        {visible ? 'Password is visible on screen.' : 'Password is hidden.'}
      </span>
    </div>
  )
}
