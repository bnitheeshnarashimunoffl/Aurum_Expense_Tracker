import { WEEKDAYS } from '../lib/types'
import { cellStateFor, formatVolume, sessionVolume, STEP_LABEL } from '../lib/volume'
import { formatDayNum, isFutureDate, isTodayDate } from '@/lib/date'
import { dayOfWeek } from '../lib/schedule'
import VolumeColumn from './VolumeColumn'
import type { SessionWithSets } from '../lib/types'

interface WeekGridProps {
  dates: string[]
  sessions: SessionWithSets[]
  splitDayName: (id: string | null) => string
  onSelectDay: (date: string) => void
}

/**
 * The hero of Virtus's home screen: the current week as seven columns standing in
 * marble. Everything else on the screen is deliberately quieter than this.
 *
 * Reading it takes no numbers — taller and darker is more work than usual for that
 * kind of day, and an untouched day is just an empty recess. What it is NOT doing is
 * comparing days against each other: a leg day and a shoulder day are not on the
 * same scale, so each column is measured only against its own split day's trailing
 * average (see lib/volume.ts).
 */
export default function WeekGrid({ dates, sessions, splitDayName, onSelectDay }: WeekGridProps) {
  return (
    // data-tour anchors Virtus's walkthrough — see src/onboarding/steps.ts.
    <div data-tour="virtus-grid" className="virtus-neu-raised rounded-card px-3 pb-3 pt-2.5">
      <div className="grid grid-cols-7 gap-1.5">
        {dates.map((date, i) => (
          <div key={`h-${date}`} className="pb-1.5 text-center">
            <span
              className={`text-[10px] ${isTodayDate(date) ? 'font-semibold text-bronzeDeep' : 'text-inkSoft'}`}
            >
              {WEEKDAYS[i]}
            </span>
          </div>
        ))}

        {dates.map((date, i) => {
          const session = sessions.find((s) => s.date === date)
          const state = cellStateFor(session, sessions)
          return (
            <div key={date} className="h-[150px]">
              <VolumeColumn
                state={state}
                label={formatDayNum(date)}
                today={isTodayDate(date)}
                future={isFutureDate(date)}
                order={i}
                onClick={() => onSelectDay(date)}
                ariaLabel={describeDay(date, session, state, splitDayName)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The whole cell in words. The grid encodes its meaning in colour and height, so
 * without this a screen-reader user would get seven unlabelled buttons.
 */
function describeDay(
  date: string,
  session: SessionWithSets | undefined,
  state: ReturnType<typeof cellStateFor>,
  splitDayName: (id: string | null) => string
): string {
  const day = `${WEEKDAYS[dayOfWeek(date)]} ${formatDayNum(date)}`
  switch (state.kind) {
    case 'empty':
      return `${day} — nothing logged. Open to add a workout.`
    case 'rest':
      return `${day} — rest day.`
    case 'logged-no-baseline':
      return `${day} — ${splitDayName(session?.split_day_id ?? null)}, ${formatVolume(state.volume)} kg volume. First session of this split day, nothing to compare against yet.`
    case 'ranked':
      return `${day} — ${splitDayName(session?.split_day_id ?? null)}, ${formatVolume(
        sessionVolume(session?.sets ?? [])
      )} kg volume. ${STEP_LABEL[state.step]}.`
  }
}
