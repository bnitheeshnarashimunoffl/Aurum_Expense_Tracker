import { useCallback, useEffect, useId, useLayoutEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { TITLE_FONT, TONES } from './tones'
import type { ModuleKey, WalkthroughStep } from './types'

/**
 * Meridian's walkthrough: a spotlight cut out of a scrim over the REAL screen,
 * with a card that speaks in that module's own material.
 *
 * Two decisions shape everything here.
 *
 * First, it highlights live UI rather than showing pictures of it. A stack of
 * static slides teaches nothing, because the thing being described is not the
 * thing on screen; a cutout over the actual habit grid means the sentence and its
 * subject are in the same glance.
 *
 * Second, the overlay swallows taps. The cutout is visible but inert. Letting
 * someone interact mid-tour sounds generous and in practice loses them inside a
 * modal with a walkthrough still running behind it.
 */

/** Breathing room around the highlighted element, in px. */
const PAD = 8
const GAP = 16

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface WalkthroughProps {
  module: ModuleKey
  steps: WalkthroughStep[]
  open: boolean
  onFinish: () => void
  onSkip: () => void
}

/* -------------------------------------------------------------------------- */
/* Progress — a sun crossing a horizon                                         */
/* -------------------------------------------------------------------------- */

/**
 * The same motif as the exit gesture and the launcher's horizon line, used as a
 * progress bar: the sun rises out of the left horizon on the first step and sets
 * into the right one on the last. Dots would have said the same thing; this says
 * it in Meridian's own language.
 */
function SunProgress({ index, total, accent, muted }: { index: number; total: number; accent: string; muted: string }) {
  const t = total <= 1 ? 1 : index / (total - 1)
  const x = 8 + 47 - 47 * Math.cos(Math.PI * t)
  const y = 20 - 14 * Math.sin(Math.PI * t)

  return (
    <svg width="110" height="27" viewBox="0 0 110 27" fill="none" role="img" aria-label={`Step ${index + 1} of ${total}`}>
      {/* The arc the sun travels, drawn faintly so the journey is legible at a glance. */}
      <path d="M8 20 A 47 14 0 0 1 102 20" stroke={muted} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" fill="none" />
      <line x1="2" y1="20" x2="108" y2="20" stroke={accent} strokeWidth="1" opacity="0.45" strokeLinecap="round" />
      <circle cx={x} cy={y} r="8" fill={accent} opacity="0.18" />
      <circle cx={x} cy={y} r="4.2" fill={accent} />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */

export default function Walkthrough({ module, steps, open, onFinish, onSkip }: WalkthroughProps) {
  const tone = TONES[module]
  const titleFont = TITLE_FONT[module] ?? 'font-display'
  const reduceMotion = useReducedMotion()
  const maskId = useId().replace(/:/g, '')

  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  // The card's own height, so its position can be clamped into the viewport
  // rather than trusting that there is room where it wants to go.
  const [cardHeight, setCardHeight] = useState(180)

  /**
   * A stable ref callback, so React only invokes it when the card element itself
   * mounts (which is once per step, since the card is keyed by index). An inline
   * arrow here would be a new function every render, React would detach and
   * reattach it each time, and the setState inside would loop forever.
   */
  const measureCard = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const height = node.offsetHeight
    setCardHeight((previous) => (Math.abs(previous - height) > 1 ? height : previous))
  }, [])

  const step = steps[index]
  const isLast = index === steps.length - 1

  // Restart from the beginning each time it opens, so a replay is a replay.
  useEffect(() => {
    if (open) setIndex(0)
  }, [open])

  /** Locates the current step's anchor and remembers where it sits on screen. */
  const measure = useCallback(() => {
    setViewport({ width: window.innerWidth, height: window.innerHeight })
    if (!step?.anchor) {
      setRect(null)
      return
    }
    const element = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`)
    if (!element) {
      // A step whose anchor is not on screen (an empty state hid it, say) degrades
      // to a centred card rather than pointing at the top-left corner.
      setRect(null)
      return
    }
    const box = element.getBoundingClientRect()
    setRect({
      x: Math.max(4, box.left - PAD),
      y: Math.max(4, box.top - PAD),
      width: Math.min(window.innerWidth - 8, box.width + PAD * 2),
      height: box.height + PAD * 2,
    })
  }, [step])

  useLayoutEffect(() => {
    if (!open) return
    const element = step?.anchor ? document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`) : null
    if (element) {
      element.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
    }
    // Measure once immediately so nothing flashes, then again after the smooth
    // scroll has settled.
    measure()
    const settle = window.setTimeout(measure, reduceMotion ? 30 : 420)
    return () => window.clearTimeout(settle)
  }, [open, step, measure, reduceMotion])

  useEffect(() => {
    if (!open) return
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, measure])

  // The page behind must not scroll while a spotlight is pinned to a fixed
  // coordinate on it.
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  const advance = useCallback(() => {
    if (isLast) onFinish()
    else setIndex((i) => i + 1)
  }, [isLast, onFinish])

  // Escape skips rather than being ignored. Never trap someone in a tour.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip()
      if (event.key === 'ArrowRight' || event.key === 'Enter') advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onSkip, advance])

  if (!open || !step) return null

  /**
   * Where the card goes.
   *
   * Naively "below the cutout, or above it if the cutout is low down" breaks on
   * the tall anchors — Meridian's stack of four summary cards is half the screen,
   * and both gaps around it are barely taller than the card itself. So: pick the
   * side with more room, then clamp the result into the viewport using the card's
   * measured height. Worst case the card overlaps the edge of the spotlight,
   * which still reads correctly; a card hanging off the screen does not.
   */
  const spaceAbove = rect ? rect.y - GAP : 0
  const spaceBelow = rect ? viewport.height - (rect.y + rect.height) - GAP : 0
  const placeAbove =
    step.place === 'above' || (step.place !== 'below' && rect !== null && spaceAbove > spaceBelow)

  let cardPosition: React.CSSProperties
  if (!rect) {
    cardPosition = { top: '50%', transform: 'translateY(-50%)' }
  } else {
    const desiredTop = placeAbove ? rect.y - GAP - cardHeight : rect.y + rect.height + GAP
    const maxTop = Math.max(8, viewport.height - cardHeight - 8)
    cardPosition = { top: Math.min(Math.max(8, desiredTop), maxTop) }
  }

  const radius = step.radius ?? 16

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={`${module} walkthrough`}>
      {/* The scrim, with the spotlight punched out of it. One SVG rather than four
          positioned divs, so the cutout can have real rounded corners and can
          animate from one target to the next as a single shape. */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            {rect && (
              <motion.rect
                initial={false}
                // attrX/attrY, not x/y: Framer Motion reads `x` and `y` as
                // transform shortcuts, so animating them here would translate the
                // rect instead of moving the SVG geometry the mask is cut from.
                animate={{ attrX: rect.x, attrY: rect.y, width: rect.width, height: rect.height }}
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34 }}
                rx={radius}
                fill="#000"
              />
            )}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill={tone.scrim} mask={`url(#${maskId})`} />
        {rect && (
          <motion.rect
            initial={false}
            animate={{ attrX: rect.x, attrY: rect.y, width: rect.width, height: rect.height }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34 }}
            rx={radius}
            fill="none"
            stroke={tone.accent}
            strokeWidth="1.5"
            opacity="0.9"
          />
        )}
      </svg>

      {/* Taps land here and go no further — the UI underneath is on show, not in play. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      <div className="pointer-events-none absolute inset-x-0 mx-auto max-w-lg px-4" style={cardPosition}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={reduceMotion ? false : { opacity: 0, y: placeAbove ? 10 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: placeAbove ? -6 : 6 }}
            transition={reduceMotion ? { duration: 0.1 } : { type: 'spring', stiffness: 420, damping: 34 }}
            ref={measureCard}
            className={`${tone.surface} pointer-events-auto rounded-card px-5 py-4`}
            style={{ color: tone.text }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <SunProgress index={index} total={steps.length} accent={tone.accent} muted={tone.muted} />
              {/* Every text tone below is the module's own ink stepped back with
                  opacity, rather than its "muted" token. On Loom in particular
                  --loom-muted sits at 4.32 on the card surface, which is under AA
                  for body copy; the ink at 88% clears it everywhere. */}
              <span className="text-[11px] tabular-nums" style={{ color: tone.text, opacity: 0.6 }}>
                {index + 1} / {steps.length}
              </span>
            </div>

            <h2 className={`${titleFont} text-[17px] font-semibold leading-snug`} style={{ color: tone.text }}>
              {step.title}
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: tone.text, opacity: 0.88 }}>
              {step.body}
            </p>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={onSkip}
                className="min-h-[42px] rounded-full px-3 text-[13px] font-medium focus:outline-none focus-visible:ring-2"
                style={{ color: tone.text, opacity: 0.7, ['--tw-ring-color' as string]: tone.accent }}
              >
                {isLast ? 'Close' : 'Skip'}
              </button>
              <div className="flex-1" />
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => setIndex((i) => i - 1)}
                  className="min-h-[42px] rounded-full px-3 text-[13px] font-medium focus:outline-none focus-visible:ring-2"
                  style={{ color: tone.text, opacity: 0.7, ['--tw-ring-color' as string]: tone.accent }}
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={advance}
                className="min-h-[42px] rounded-full px-5 text-[13.5px] font-semibold transition-transform active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  background: tone.action,
                  color: tone.actionInk,
                  ['--tw-ring-color' as string]: tone.accent,
                  ['--tw-ring-offset-color' as string]: tone.offset,
                }}
              >
                {isLast ? 'Start using it' : 'Next'}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
