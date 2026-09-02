import { useCallback, useMemo, useState } from 'react'
import { mondayOf, weekDates } from '@/lib/date'
import { formatDate } from '@/lib/format'
import { useToast } from '@/hooks/useToast'
import LoadingRing from '@/components/LoadingRing'
import { useVigilDays } from '../hooks/useVigilDays'
import { useStudyTimer } from '../hooks/useStudyTimer'
import { studiedSeconds } from '../lib/time'
import WeeklyChart, { type WeeklyChartDay } from '../components/WeeklyChart'
import StudyTimer from '../components/StudyTimer'
import VigilToast from '../components/VigilToast'
import HourglassIcon from '../components/HourglassIcon'

export default function Home() {
  const monday = mondayOf()
  const dates = useMemo(() => weekDates(monday), [monday])
  const { days, loading, writeDay } = useVigilDays({ from: dates[0], to: dates[6] })
  const { message, showToast } = useToast()
  const [celebrationKey, setCelebrationKey] = useState(0)

  const onCrossTarget = useCallback(() => {
    setCelebrationKey((k) => k + 1)
    showToast("5 hours done — everything from here is bonus", 3200)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([18, 60, 30])
  }, [showToast])

  const { studied, running, busy, now, toggle } = useStudyTimer({
    days,
    ready: !loading,
    writeDay,
    onCrossTarget,
  })

  // Every bar reads off the same clock as the dial, so today's column grows in step
  // with the countdown instead of lagging behind it.
  const chartDays: WeeklyChartDay[] = dates.map((date) => ({
    date,
    studied: studiedSeconds(days.find((d) => d.date === date) ?? null, now),
  }))

  async function handleToggle() {
    try {
      await toggle()
    } catch {
      showToast("Couldn't save the timer — check your connection")
    }
  }

  return (
    <div className="px-4 pt-4">
      <header className="mb-5 flex items-center gap-2.5">
        <HourglassIcon size={26} />
        <div>
          <h1 className="font-display text-2xl font-bold text-vigilInk">Vigil</h1>
          <p className="text-xs text-vigilInkSoft">{formatDate(dates[0])} – {formatDate(dates[6])}</p>
        </div>
      </header>

      {loading ? (
        <LoadingRing label="Loading study time" />
      ) : (
        <>
          {/* Deliberate order: the week first as context, then today's timer. */}
          <WeeklyChart days={chartDays} />

          <div className="mt-9">
            <StudyTimer
              studied={studied}
              running={running}
              busy={busy}
              onToggle={handleToggle}
              celebrationKey={celebrationKey}
            />
          </div>
        </>
      )}

      <VigilToast message={message} />
    </div>
  )
}
