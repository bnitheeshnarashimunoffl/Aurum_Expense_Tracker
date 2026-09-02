import { motion, useReducedMotion } from 'framer-motion'
import { VOLUME_RAMP, onStep, type CellState } from '../lib/volume'

/**
 * How much of the well a day's column fills. This is the SECOND encoding of the
 * same number the colour carries, and it is not decoration:
 *
 *  - the ramp's contrast against marble sits below 3:1 at the light end, which the
 *    palette rules allow only with a relief channel, and
 *  - red/green is exactly the axis a colourblind reader loses.
 *
 * Height survives both. Anchored so an average day sits a little under two thirds
 * of the way up, leaving visible room above for a day that beat it.
 */
export function fillFraction(ratio: number): number {
  return Math.min(1, Math.max(0.22, 0.22 + (ratio - 0.5) * 0.78))
}

export function stateFill(state: CellState): { color: string; ink: string; fraction: number } | null {
  switch (state.kind) {
    case 'empty':
      return null
    case 'rest':
      // A low, flat band: rest is a real record, but it is not work done.
      return { color: 'var(--virtus-rest)', ink: 'var(--ink-charcoal)', fraction: 0.16 }
    case 'logged-no-baseline':
      // Nothing to rank it against yet, so it takes the ramp's middle bronze at a
      // middling height rather than being given a rank it hasn't earned.
      return { color: 'var(--bronze-primary)', ink: 'var(--marble-base)', fraction: 0.55 }
    case 'ranked':
      return { color: VOLUME_RAMP[state.step], ink: onStep(state.step), fraction: fillFraction(state.ratio) }
  }
}

interface VolumeColumnProps {
  state: CellState
  /** Rendered at the top of the well — the day number. */
  label: string
  today?: boolean
  future?: boolean
  onClick?: () => void
  ariaLabel: string
  /** Stagger index, so the week rises left to right on first paint. */
  order?: number
}

/**
 * One day of the week, drawn as a column standing in a well cut into the marble.
 *
 * The metaphor is the whole point of the screen: an untrained day is a plain recess
 * in the stone, and the work you did stands up out of it. A heavy week reads as a
 * dense, dark colonnade at a glance, before any number is read — which is the job
 * the grid has to do, since it is the first thing seen every time the module opens.
 */
export default function VolumeColumn({ state, label, today, future, onClick, ariaLabel, order = 0 }: VolumeColumnProps) {
  const reduceMotion = useReducedMotion()
  const fill = stateFill(state)
  const interactive = Boolean(onClick)

  const body = (
    <>
      {/* The well itself. Empty days are nothing but this. */}
      <span
        className={`virtus-well absolute inset-0 rounded-[13px] ${future ? 'opacity-55' : ''}`}
        aria-hidden
      />

      {fill && (
        <motion.span
          className="absolute inset-x-[3px] bottom-[3px] rounded-[10px]"
          style={{ background: fill.color }}
          initial={reduceMotion ? false : { height: 0 }}
          animate={{ height: `calc(${(fill.fraction * 100).toFixed(1)}% - 6px)` }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 210, damping: 24, delay: Math.min(0.24, order * 0.035) }
          }
          aria-hidden
        />
      )}

      {/* Rest days carry a dash as well as their stone colour: that stone sits close
          enough to the ramp's light end under deuteranopia that colour alone would
          not separate "I rested" from "I had a light day". */}
      {state.kind === 'rest' && (
        <span
          className="absolute inset-x-0 bottom-[7px] mx-auto h-[2px] w-4 rounded-full"
          style={{ background: 'var(--ink-soft)' }}
          aria-hidden
        />
      )}

      <span
        className="absolute inset-x-0 top-1.5 text-center text-[11px] font-medium tabular-nums"
        style={{ color: fill && fill.fraction > 0.82 ? fill.ink : 'var(--ink-soft)' }}
      >
        {label}
      </span>

      {today && (
        <span
          className="pointer-events-none absolute inset-0 rounded-[13px] ring-2 ring-inset ring-bronze"
          aria-hidden
        />
      )}
    </>
  )

  const className = `relative h-full w-full overflow-hidden rounded-[13px] ${
    interactive ? 'transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze active:scale-95' : ''
  }`

  if (!interactive) {
    return (
      <div className={className} role="img" aria-label={ariaLabel}>
        {body}
      </div>
    )
  }

  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={className}>
      {body}
    </button>
  )
}
