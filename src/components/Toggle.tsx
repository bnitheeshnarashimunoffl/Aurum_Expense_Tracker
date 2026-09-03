import { motion, useReducedMotion } from 'framer-motion'

interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
  /** Rendered under the label — say what the setting actually does, in plain words. */
  detail?: string
  /** A short prefix in the module's own colour, e.g. "Kindle". */
  eyebrow?: string
  eyebrowColor?: string
  busy?: boolean
}

/**
 * Meridian's switch. Built as a pressed track with a raised knob rather than a
 * pill that changes colour, because that is what every other control in this app
 * does — the neumorphic language is "things sit in or on the surface", and a flat
 * coloured pill would be the one control that ignored it.
 *
 * The whole row is the target, which on a phone is the difference between a
 * setting you can flick and one you have to aim at.
 */
export default function Toggle({ checked, onChange, disabled, label, detail, eyebrow, eyebrowColor, busy }: ToggleProps) {
  const reduceMotion = useReducedMotion()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={eyebrow ? `${eyebrow} — ${label}` : label}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className="neu-raised flex w-full items-center gap-3 rounded-card px-4 py-3 text-left transition-opacity focus:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-45"
    >
      <span className="min-w-0 flex-1">
        {eyebrow && (
          <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: eyebrowColor ?? 'var(--accent)' }}>
            {eyebrow}
          </span>
        )}
        <span className="block text-[14px] font-medium text-primary">{label}</span>
        {detail && <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{detail}</span>}
      </span>

      <span
        aria-hidden
        className="neu-pressed relative flex h-[26px] w-[46px] flex-shrink-0 items-center rounded-full px-[3px]"
        style={checked ? { background: 'color-mix(in srgb, var(--accent) 26%, var(--bg-surface))' } : undefined}
      >
        <motion.span
          className="block h-5 w-5 rounded-full"
          style={{
            background: checked ? 'var(--accent)' : 'var(--text-muted)',
            boxShadow: '2px 2px 5px rgba(0,0,0,0.5), -1px -1px 3px rgba(255,255,255,0.08)',
          }}
          animate={{ x: checked ? 20 : 0, opacity: busy ? 0.5 : 1 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34 }}
        />
      </span>
    </button>
  )
}
