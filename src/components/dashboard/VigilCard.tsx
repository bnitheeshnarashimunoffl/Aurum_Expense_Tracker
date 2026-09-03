import { useEffect, useState } from 'react'
import SummaryCard, { CardCaption, CardSkeleton } from './SummaryCard'
import { useVigilDays } from '@/vigil/hooks/useVigilDays'
import { formatDuration, overflowSeconds, studiedSeconds, targetFraction } from '@/vigil/lib/time'
import { DAILY_TARGET_SECONDS } from '@/vigil/lib/types'
import { todayISO } from '@/lib/format'

// The SOFT gold, not --vigil-gold: on this charcoal the deeper one reads as the
// same brass Aurum's card uses, where the soft one keeps Vigil's warm, cream-side
// character. It also measures 8.6:1 here against the deeper gold's 5.5:1.
const ACCENT = 'var(--vigil-gold-soft)'
const GLOW = 'rgba(217, 180, 120, 0.12)'

/**
 * Today against the five-hour target.
 *
 * Two things this has to get right. It has to be LIVE — a timer that is running
 * right now is stored as `accumulated_seconds` plus a `running_since` stamp, so a
 * card that only read the stored number would show a stale total for a session in
 * progress. And overflow has to read as a reward: past five hours the bar is full
 * and a second, brighter segment shows the bonus on top, rather than a bar that
 * has capped out and a countdown stuck at zero.
 */
export default function VigilCard() {
  const today = todayISO()
  const { days, loading } = useVigilDays({ from: today, to: today })
  const [now, setNow] = useState(() => Date.now())

  const day = days.find((d) => d.date === today) ?? null
  const running = Boolean(day?.running_since)

  // Only ticks while a session is actually running — a dashboard that re-renders
  // once a second all day for a static number is a battery cost with no payoff.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [running])

  const studied = studiedSeconds(day, now)
  const bonus = overflowSeconds(studied)
  const fraction = targetFraction(studied)
  const remaining = Math.max(0, DAILY_TARGET_SECONDS - studied)

  return (
    <SummaryCard to="/vigil" label="Vigil" accent={ACCENT} glow={GLOW}>
      {loading ? (
        <CardSkeleton />
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-muted">{running ? 'Studying now' : 'Studied today'}</p>
              <p className="font-display tabular-nums text-[26px] font-bold leading-tight text-primary">
                {formatDuration(studied)}
              </p>
            </div>
            <span className="flex-shrink-0 text-[11px] tabular-nums" style={{ color: bonus > 0 ? ACCENT : 'var(--text-muted)' }}>
              {bonus > 0 ? `+${formatDuration(bonus)} bonus` : `of 5h`}
            </span>
          </div>

          {/* The track is a real inset well rather than a tinted div, so the fill
              reads as sitting inside it — the same construction Vigil's own bars use. */}
          <div className="mer-card-well mt-2.5 h-2 overflow-hidden rounded-full">
            <div className="flex h-full">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${fraction * 100}%`,
                  background: bonus > 0 ? 'var(--vigil-gold-soft)' : ACCENT,
                }}
              />
            </div>
          </div>

          <CardCaption>
            {bonus > 0
              ? 'Target met — everything since is bonus.'
              : studied === 0
                ? 'Nothing on the clock yet today.'
                : `${formatDuration(remaining)} left against today’s five.`}
          </CardCaption>
        </>
      )}
    </SummaryCard>
  )
}
