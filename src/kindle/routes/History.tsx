import { useMemo, useState } from 'react'
import { useHabits } from '../hooks/useHabits'
import { useHabitLogs } from '../hooks/useHabitLogs'
import { usePinGate } from '../hooks/usePinGate'
import {
  mondayOf,
  weekDates,
  shiftWeeks,
  formatWeekdayShort,
  formatDayNum,
  currentYearMonth,
  shiftMonth,
  monthDates,
  monthRange,
  formatMonthLabel,
  type YearMonth,
} from '../lib/date'
import { formatDate, todayISO } from '@/lib/format'
import { exportReportToPdf } from '@/lib/pdf'
import HabitGrid, { type DayColumn } from '../components/HabitGrid'
import KindleSegmented from '../components/KindleSegmented'
import EditReasonSheet from '../components/EditReasonSheet'
import KindleMonthlyReport from '../reports/KindleMonthlyReport'
import LoadingRing from '@/components/LoadingRing'
import type { Habit, HabitLog } from '../lib/types'

interface EditTarget {
  habit: Habit
  date: string
  stage: number
}

function habitsExistingBy(habits: Habit[], periodEndISO: string): Habit[] {
  const cutoff = new Date(`${periodEndISO}T23:59:59`)
  return habits.filter((h) => new Date(h.created_at) <= cutoff)
}

export default function History() {
  const [tab, setTab] = useState<'weeks' | 'month'>('weeks')
  // Opens on last week, but the current week is reachable too — with the main grid
  // read-only, this is the only place this week's already-passed days (Mon..yesterday)
  // can still be corrected.
  const [weekOffset, setWeekOffset] = useState(-1)
  const [ym, setYm] = useState<YearMonth>(currentYearMonth())
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [exporting, setExporting] = useState(false)

  const { habits: allHabits, loading: habitsLoading } = useHabits({ includeInactive: true })
  const { requestGate, gate } = usePinGate()

  const weekStart = shiftWeeks(mondayOf(), weekOffset)
  const weekDatesArr = useMemo(() => weekDates(weekStart), [weekStart])
  const monthDatesArr = useMemo(() => monthDates(ym), [ym.year, ym.month])
  const monthRangeVal = monthRange(ym)

  const activeRange = tab === 'weeks' ? { from: weekDatesArr[0], to: weekDatesArr[6] } : monthRangeVal
  const { logs, loading: logsLoading, editPast } = useHabitLogs(activeRange)

  const periodEnd = tab === 'weeks' ? weekDatesArr[6] : monthRangeVal.to
  const habits = habitsExistingBy(allHabits, periodEnd)

  const weekDays: DayColumn[] = weekDatesArr.map((date) => ({
    date,
    headerLabel: formatWeekdayShort(date),
    subLabel: formatDayNum(date),
  }))
  const monthDays: DayColumn[] = monthDatesArr.map((date) => ({ date, headerLabel: formatDayNum(date) }))

  /** Only past cells reach this — HabitGrid gates on edit mode — and the PIN + reason flow is mandatory from here on. */
  function handleEditPastDay(habit: Habit, date: string, stage: number) {
    requestGate(() => setEditTarget({ habit, date, stage }))
  }

  const atCurrentMonth = ym.year === currentYearMonth().year && ym.month === currentYearMonth().month

  async function handleExportPdf() {
    setExporting(true)
    let container: HTMLDivElement | null = null
    let root: import('react-dom/client').Root | null = null
    try {
      const exportHabits = habitsExistingBy(allHabits, monthRangeVal.to)
      const monthLogs = logs as HabitLog[]

      container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.left = '-9999px'
      container.style.top = '0'
      document.body.appendChild(container)

      const { createRoot } = await import('react-dom/client')
      root = createRoot(container)
      await new Promise<void>((resolve) => {
        root!.render(
          <KindleMonthlyReport
            monthLabel={formatMonthLabel(ym)}
            habits={exportHabits}
            days={monthDatesArr}
            logs={monthLogs}
            generatedOn={formatDate(todayISO())}
          />
        )
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })

      const filename = `kindle-${ym.year}-${String(ym.month + 1).padStart(2, '0')}.pdf`
      await exportReportToPdf(container.firstElementChild as HTMLElement, filename, { orientation: 'landscape' })
    } finally {
      root?.unmount()
      if (container) document.body.removeChild(container)
      setExporting(false)
    }
  }

  const loading = habitsLoading || logsLoading

  return (
    <div className="px-4 pt-4">
      <h1 className="font-display mb-4 text-2xl font-bold text-primary">History</h1>

      <KindleSegmented
        ariaLabel="History view"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'weeks', label: 'Weeks' },
          { value: 'month', label: 'Month' },
        ]}
      />

      {tab === 'weeks' ? (
        <>
          <div className="my-4 flex items-center justify-between">
            <button onClick={() => setWeekOffset((o) => o - 1)} className="kindle-neu-raised min-h-[36px] rounded-full px-3 text-xs text-primary">
              ← Prev
            </button>
            <span className="text-xs text-muted">
              {weekOffset === 0 ? 'This week' : `${formatDate(weekDatesArr[0])} – ${formatDate(weekDatesArr[6])}`}
            </span>
            <button
              onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
              disabled={weekOffset >= 0}
              className="kindle-neu-raised min-h-[36px] rounded-full px-3 text-xs text-primary disabled:opacity-30"
            >
              Next →
            </button>
          </div>
          {loading ? (
            <LoadingRing label="Loading week" />
          ) : (
            <HabitGrid habits={habits} days={weekDays} logs={logs} onEditPastDay={handleEditPastDay} />
          )}
          <p className="mt-3 text-[11px] text-muted">Tap a past day to correct it — PIN and a reason are required.</p>
        </>
      ) : (
        <>
          <div className="my-4 flex items-center justify-between">
            <button onClick={() => setYm((y) => shiftMonth(y, -1))} className="kindle-neu-raised min-h-[36px] rounded-full px-3 text-xs text-primary">
              ← Prev
            </button>
            <span className="text-xs text-muted">{formatMonthLabel(ym)}</span>
            <button
              onClick={() => setYm((y) => (atCurrentMonth ? y : shiftMonth(y, 1)))}
              disabled={atCurrentMonth}
              className="kindle-neu-raised min-h-[36px] rounded-full px-3 text-xs text-primary disabled:opacity-30"
            >
              Next →
            </button>
          </div>

          <button
            onClick={handleExportPdf}
            disabled={exporting || loading}
            className="kindle-neu-raised mb-4 min-h-[44px] w-full rounded-card bg-accent text-sm font-medium text-ink disabled:opacity-60"
          >
            {exporting ? 'Generating PDF…' : 'Export month as PDF'}
          </button>

          {loading ? (
            <LoadingRing label="Loading month" />
          ) : (
            <HabitGrid habits={habits} days={monthDays} logs={logs} onEditPastDay={handleEditPastDay} />
          )}
        </>
      )}

      {editTarget && (
        <EditReasonSheet
          open
          habit={editTarget.habit}
          dateLabel={formatDate(editTarget.date)}
          currentStage={editTarget.stage}
          onSave={async (stage, reason) => {
            await editPast(editTarget.habit.id, editTarget.date, stage, reason)
            setEditTarget(null)
          }}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {gate}
    </div>
  )
}
