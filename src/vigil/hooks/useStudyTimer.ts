import { useCallback, useEffect, useRef, useState } from 'react'
import { todayISO } from '@/lib/format'
import { endOfDay } from '@/lib/date'
import { studiedSeconds, isOverflow } from '../lib/time'
import type { VigilDay } from '../lib/types'

/** 4 ticks/second: the digits only need 1Hz, but the dial sweep wants smoother than that. */
const TICK_MS = 250

interface UseStudyTimerArgs {
  days: VigilDay[]
  ready: boolean
  writeDay: (date: string, patch: Partial<VigilDay>) => Promise<void>
  /** Fired once, at the moment the countdown crosses zero while the user is watching. */
  onCrossTarget?: () => void
}

export function useStudyTimer({ days, ready, writeDay, onCrossTarget }: UseStudyTimerArgs) {
  const [today, setToday] = useState(todayISO)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)

  const day = days.find((d) => d.date === today) ?? null
  const running = Boolean(day?.running_since)
  const studied = studiedSeconds(day, now)

  // Kept in refs so the tick effect can read the latest values without
  // re-subscribing its interval on every frame.
  const dayRef = useRef(day)
  dayRef.current = day
  const rollingOver = useRef(false)

  /**
   * A session left running across midnight belongs to BOTH days: the seconds up to
   * local midnight bank into the day that just ended, and the timer keeps running
   * into the new day from midnight onward. Without this, an overnight session would
   * dump the entire stretch into whichever day happened to be loaded.
   */
  const rollOver = useCallback(
    async (previousDate: string, nextDate: string) => {
      if (rollingOver.current) return
      rollingOver.current = true
      try {
        const previous = dayRef.current
        const midnight = endOfDay(previousDate).getTime()
        if (previous?.running_since) {
          const untilMidnight = Math.max(0, (midnight - new Date(previous.running_since).getTime()) / 1000)
          await writeDay(previousDate, {
            accumulated_seconds: Math.round(previous.accumulated_seconds + untilMidnight),
            running_since: null,
          })
          // Carry the running session into the new day, starting at midnight.
          await writeDay(nextDate, {
            accumulated_seconds: 0,
            running_since: new Date(midnight).toISOString(),
          })
        }
        setToday(nextDate)
      } finally {
        rollingOver.current = false
      }
    },
    [writeDay]
  )

  useEffect(() => {
    // The clock still ticks while paused: the date can roll over, and a paused day
    // still needs to hand off to a fresh 5:00:00 at midnight.
    const id = window.setInterval(() => {
      setNow(Date.now())
      const current = todayISO()
      if (current !== today) void rollOver(today, current)
    }, running ? TICK_MS : 1000)
    return () => window.clearInterval(id)
  }, [running, today, rollOver])

  // Fire the overflow celebration exactly once, and only for a crossing the user
  // actually witnessed — not for a day that was already past target on load.
  const wasOverflow = useRef<boolean | null>(null)
  useEffect(() => {
    if (!ready) return
    const nowOverflow = isOverflow(studied)
    if (wasOverflow.current === false && nowOverflow) onCrossTarget?.()
    wasOverflow.current = nowOverflow
  }, [studied, ready, onCrossTarget])

  // Reset the "seen" marker when the day changes, so tomorrow can celebrate again.
  useEffect(() => {
    wasOverflow.current = null
  }, [today])

  const start = useCallback(async () => {
    if (busy || dayRef.current?.running_since) return
    setBusy(true)
    try {
      await writeDay(today, { running_since: new Date().toISOString() })
    } finally {
      setBusy(false)
    }
  }, [busy, today, writeDay])

  const pause = useCallback(async () => {
    const current = dayRef.current
    if (busy || !current?.running_since) return
    setBusy(true)
    try {
      const banked = Math.round(studiedSeconds(current, Date.now()))
      await writeDay(today, { accumulated_seconds: banked, running_since: null })
    } finally {
      setBusy(false)
    }
  }, [busy, today, writeDay])

  const toggle = useCallback(() => (running ? pause() : start()), [running, pause, start])

  // No periodic "save progress" write is needed: `running_since` already pins the
  // segment's start, so studied time is recomputed exactly on any reload. The only
  // writes are play, pause, and the midnight hand-off.

  // `now` is shared out so the weekly chart ticks off the same clock as the dial
  // — two independent intervals would drift and show different totals for today.
  return { today, day, running, studied, busy, now, start, pause, toggle }
}
