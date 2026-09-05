import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { formatClock, formatDuration, formatTarget, isOverflow, overflowSeconds, remainingSeconds, targetFraction } from '../lib/time'

interface StudyTimerProps {
  studied: number
  /** This week's daily target, in seconds. The dial is drawn against it, not against five hours. */
  target: number
  running: boolean
  busy: boolean
  onToggle: () => void
  /** Bumped by the parent the moment the countdown crosses zero, to fire the burst. */
  celebrationKey: number
}

const SIZE = 260
const STROKE = 14
const RADIUS = (SIZE - STROKE * 2 - 16) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Rays for the milestone burst — fixed angles, so it never renders a different shape twice. */
const BURST_RAYS = Array.from({ length: 12 }, (_, i) => (i * 360) / 12)

export default function StudyTimer({ studied, target, running, busy, onToggle, celebrationKey }: StudyTimerProps) {
  const reduceMotion = useReducedMotion()
  const gradientId = useId()
  const overflow = isOverflow(studied, target)
  const bonus = overflowSeconds(studied, target)
  const remaining = remainingSeconds(studied, target)
  const fraction = targetFraction(studied, target)

  // The countdown ring empties as the target is approached; in overflow it is full
  // and a second ring winds around it to carry the bonus instead.
  const dashOffset = CIRCUMFERENCE * fraction
  const bonusFraction = overflow ? Math.min(1, (bonus % 3600) / 3600) : 0

  const [burst, setBurst] = useState(0)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setBurst((b) => b + 1)
  }, [celebrationKey])

  return (
    <section className="flex flex-col items-center" aria-label="Daily study timer">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* Recessed well the dial sits in — the same pressed pair as every other
            inset surface in the module, so the depth reads consistently. */}
        <div className="vigil-neu-pressed absolute inset-0 rounded-full" aria-hidden />

        {/* Milestone burst: rays fly outward once, at the instant of crossing. */}
        <AnimatePresence>
          {burst > 0 && !reduceMotion && (
            <motion.svg
              key={burst}
              className="pointer-events-none absolute inset-0 z-20"
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.5, delay: 0.35 }}
              aria-hidden
            >
              {BURST_RAYS.map((angle) => (
                <motion.line
                  key={angle}
                  x1={SIZE / 2}
                  y1={SIZE / 2}
                  x2={SIZE / 2}
                  y2={SIZE / 2 - RADIUS}
                  stroke="var(--vigil-gold)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  transform={`rotate(${angle} ${SIZE / 2} ${SIZE / 2})`}
                  initial={{ pathLength: 0.02, opacity: 0.9 }}
                  animate={{ pathLength: 0.34, opacity: 0 }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                  style={{ transformOrigin: `${SIZE / 2}px ${SIZE / 2}px` }}
                />
              ))}
              <motion.circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="var(--vigil-gold)"
                strokeWidth="3"
                initial={{ scale: 1, opacity: 0.85 }}
                animate={{ scale: 1.16, opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                style={{ transformOrigin: `${SIZE / 2}px ${SIZE / 2}px` }}
              />
            </motion.svg>
          )}
        </AnimatePresence>

        <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--vigil-gold-soft)" />
              <stop offset="100%" stopColor="var(--vigil-gold)" />
            </linearGradient>
          </defs>

          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--vigil-line)"
            strokeWidth={STROKE}
            opacity={0.55}
          />

          {/* Countdown arc: full at 5:00:00, empty at zero. */}
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={overflow ? 'var(--vigil-bronze)' : `url(#${gradientId})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            animate={{ strokeDashoffset: overflow ? 0 : dashOffset }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 20 }}
            opacity={overflow ? 0.35 : 1}
          />

          {/* Bonus arc: only in overflow, winding one full turn per bonus hour. */}
          {overflow && (
            <motion.circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--vigil-gold)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{ strokeDashoffset: CIRCUMFERENCE * (1 - bonusFraction) }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 20 }}
            />
          )}
        </svg>

        {/* A slow breathing halo while running, so a live timer never looks frozen
            between seconds. Absent when paused — that difference is the tell. */}
        {running && !reduceMotion && (
          <motion.div
            className="pointer-events-none absolute inset-3 rounded-full"
            style={{ boxShadow: `0 0 30px 2px ${overflow ? 'rgba(188,138,63,0.30)' : 'rgba(188,138,63,0.16)'}` }}
            animate={{ opacity: [0.45, 1, 0.45], scale: [0.985, 1, 0.985] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />
        )}

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait" initial={false}>
            {overflow ? (
              <motion.div
                key="overflow"
                className="flex flex-col items-center"
                initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -14, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-vigilGold">Bonus</span>
                <span className="font-display text-[2.6rem] font-bold leading-none tabular-nums text-vigilGold">
                  +{formatClock(bonus)}
                </span>
                <span className="mt-1.5 text-[11px] text-vigilInkSoft">{formatTarget(target)} target met</span>
              </motion.div>
            ) : (
              <motion.div
                key="countdown"
                className="flex flex-col items-center"
                initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -14, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-vigilInkSoft">Remaining</span>
                <span className="font-display text-[2.6rem] font-bold leading-none tabular-nums text-vigilInk">
                  {formatClock(remaining)}
                </span>
                <span className="mt-1.5 text-[11px] tabular-nums text-vigilInkSoft">
                  {formatDuration(studied)} studied
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-label={running ? 'Pause the study timer' : 'Start the study timer'}
        aria-pressed={running}
        className={`mt-7 flex h-[72px] w-[72px] items-center justify-center rounded-full transition-shadow duration-300 disabled:opacity-60 ${
          running ? 'vigil-neu-pressed' : 'vigil-neu-raised'
        }`}
      >
        <motion.svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill={running ? 'var(--vigil-ink)' : 'var(--vigil-gold)'}
          aria-hidden
          animate={reduceMotion ? undefined : { scale: running ? 1 : 1.04 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        >
          {/* Two bars that slide together and taper into a triangle: one control,
              one shape, morphing — rather than two icons swapping places. */}
          <motion.path
            initial={false}
            animate={{ d: running ? 'M6 4 H10 V20 H6 Z' : 'M7 4 L12 7.4 V16.6 L7 20 Z' }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 24 }}
          />
          <motion.path
            initial={false}
            animate={{ d: running ? 'M14 4 H18 V20 H14 Z' : 'M12 7.4 L19 12 L12 16.6 Z' }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 24 }}
          />
        </motion.svg>
      </button>

      <p className="mt-3 h-4 text-[11px] text-vigilInkSoft">
        {running ? 'Counting…' : studied > 0 ? 'Paused' : 'Not started today'}
      </p>
    </section>
  )
}
