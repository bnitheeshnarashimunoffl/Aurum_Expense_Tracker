import { WEEKDAYS } from '../lib/types'
import { cellStateFor, VOLUME_RAMP, onStep } from '../lib/volume'
import { formatDayNum, isFutureDate, isTodayDate } from '@/lib/date'
import { dayOfWeek } from '../lib/schedule'
import type { SessionWithSets } from '../lib/types'

interface MonthGridProps {
  dates: string[]
  sessions: SessionWithSets[]
  onSelectDay: (date: string) => void
}

/**
 * A month at calendar density. The week view's column metaphor does not survive
 * being shrunk to a 36px square — a 6px-tall fill reads as a rendering artefact —
 * so at this size the cell is filled solid and magnitude falls back to colour alone,
 * with the rest-day dash still carrying the one distinction colour cannot.
 *
 * That is an acceptable trade here and not in the week view, because this screen is
 * for spotting patterns across weeks rather than reading one day precisely; tapping
 * any cell opens the day in full.
 */
export default function MonthGrid({ dates, sessions, onSelectDay }: MonthGridProps) {
  // Calendar months don't start on Monday, so the first row is padded to keep every
  // column under its own weekday.
  const lead = dates.length > 0 ? dayOfWeek(dates[0]) : 0

  return (
    <div className="virtus-neu-raised rounded-card px-3 pb-3 pt-2.5">
      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((label) => (
          <span key={label} className="text-center text-[10px] text-inkSoft">
            {label.slice(0, 1)}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: lead }, (_, i) => (
          <div key={`pad-${i}`} aria-hidden />
        ))}

        {dates.map((date) => {
          const session = sessions.find((s) => s.date === date)
          const state = cellStateFor(session, sessions)

          const fill =
            state.kind === 'ranked'
              ? { background: VOLUME_RAMP[state.step], color: onStep(state.step) }
              : state.kind === 'rest'
                ? { background: 'var(--virtus-rest)', color: 'var(--ink-charcoal)' }
                : state.kind === 'logged-no-baseline'
                  ? { background: 'var(--bronze-primary)', color: 'var(--marble-base)' }
                  : undefined

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDay(date)}
              aria-label={`${formatDayNum(date)} — ${state.kind === 'empty' ? 'nothing logged' : state.kind === 'rest' ? 'rest day' : 'workout logged'}`}
              style={fill}
              className={`relative flex aspect-square items-center justify-center rounded-[10px] text-[11px] tabular-nums transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze active:scale-90 ${
                fill ? '' : 'virtus-neu-pressed-sm text-inkSoft'
              } ${isFutureDate(date) ? 'opacity-55' : ''} ${
                isTodayDate(date) ? 'ring-2 ring-inset ring-bronze' : ''
              }`}
            >
              {formatDayNum(date)}
              {state.kind === 'rest' && (
                <span
                  className="absolute inset-x-0 bottom-1 mx-auto h-[2px] w-2.5 rounded-full"
                  style={{ background: 'var(--ink-soft)' }}
                  aria-hidden
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
