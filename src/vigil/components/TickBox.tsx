import { motion, useReducedMotion } from 'framer-motion'

interface TickBoxProps {
  checked: boolean
  onToggle: () => void
  label: string
}

/**
 * The leaf check — the only stored completion in the whole tree. The tick draws
 * itself along its own path rather than popping in, because this is the gesture
 * the user repeats most and the one every parent ring reacts to.
 */
export default function TickBox({ checked, onToggle, label }: TickBoxProps) {
  const reduceMotion = useReducedMotion()

  return (
    <button
      type="button"
      onClick={onToggle}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-lg transition-transform active:scale-90 ${
        checked ? 'vigil-neu-pressed-sm' : 'vigil-neu-raised-sm'
      }`}
    >
      <motion.span
        className="absolute h-[26px] w-[26px] rounded-lg"
        style={{ background: 'var(--vigil-gold)' }}
        initial={false}
        animate={{ opacity: checked ? 0.16 : 0 }}
        transition={{ duration: 0.2 }}
        aria-hidden
      />
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
        <motion.path
          d="M4 12.5 L9.5 18 L20 6.5"
          stroke="var(--vigil-gold)"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
    </button>
  )
}
