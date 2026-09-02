import { motion, useReducedMotion } from 'framer-motion'
import type { NodeState } from '../lib/tree'

interface ProgressRingProps {
  ratio: number
  state: NodeState
  done: number
  total: number
  size?: number
  onToggle: () => void
  label: string
}

/**
 * The check control for a branch (subject or category). It is never a plain
 * checkbox because a branch is rarely just on or off — the ring carries the real
 * answer ("4 of 7") continuously, and only closes into a tick at 100%. Tapping it
 * cascades down; the ring itself moves because its children moved, never the
 * other way round.
 */
export default function ProgressRing({ ratio, state, done, total, size = 34, onToggle, label }: ProgressRingProps) {
  const reduceMotion = useReducedMotion()
  const stroke = size <= 28 ? 3 : 3.5
  const radius = (size - stroke) / 2 - 1
  const circumference = 2 * Math.PI * radius
  const complete = state === 'complete'
  const empty = state === 'empty'

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={empty}
      aria-label={
        empty
          ? `${label} — nothing to track yet, add subtopics first`
          : `${label} — ${done} of ${total} complete. ${complete ? 'Uncheck all' : 'Check all'}`
      }
      aria-pressed={complete}
      className={`relative flex flex-shrink-0 items-center justify-center rounded-full transition-transform ${
        empty ? 'cursor-default opacity-45' : 'active:scale-95'
      } ${complete ? 'vigil-neu-pressed-sm' : 'vigil-neu-raised-sm'}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--vigil-line)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--vigil-gold)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 210, damping: 24 }}
        />
      </svg>

      <motion.svg
        width={size * 0.46}
        height={size * 0.46}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--vigil-gold)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative"
        aria-hidden
        initial={false}
        animate={{ opacity: complete ? 1 : 0, scale: complete ? 1 : 0.5 }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 18 }}
      >
        <path d="M4 12.5 L9.5 18 L20 6.5" />
      </motion.svg>
    </button>
  )
}
