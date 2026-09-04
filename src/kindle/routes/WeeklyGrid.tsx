import { useEffect, useMemo, useState } from 'react'
import { useHabits } from '../hooks/useHabits'
import { useHabitLogs } from '../hooks/useHabitLogs'
import { useToast } from '@/hooks/useToast'
import { ensureDefaultHabitsSeeded } from '../lib/seed'
import { mondayOf, weekDates, formatWeekdayShort, formatDayNum } from '../lib/date'
import { formatDate, formatDateShort, todayISO } from '@/lib/format'
import { shortHabitLabel } from '../lib/quantity'
import HabitGrid, { type DayColumn } from '../components/HabitGrid'
import HabitPill from '../components/HabitPill'
import LogHabitSheet from '../components/LogHabitSheet'
import KindleToast from '../components/KindleToast'
import FlameIcon from '../components/FlameIcon'
import LoadingRing from '@/components/LoadingRing'
import ModuleEmptyState from '@/components/ModuleEmptyState'
import ModuleWalkthrough from '@/onboarding/ModuleWalkthrough'
import type { Habit } from '../lib/types'

export default function WeeklyGrid() {
  const [seeded, setSeeded] = useState(false)
  useEffect(() => {
    ensureDefaultHabitsSeeded().finally(() => setSeeded(true))
  }, [])

  const { habits, loading: habitsLoading } = useHabits()
  const monday = mondayOf()
  const dates = useMemo(() => weekDates(monday), [monday])
  const { logs, loading: logsLoading, setToday, resetToday } = useHabitLogs({ from: dates[0], to: dates[6] })
  const { message, showToast } = useToast()
  const [logTarget, setLogTarget] = useState<Habit | null>(null)

  const today = todayISO()
  const stageFor = (habitId: string) => logs.find((l) => l.habit_id === habitId && l.date === today)?.stage ?? 0

  const days: DayColumn[] = dates.map((date) => ({
    date,
    headerLabel: formatWeekdayShort(date),
    subLabel: formatDayNum(date),
  }))

  async function handleSelect(habit: Habit, stage: number) {
    try {
      await setToday(habit.id, today, stage)
    } catch {
      showToast(`Couldn't save ${shortHabitLabel(habit.label)}`)
    }
  }

  async function handleReset(habit: Habit) {
    if (stageFor(habit.id) <= 0) return
    try {
      await resetToday(habit.id, today)
      showToast(`${shortHabitLabel(habit.label)} reset`)
    } catch {
      showToast(`Couldn't reset ${shortHabitLabel(habit.label)}`)
    }
  }

  const loading = !seeded || habitsLoading || logsLoading

  return (
    <div className="px-4 pt-4">
      <header className="mb-5 flex items-center gap-2">
        <FlameIcon size={26} />
        <div>
          <h1 className="font-display text-2xl font-bold text-primary">Kindle</h1>
          <p className="text-xs text-muted">
            {formatDate(dates[0])} – {formatDate(dates[6])}
          </p>
        </div>
      </header>

      {loading ? (
        <LoadingRing label="Loading habits" />
      ) : habits.length === 0 ? (
        // Only reachable by deleting all three examples: Kindle is the one module
        // that ships with anything in it, precisely because an empty grid reads as
        // broken rather than as new.
        <ModuleEmptyState
          tone="kindle"
          icon={<FlameIcon size={30} />}
          title="No habits to track yet"
          body="Kindle needs at least one habit before the grid means anything. Add the ones you actually want to keep — a plain done-or-not, or one that counts up through the day."
          action={{ label: 'Add a habit', to: '/kindle/settings' }}
        />
      ) : (
        <>
          {/* Read-only summary. Nothing here logs anything: today goes through the pills
              below, and past days go through History's PIN-gated edit flow. */}
          <div data-tour="kindle-grid">
            <HabitGrid habits={habits} days={days} logs={logs} />
          </div>
          <p className="mt-3 text-[11px] text-muted">Past days are edited from History.</p>

          <section className="mt-7">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-sm font-semibold text-primary">Log today</h2>
              <span className="text-[11px] text-muted">{formatDateShort(today)} · hold to reset</span>
            </div>
            <div data-tour="kindle-pills" className="space-y-2.5">
              {habits.map((habit) => (
                <HabitPill
                  key={habit.id}
                  habit={habit}
                  stage={stageFor(habit.id)}
                  onOpen={() => setLogTarget(habit)}
                  onReset={() => handleReset(habit)}
                />
              ))}
            </div>
          </section>
        </>
      )}

      <LogHabitSheet
        habit={logTarget}
        currentStage={logTarget ? stageFor(logTarget.id) : 0}
        dateLabel={`Today · ${formatDate(today)}`}
        onSelect={(stage) => {
          if (logTarget) void handleSelect(logTarget, stage)
        }}
        onClose={() => setLogTarget(null)}
      />

      <KindleToast message={message} />

      {/* Waits for the grid and pills to exist before pointing at them. */}
      <ModuleWalkthrough module="kindle" ready={!loading && habits.length > 0} />
    </div>
  )
}
