import { formatDate } from '@/lib/format'
import { isFutureDate, isPastDate, isTodayDate } from '@/lib/date'
import VirtusSheet from './VirtusSheet'
import {
  cellStateFor,
  formatSet,
  formatVolume,
  sessionVolume,
  setsForExercise,
  STEP_LABEL,
} from '../lib/volume'
import type { Exercise, SessionWithSets } from '../lib/types'

interface DayDetailSheetProps {
  open: boolean
  date: string | null
  sessions: SessionWithSets[]
  splitDayName: (id: string | null) => string
  exerciseById: Map<string, Exercise>
  /** Opens the logging screen for this date. Already PIN-gated by the caller for past days. */
  onEdit: (date: string) => void
  onClose: () => void
}

/**
 * The read view for one day: what was trained, every set of it, and how the session
 * compared to that split day's own trailing average.
 *
 * Exercise order comes from the SETS, not from the split day template, so a day
 * whose template has since been reordered or emptied still reads back exactly as it
 * was performed.
 */
export default function DayDetailSheet({
  open,
  date,
  sessions,
  splitDayName,
  exerciseById,
  onEdit,
  onClose,
}: DayDetailSheetProps) {
  if (!date) return null

  const session = sessions.find((s) => s.date === date)
  const state = cellStateFor(session, sessions)
  const volume = session ? sessionVolume(session.sets) : 0
  const future = isFutureDate(date)

  // Distinct exercises in the order they were first logged that day.
  const exerciseIds: string[] = []
  for (const set of [...(session?.sets ?? [])].sort((a, b) => a.logged_at.localeCompare(b.logged_at))) {
    if (!exerciseIds.includes(set.exercise_id)) exerciseIds.push(set.exercise_id)
  }

  return (
    <VirtusSheet open={open} onClose={onClose} title={formatDate(date)}>
      {future ? (
        <p className="virtus-neu-pressed rounded-card px-4 py-6 text-center text-sm text-inkSoft">
          Still ahead of you. Days can be logged from the day itself onwards.
        </p>
      ) : state.kind === 'empty' ? (
        <>
          <p className="virtus-neu-pressed mb-4 rounded-card px-4 py-6 text-center text-sm text-inkSoft">
            {isTodayDate(date) ? 'Nothing logged yet today.' : 'Nothing was logged on this day.'}
          </p>
          <button
            onClick={() => onEdit(date)}
            className="virtus-neu-raised min-h-[46px] w-full rounded-card text-sm font-semibold text-bronzeDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
          >
            {isPastDate(date) ? 'Fill this day in' : 'Log a workout'}
          </button>
        </>
      ) : state.kind === 'rest' ? (
        <>
          <div className="virtus-neu-pressed mb-4 flex items-center gap-3 rounded-card px-4 py-5">
            <span
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--virtus-rest)' }}
              aria-hidden
            >
              <span className="h-[2px] w-4 rounded-full" style={{ background: 'var(--ink-charcoal)' }} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-inkCharcoal">Rest day</span>
              <span className="block text-xs text-inkSoft">Logged, not skipped.</span>
            </span>
          </div>
          <button
            onClick={() => onEdit(date)}
            className="virtus-neu-raised min-h-[46px] w-full rounded-card text-sm font-semibold text-bronzeDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
          >
            Change this day
          </button>
        </>
      ) : (
        <>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-inscribe truncate text-lg font-semibold text-inkCharcoal">
                {splitDayName(session?.split_day_id ?? null)}
              </h3>
              <p className="text-xs text-inkSoft">
                {state.kind === 'ranked'
                  ? STEP_LABEL[state.step]
                  : 'First session of this split day — nothing to compare against yet.'}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <span className="block text-xl font-semibold tabular-nums text-inkCharcoal">{formatVolume(volume)}</span>
              <span className="block text-[10px] text-inkSoft">kg total volume</span>
            </div>
          </div>

          {state.kind === 'ranked' && (
            <p className="virtus-neu-pressed-sm mb-4 rounded-card px-3 py-2 text-[11px] text-inkSoft">
              Your recent {splitDayName(session?.split_day_id ?? null)} sessions average{' '}
              <span className="tabular-nums text-inkCharcoal">{formatVolume(state.baseline)}</span> kg — this one is{' '}
              <span className="tabular-nums text-inkCharcoal">{Math.round(state.ratio * 100)}%</span> of that.
            </p>
          )}

          <div className="mb-4 space-y-2.5">
            {exerciseIds.map((exerciseId) => {
              const exercise = exerciseById.get(exerciseId)
              const exerciseSets = setsForExercise(session?.sets ?? [], exerciseId)
              return (
                <div key={exerciseId} className="virtus-neu-raised-sm rounded-card px-3.5 py-3">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-inkCharcoal">
                      {exercise?.name ?? 'Removed exercise'}
                      {exercise?.archived && <span className="ml-1.5 text-[10px] font-normal text-inkSoft">(removed)</span>}
                    </span>
                    <span className="flex-shrink-0 text-[11px] tabular-nums text-inkSoft">
                      {exerciseSets.length} set{exerciseSets.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {exerciseSets.map((set) => (
                      <span
                        key={set.id}
                        className="virtus-neu-pressed-sm rounded-lg px-2 py-1 text-[11px] tabular-nums text-inkCharcoal"
                      >
                        {formatSet(set)}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <button
            onClick={() => onEdit(date)}
            className="virtus-neu-raised min-h-[46px] w-full rounded-card text-sm font-semibold text-bronzeDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
          >
            {isTodayDate(date) ? 'Continue logging' : 'Edit this workout'}
          </button>
        </>
      )}
    </VirtusSheet>
  )
}
