import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingRing from '@/components/LoadingRing'
import { todayISO } from '@/lib/format'
import {
  currentYearMonth,
  formatMonthLabel,
  isPastDate,
  mondayOf,
  monthDates,
  shiftMonth,
  shiftWeeks,
  weekDates,
  type YearMonth,
} from '@/lib/date'
import { useVirtusPlan } from '../hooks/useVirtusPlan'
import { useSessions } from '../hooks/useSessions'
import { usePinGate } from '../hooks/usePinGate'
import { scheduledFor } from '../lib/schedule'
import { formatVolume, sessionVolume } from '../lib/volume'
import WeekGrid from '../components/WeekGrid'
import MonthGrid from '../components/MonthGrid'
import DayDetailSheet from '../components/DayDetailSheet'
import SplitDayPicker from '../components/SplitDayPicker'
import LaurelIcon from '../components/LaurelIcon'
import ModuleEmptyState from '@/components/ModuleEmptyState'
import ModuleWalkthrough from '@/onboarding/ModuleWalkthrough'

interface Action {
  label: string
  run: () => void
}

export default function Home() {
  const navigate = useNavigate()
  const plan = useVirtusPlan()
  const { sessions, loading: sessionsLoading, markRest, startWorkout, clearDay } = useSessions()
  const { requestGate, gate } = usePinGate()

  const [tab, setTab] = useState<'week' | 'month'>('week')
  const [weekOffset, setWeekOffset] = useState(0)
  const [ym, setYm] = useState<YearMonth>(currentYearMonth())
  const [detailDate, setDetailDate] = useState<string | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)

  const today = todayISO()
  const weekStart = shiftWeeks(mondayOf(), weekOffset)
  const weekDatesArr = useMemo(() => weekDates(weekStart), [weekStart])
  const monthDatesArr = useMemo(() => monthDates(ym), [ym])

  const todaySession = sessions.find((s) => s.date === today)
  const suggestion = scheduledFor(today, plan.schedule, plan.splitDays)

  const splitDayName = (id: string | null) => plan.splitDays.find((s) => s.id === id)?.name ?? 'Workout'

  const weekVolume = weekDatesArr.reduce(
    (total, date) => total + sessionVolume(sessions.find((s) => s.date === date)?.sets ?? []),
    0
  )
  const weekTrained = weekDatesArr.filter((date) => {
    const s = sessions.find((x) => x.date === date)
    return s && !s.is_rest_day && s.sets.length > 0
  }).length

  /** Past days are the PIN-gated ones; today and the future are not. */
  function openForEditing(date: string) {
    const go = () => {
      setDetailDate(null)
      navigate(`/virtus/train?date=${date}`)
    }
    if (isPastDate(date)) requestGate(go)
    else go()
  }

  async function handleStart(splitDayId: string) {
    await startWorkout(today, splitDayId)
    setOverrideOpen(false)
    navigate('/virtus/train')
  }

  if (plan.loading || sessionsLoading) {
    return (
      <div className="px-4 pt-4">
        <LoadingRing label="Loading Virtus" />
      </div>
    )
  }

  /**
   * A brand-new Virtus can do nothing at all, and the reason is not obvious from
   * looking at it: logging a set needs an exercise library, split days built from
   * that library, and a weekly schedule pointing at those — in that order. So the
   * first screen is the chain itself with a button into the place it happens,
   * rather than an empty grid and a shrug. This replaces the whole screen instead
   * of sitting inside it: a history grid of seven empty cells above a "set this
   * up" card would be showing someone the result before the cause.
   */
  const nothingSetUp = plan.exercises.length === 0 && plan.splitDays.length === 0

  if (nothingSetUp) {
    return (
      <div className="px-4 pt-4">
        <header className="mb-5 flex items-center gap-2.5 pr-14">
          <LaurelIcon size={28} />
          <div className="min-w-0 flex-1">
            <h1 className="font-inscribe text-2xl font-semibold text-inkCharcoal">Virtus</h1>
            <p className="truncate text-xs text-inkSoft">Nothing set up yet</p>
          </div>
        </header>

        <ModuleEmptyState
          tone="virtus"
          icon={<LaurelIcon size={30} />}
          title="Three things, then you can train"
          body="Virtus needs to know what you lift before it can record you lifting it. All three live in Settings, and each is built from the one before."
          steps={[
            <>
              <span className="text-inkCharcoal">Library</span> — every exercise you do, grouped into muscle groups
              you name.
            </>,
            <>
              <span className="text-inkCharcoal">Split days</span> — Push, Pull, Legs or whatever yours are, built by
              picking from that library.
            </>,
            <>
              <span className="text-inkCharcoal">Schedule</span> — which split day falls on which weekday, and which
              days are rest.
            </>,
          ]}
          action={{ label: 'Start with the library', to: '/virtus/settings' }}
        />

        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-inkSoft">
          Ten minutes once. After that Virtus opens already knowing what today is.
        </p>

        <ModuleWalkthrough module="virtus" />
      </div>
    )
  }

  const { primary, secondaries } = todayActions()

  return (
    <div className="px-4 pt-4">
      <header className="mb-5 flex items-center gap-2.5 pr-14">
        <LaurelIcon size={28} />
        <div className="min-w-0 flex-1">
          <h1 className="font-inscribe text-2xl font-semibold text-inkCharcoal">Virtus</h1>
          <p className="truncate text-xs text-inkSoft">
            {weekTrained === 0
              ? 'No sessions this week yet.'
              : `${weekTrained} session${weekTrained === 1 ? '' : 's'} · ${formatVolume(weekVolume)} kg this week`}
          </p>
        </div>
      </header>

      <div className="virtus-neu-pressed mb-3 flex rounded-full p-1" role="group" aria-label="History range">
        {(['week', 'month'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setTab(option)}
            aria-pressed={tab === option}
            className={`min-h-[34px] flex-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bronzeDeep ${
              tab === option ? 'text-marbleBase' : 'text-inkSoft'
            }`}
            style={tab === option ? { background: 'var(--bronze-primary)' } : undefined}
          >
            {option === 'week' ? 'By week' : 'By month'}
          </button>
        ))}
      </div>

      {tab === 'week' ? (
        <>
          <WeekGrid
            dates={weekDatesArr}
            sessions={sessions}
            splitDayName={splitDayName}
            onSelectDay={setDetailDate}
          />
          <div className="mb-6 mt-2 flex items-center justify-between">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="virtus-neu-raised-sm min-h-[34px] rounded-full px-3 text-[11px] text-inkSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
            >
              ← Earlier
            </button>
            <span className="text-[11px] text-inkSoft">
              {weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : `${-weekOffset} weeks ago`}
            </span>
            <button
              onClick={() => setWeekOffset((w) => Math.min(0, w + 1))}
              disabled={weekOffset === 0}
              className="virtus-neu-raised-sm min-h-[34px] rounded-full px-3 text-[11px] text-inkSoft disabled:opacity-35 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
            >
              Later →
            </button>
          </div>
        </>
      ) : (
        <>
          <MonthGrid dates={monthDatesArr} sessions={sessions} onSelectDay={setDetailDate} />
          <div className="mb-6 mt-2 flex items-center justify-between">
            <button
              onClick={() => setYm((m) => shiftMonth(m, -1))}
              className="virtus-neu-raised-sm min-h-[34px] rounded-full px-3 text-[11px] text-inkSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
            >
              ←
            </button>
            <span className="text-[11px] text-inkSoft">{formatMonthLabel(ym)}</span>
            <button
              onClick={() => setYm((m) => shiftMonth(m, 1))}
              disabled={ym.year === currentYearMonth().year && ym.month === currentYearMonth().month}
              className="virtus-neu-raised-sm min-h-[34px] rounded-full px-3 text-[11px] text-inkSoft disabled:opacity-35 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
            >
              →
            </button>
          </div>
        </>
      )}

      {/* Today — the one action on this screen, and quieter than the grid above it. */}
      <section data-tour="virtus-today" className="virtus-neu-raised mb-5 rounded-card px-4 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[11px] text-inkSoft">Today</span>
            <h2 className="font-inscribe truncate text-lg font-semibold text-inkCharcoal">{todayHeadline()}</h2>
          </div>
          {todaySession && !todaySession.is_rest_day && todaySession.sets.length > 0 && (
            <span className="flex-shrink-0 text-right">
              <span className="block text-sm font-semibold tabular-nums text-inkCharcoal">
                {formatVolume(sessionVolume(todaySession.sets))}
              </span>
              <span className="block text-[10px] text-inkSoft">kg so far</span>
            </span>
          )}
        </div>

        {/* The library exists but no split days do — halfway through the chain.
            Names the next link rather than repeating the whole thing. */}
        {plan.splitDays.length === 0 ? (
          <div className="virtus-neu-pressed rounded-card px-4 py-4">
            <p className="text-[13px] leading-relaxed text-inkSoft">
              Your library is started. Next, group those exercises into split days — Push, Pull, Legs, whatever yours
              are — and Virtus can suggest what to train each day.
            </p>
            <button
              type="button"
              onClick={() => navigate('/virtus/settings')}
              className="mt-3 min-h-[44px] w-full rounded-card text-[13.5px] font-semibold transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-bronzeDeep"
              style={{ background: 'var(--bronze-primary)', color: 'var(--marble-base)' }}
            >
              Build a split day
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={primary.run}
              className="min-h-[50px] w-full rounded-card text-sm font-semibold transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-bronzeDeep active:scale-[0.98]"
              style={{ background: 'var(--bronze-primary)', color: 'var(--marble-base)' }}
            >
              {primary.label}
            </button>
            <div className="mt-2 flex gap-2">
              {secondaries.map((action) => (
                <button
                  key={action.label}
                  onClick={action.run}
                  className="virtus-neu-raised-sm min-h-[40px] flex-1 rounded-card text-xs text-inkSoft focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <DayDetailSheet
        open={detailDate !== null}
        date={detailDate}
        sessions={sessions}
        splitDayName={splitDayName}
        exerciseById={plan.exerciseById}
        onEdit={openForEditing}
        onClose={() => setDetailDate(null)}
      />

      <SplitDayPicker
        open={overrideOpen}
        splitDays={plan.splitDays}
        exercisesOf={plan.exercisesOf}
        currentId={todaySession?.split_day_id ?? null}
        onPick={handleStart}
        onClose={() => setOverrideOpen(false)}
      />

      {gate}

      {/* The month tab has no `virtus-grid` on screen, so the tour only runs while
          the week view — the default — is showing. */}
      <ModuleWalkthrough module="virtus" ready={tab === 'week'} />
    </div>
  )

  function todayHeadline(): string {
    if (todaySession?.is_rest_day) return 'Rest'
    if (todaySession?.split_day_id) return splitDayName(todaySession.split_day_id)
    if (suggestion.kind === 'split') return suggestion.splitDay.name
    if (suggestion.kind === 'rest') return 'Rest'
    return 'Nothing scheduled'
  }

  /**
   * The one bronze action on Home, and what sits quietly beside it.
   *
   * The bronze slot always holds the thing you most likely came here to do, which is
   * not always "train": on a day the schedule calls a rest day, logging the rest IS
   * the action, and training anyway is the exception. Getting that the wrong way
   * round would put the loud button on the unlikely choice every rest day.
   */
  function todayActions(): { primary: Action; secondaries: Action[] } {
    const pick: Action = { label: 'Train something else', run: () => setOverrideOpen(true) }
    const rest: Action = { label: 'Mark as rest', run: () => void markRest(today) }

    // Already training today — "Continue", never a second "Start".
    if (todaySession && !todaySession.is_rest_day) {
      const started = todaySession.sets.length > 0
      return {
        primary: { label: started ? 'Continue session' : 'Open session', run: () => navigate('/virtus/train') },
        secondaries: [pick, rest],
      }
    }

    if (todaySession?.is_rest_day) {
      return {
        primary: { label: 'Train instead', run: () => setOverrideOpen(true) },
        secondaries: [{ label: 'Clear this day', run: () => void clearDay(today) }],
      }
    }

    if (suggestion.kind === 'split') {
      const splitDay = suggestion.splitDay
      return {
        primary: { label: `Start ${splitDay.name}`, run: () => void handleStart(splitDay.id) },
        secondaries: [pick, rest],
      }
    }

    if (suggestion.kind === 'rest') {
      return {
        primary: { label: 'Log rest day', run: () => void markRest(today) },
        secondaries: [{ label: 'Train anyway', run: () => setOverrideOpen(true) }],
      }
    }

    return { primary: { label: 'Pick a workout', run: () => setOverrideOpen(true) }, secondaries: [rest] }
  }
}
