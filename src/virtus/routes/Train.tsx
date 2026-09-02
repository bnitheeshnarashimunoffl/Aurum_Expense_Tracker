import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import LoadingRing from '@/components/LoadingRing'
import { formatDate, todayISO } from '@/lib/format'
import { isFutureDate, isPastDate } from '@/lib/date'
import { useVirtusPlan } from '../hooks/useVirtusPlan'
import { useSessions } from '../hooks/useSessions'
import { usePinGate } from '../hooks/usePinGate'
import { scheduledFor } from '../lib/schedule'
import { formatVolume, lastSessionWith, personalBest, sessionVolume, setsForExercise } from '../lib/volume'
import ExerciseLogger from '../components/ExerciseLogger'
import SplitDayPicker from '../components/SplitDayPicker'
import type { Exercise } from '../lib/types'

/**
 * The live logging screen. Defaults to today; ?date= opens an earlier day, which the
 * caller has already taken through the PIN gate — and this screen re-gates on its own
 * for a past day reached by a direct URL, so the gate cannot be skipped by typing one.
 */
export default function Train() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const plan = useVirtusPlan()
  const { sessions, loading: sessionsLoading, sessionOn, startWorkout, markRest, clearDay, addSet, updateSet, deleteSet } =
    useSessions()
  const { requestGate, gate } = usePinGate()

  const date = params.get('date') ?? todayISO()
  const past = isPastDate(date)
  const session = sessionOn(date)

  const [index, setIndex] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [unlocked, setUnlocked] = useState(!past)

  // A past date reached directly still has to clear the PIN. Editing today never does.
  useEffect(() => {
    if (!past) {
      setUnlocked(true)
      return
    }
    setUnlocked(false)
    requestGate(() => setUnlocked(true))
    // requestGate is recreated each render; keying on the date is what matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, past, plan.loading, sessionsLoading])

  const splitDay = plan.splitDays.find((s) => s.id === session?.split_day_id) ?? null
  const exercises: Exercise[] = useMemo(
    () => (splitDay ? plan.exercisesOf(splitDay.id) : []),
    [splitDay, plan.exercisesOf]
  )

  // Exercises removed from the template after the fact still have to appear, or the
  // sets logged against them would be invisible and un-editable on this screen.
  const loggedOnly: Exercise[] = useMemo(() => {
    const inTemplate = new Set(exercises.map((e) => e.id))
    const extra: Exercise[] = []
    for (const set of session?.sets ?? []) {
      if (inTemplate.has(set.exercise_id) || extra.some((e) => e.id === set.exercise_id)) continue
      const found = plan.exerciseById.get(set.exercise_id)
      if (found) extra.push(found)
    }
    return extra
  }, [exercises, session, plan.exerciseById])

  const ordered = [...exercises, ...loggedOnly]
  const current = ordered[Math.min(index, Math.max(0, ordered.length - 1))]

  useEffect(() => {
    setIndex(0)
  }, [date, splitDay?.id])

  const groupLabel = (exercise: Exercise) =>
    plan.muscleGroups.find((g) => g.id === exercise.muscle_group_id)?.label ?? null

  if (plan.loading || sessionsLoading) {
    return (
      <div className="px-4 pt-4">
        <LoadingRing label="Loading session" />
      </div>
    )
  }

  if (past && !unlocked) {
    return (
      <div className="px-4 pt-4">
        <Header date={date} title="Locked" subtitle="A workout before today needs your PIN." />
        <p className="virtus-neu-pressed rounded-card px-4 py-8 text-center text-sm text-inkSoft">
          Enter your Virtus PIN to edit this day, or head back to the week.
        </p>
        <Link
          to="/virtus"
          className="virtus-neu-raised mt-4 flex min-h-[46px] w-full items-center justify-center rounded-card text-sm font-semibold text-bronzeDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
        >
          Back to the week
        </Link>
        {gate}
      </div>
    )
  }

  if (isFutureDate(date)) {
    return (
      <div className="px-4 pt-4">
        <Header date={date} title="Not yet" subtitle="Days are logged from the day itself onwards." />
        <Link
          to="/virtus"
          className="virtus-neu-raised flex min-h-[46px] w-full items-center justify-center rounded-card text-sm font-semibold text-bronzeDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
        >
          Back to the week
        </Link>
      </div>
    )
  }

  // Nothing chosen for this day yet.
  if (!session || (!session.split_day_id && !session.is_rest_day)) {
    const suggestion = scheduledFor(date, plan.schedule, plan.splitDays)
    return (
      <div className="px-4 pt-4">
        <Header
          date={date}
          title={suggestion.kind === 'split' ? suggestion.splitDay.name : suggestion.kind === 'rest' ? 'Rest' : 'Nothing scheduled'}
          subtitle={
            plan.splitDays.length === 0
              ? 'Build your split days in Settings first.'
              : suggestion.kind === 'unset'
                ? 'This weekday has no split day assigned.'
                : 'Suggested from your weekly schedule.'
          }
        />
        {plan.splitDays.length === 0 ? (
          <>
            <p className="virtus-neu-pressed mb-4 rounded-card px-4 py-8 text-center text-sm text-inkSoft">
              There is nothing to train yet. Add exercises to your library, group them into a split day, and
              Virtus will have something to log.
            </p>
            <Link
              to="/virtus/settings"
              className="virtus-neu-raised flex min-h-[46px] w-full items-center justify-center rounded-card text-sm font-semibold text-bronzeDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
            >
              Open Settings
            </Link>
          </>
        ) : (
          <>
            {suggestion.kind === 'split' && (
              <button
                onClick={() => void startWorkout(date, suggestion.splitDay.id)}
                className="mb-2 min-h-[50px] w-full rounded-card text-sm font-semibold transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-bronzeDeep active:scale-[0.98]"
                style={{ background: 'var(--bronze-primary)', color: 'var(--marble-base)' }}
              >
                Start {suggestion.splitDay.name}
              </button>
            )}
            <button
              onClick={() => setPickerOpen(true)}
              className="virtus-neu-raised mb-2 min-h-[46px] w-full rounded-card text-sm font-medium text-inkCharcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
            >
              {suggestion.kind === 'split' ? 'Train something else' : 'Pick a split day'}
            </button>
            <button
              onClick={() => void markRest(date)}
              className="virtus-neu-raised-sm min-h-[44px] w-full rounded-card text-xs text-inkSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
            >
              Log this as a rest day
            </button>
          </>
        )}
        <SplitDayPicker
          open={pickerOpen}
          splitDays={plan.splitDays}
          exercisesOf={plan.exercisesOf}
          currentId={null}
          onPick={async (id) => {
            await startWorkout(date, id)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
        {gate}
      </div>
    )
  }

  if (session.is_rest_day) {
    return (
      <div className="px-4 pt-4">
        <Header date={date} title="Rest" subtitle="Logged as a rest day." />
        <div className="virtus-neu-pressed mb-4 flex items-center gap-3 rounded-card px-4 py-6">
          <span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--virtus-rest)' }}
            aria-hidden
          >
            <span className="h-[2px] w-5 rounded-full" style={{ background: 'var(--ink-charcoal)' }} />
          </span>
          <p className="text-sm text-inkSoft">Recovery counts. Change your mind below if you end up training.</p>
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          className="mb-2 min-h-[50px] w-full rounded-card text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-bronzeDeep"
          style={{ background: 'var(--bronze-primary)', color: 'var(--marble-base)' }}
        >
          Train instead
        </button>
        <button
          onClick={async () => {
            await clearDay(date)
            navigate('/virtus')
          }}
          className="virtus-neu-raised-sm min-h-[44px] w-full rounded-card text-xs text-inkSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
        >
          Clear this day entirely
        </button>
        <SplitDayPicker
          open={pickerOpen}
          splitDays={plan.splitDays}
          exercisesOf={plan.exercisesOf}
          currentId={null}
          onPick={async (id) => {
            await startWorkout(date, id)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
        {gate}
      </div>
    )
  }

  const volume = sessionVolume(session.sets)

  return (
    <div className="px-4 pt-4">
      <Header
        date={date}
        title={splitDay?.name ?? 'Workout'}
        subtitle={past ? 'Editing a past workout' : 'Logging live'}
        volume={volume}
      />

      {ordered.length === 0 ? (
        <>
          <p className="virtus-neu-pressed mb-4 rounded-card px-4 py-8 text-center text-sm text-inkSoft">
            {splitDay?.name ?? 'This split day'} has no exercises assigned yet. Add some in Settings and they will
            appear here.
          </p>
          <Link
            to="/virtus/settings"
            className="virtus-neu-raised flex min-h-[46px] w-full items-center justify-center rounded-card text-sm font-semibold text-bronzeDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
          >
            Open Settings
          </Link>
        </>
      ) : (
        <>
          {/* Exercise pager. A filled pip means sets are already logged there, so the
              remaining work in the session is readable without stepping through it. */}
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
            {ordered.map((exercise, i) => {
              const logged = setsForExercise(session.sets, exercise.id).length
              const active = i === index
              return (
                <button
                  key={exercise.id}
                  onClick={() => setIndex(i)}
                  aria-current={active}
                  aria-label={`${exercise.name}, ${logged} set${logged === 1 ? '' : 's'} logged`}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze ${
                    active ? 'text-marbleBase' : 'virtus-neu-raised-sm text-inkSoft'
                  }`}
                  style={active ? { background: 'var(--bronze-primary)' } : undefined}
                >
                  {exercise.name}
                  {logged > 0 && <span className="ml-1.5 tabular-nums opacity-80">{logged}</span>}
                </button>
              )
            })}
          </div>

          {current && (
            <ExerciseLogger
              key={current.id}
              exercise={current}
              muscleGroupLabel={groupLabel(current)}
              sets={session.sets}
              previous={lastSessionWith(sessions, current.id, date)}
              best={personalBest(sessions, current.id)}
              onAddSet={(weightKg, reps) => addSet(session.id, current.id, weightKg, reps)}
              onUpdateSet={updateSet}
              onDeleteSet={deleteSet}
            />
          )}

          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="virtus-neu-raised-sm min-h-[46px] flex-1 rounded-card text-sm text-inkSoft disabled:opacity-35 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
            >
              ← Previous
            </button>
            <button
              onClick={() => setIndex((i) => Math.min(ordered.length - 1, i + 1))}
              disabled={index >= ordered.length - 1}
              className="virtus-neu-raised min-h-[46px] flex-[1.4] rounded-card text-sm font-semibold text-bronzeDeep disabled:opacity-35 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
            >
              Next exercise →
            </button>
          </div>

          <button
            onClick={() => setPickerOpen(true)}
            className="mt-2 min-h-[40px] w-full rounded-card text-xs text-inkSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
          >
            Logging the wrong split day?
          </button>
        </>
      )}

      <SplitDayPicker
        open={pickerOpen}
        splitDays={plan.splitDays}
        exercisesOf={plan.exercisesOf}
        currentId={session.split_day_id}
        onPick={async (id) => {
          await startWorkout(date, id)
          setPickerOpen(false)
          setIndex(0)
        }}
        onClose={() => setPickerOpen(false)}
      />

      {past && (
        <button
          onClick={() => setParams({})}
          className="virtus-neu-raised-sm mt-5 min-h-[40px] w-full rounded-card text-xs text-inkSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
        >
          Back to today
        </button>
      )}

      {gate}
    </div>
  )
}

function Header({
  date,
  title,
  subtitle,
  volume,
}: {
  date: string
  title: string
  subtitle: string
  volume?: number
}) {
  return (
    <header className="mb-5 flex items-start gap-3 pr-14">
      <Link
        to="/virtus"
        aria-label="Back to the week"
        className="virtus-neu-raised-sm mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-inkSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
      >
        ←
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="font-inscribe truncate text-2xl font-semibold text-inkCharcoal">{title}</h1>
        <p className="truncate text-xs text-inkSoft">
          {formatDate(date)} · {subtitle}
        </p>
      </div>
      {volume !== undefined && volume > 0 && (
        <span className="flex-shrink-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-inkCharcoal">{formatVolume(volume)}</span>
          <span className="block text-[10px] text-inkSoft">kg</span>
        </span>
      )}
    </header>
  )
}
