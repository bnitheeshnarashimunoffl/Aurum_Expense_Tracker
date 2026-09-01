import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { resolveStageColor } from '../lib/gradient'
import { stageQuantityLabel, shortHabitLabel } from '../lib/quantity'
import type { Habit } from '../lib/types'

/** Deliberately long — a reset has to be impossible to trigger by fumbling a tap. */
const LONG_PRESS_MS = 600
/** Past this much finger travel the gesture is a scroll, not a press. */
const MOVE_TOLERANCE_PX = 12

interface HabitPillProps {
  habit: Habit
  stage: number
  onOpen: () => void
  onReset: () => void
}

/**
 * One pill per habit, below the read-only grid. Tap opens the logging modal for
 * today; press and hold wipes today's value back to zero. The hold shows a filling
 * track the whole time it's counting down, so it reads as a distinct deliberate
 * gesture rather than a tap that mysteriously did something else.
 */
export default function HabitPill({ habit, stage, onOpen, onReset }: HabitPillProps) {
  const reduceMotion = useReducedMotion()
  const controls = useAnimationControls()
  const timer = useRef<number | null>(null)
  const startPoint = useRef<{ x: number; y: number } | null>(null)
  const firedLongPress = useRef(false)
  const [holding, setHolding] = useState(false)

  useEffect(() => () => cancelTimer(), [])

  function cancelTimer() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    setHolding(false)
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    firedLongPress.current = false
    startPoint.current = { x: e.clientX, y: e.clientY }
    setHolding(true)
    timer.current = window.setTimeout(() => {
      timer.current = null
      firedLongPress.current = true
      setHolding(false)
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(35)
      if (!reduceMotion) controls.start({ x: [0, -7, 7, -5, 5, 0], transition: { duration: 0.36, ease: 'easeInOut' } })
      onReset()
    }, LONG_PRESS_MS)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (timer.current === null || !startPoint.current) return
    const dx = e.clientX - startPoint.current.x
    const dy = e.clientY - startPoint.current.y
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) cancelTimer()
  }

  function handleClick() {
    // The pointerup that ends a completed long-press still produces a click; swallow
    // exactly that one so a reset never also opens the modal.
    if (firedLongPress.current) {
      firedLongPress.current = false
      return
    }
    onOpen()
  }

  const color = resolveStageColor(habit, stage)
  const fraction = habit.max_stage > 0 ? Math.min(1, stage / habit.max_stage) : 0
  const valueLabel =
    stage <= 0 ? '—' : habit.type === 'binary' ? 'Done' : stageQuantityLabel(habit, stage)

  return (
    <motion.button
      type="button"
      animate={controls}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelTimer}
      onPointerCancel={cancelTimer}
      onPointerLeave={cancelTimer}
      onContextMenu={(e) => e.preventDefault()}
      onClick={handleClick}
      aria-label={`${shortHabitLabel(habit.label)} — ${stage <= 0 ? 'nothing logged today' : valueLabel}. Tap to log, press and hold to reset.`}
      className={`relative min-h-[60px] w-full select-none overflow-hidden rounded-card px-4 text-left ${
        stage > 0 ? 'kindle-neu-pressed' : 'kindle-neu-raised'
      }`}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Progress wash: the pill itself carries today's state, so the grid above is never the only readout. */}
      {color && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-300"
          style={{ width: `${fraction * 100}%`, background: `color-mix(in srgb, ${color} 44%, transparent)` }}
        />
      )}

      {/* Hold track — fills over LONG_PRESS_MS so the reset gesture announces itself. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-[3px]"
        style={{ background: 'var(--accent)' }}
        initial={{ width: '0%' }}
        animate={{ width: holding ? '100%' : '0%' }}
        transition={holding ? { duration: LONG_PRESS_MS / 1000, ease: 'linear' } : { duration: 0.12 }}
      />

      <span className="relative flex min-h-[60px] items-center justify-between gap-3 py-3">
        <span className="truncate text-sm font-medium text-primary">{shortHabitLabel(habit.label)}</span>
        <span className="flex flex-shrink-0 items-center gap-2">
          <span className="text-xs tabular-nums text-muted">{valueLabel}</span>
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: color ?? 'var(--kindle-bg-base)', boxShadow: 'inset 0 0 0 1px rgba(140,150,220,0.18)' }}
          />
        </span>
      </span>
    </motion.button>
  )
}
